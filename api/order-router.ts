import { z } from "zod";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, publicQuery, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { books, orders, orderItems, wholesaleTiers, promocodes } from "@db/schema";
import { priceForBook } from "./lib/pricing";
import { getDeliveryMethods, getPaymentMethods, getFreeDeliveryFrom, getMinWholesaleOrder } from "./lib/settings";
import { removePurchasedFromCart } from "./cart-router";
import { isWholesaleApproved } from "./catalog-router";

function generateOrderNumber(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `LB-${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${rand}`;
}

const checkoutInput = z.object({
  customerName: z.string().min(2, "Укажите имя и фамилию").max(255),
  phone: z.string().min(6, "Укажите телефон").max(32),
  email: z.string().email("Некорректный email").max(320).optional().or(z.literal("")),
  city: z.string().min(2, "Укажите город").max(128),
  address: z.string().min(3, "Укажите адрес").max(512),
  deliveryMethod: z.string().min(1).max(64),
  paymentMethod: z.string().min(1).max(64),
  comment: z.string().max(2000).optional(),
  promoCode: z.string().max(64).optional(),
  items: z
    .array(z.object({ bookId: z.number().int().positive(), qty: z.number().int().min(1).max(999) }))
    .min(1, "Корзина пуста")
    .max(200),
  idempotencyKey: z.string().min(8).max(64),
  consent: z.literal(true, { error: "Необходимо согласие с условиями покупки" }),
});

export const orderRouter = createRouter({
  create: publicQuery.input(checkoutInput).mutation(async ({ ctx, input }) => {
    const db = getDb();

    // Защита от повторного создания заказа при повторной отправке формы
    const existing = await db
      .select({ id: orders.id, number: orders.number, total: orders.total })
      .from(orders)
      .where(eq(orders.idempotencyKey, input.idempotencyKey))
      .limit(1)
      .then((r) => r.at(0));
    if (existing) {
      return { orderId: existing.id, orderNumber: existing.number, total: existing.total, duplicate: true };
    }

    // --- Серверный расчёт: цены и наличие только из БД ---
    const bookIds = input.items.map((i) => i.bookId);
    const dbBooks = await db
      .select()
      .from(books)
      .where(and(inArray(books.id, bookIds), eq(books.isActive, true)));
    const bookMap = new Map(dbBooks.map((b) => [b.id, b]));

    const wholesaleOk = isWholesaleApproved(ctx.user);
    const tiers = wholesaleOk
      ? await db.select().from(wholesaleTiers).where(inArray(wholesaleTiers.bookId, bookIds))
      : [];

    const lines: { book: (typeof dbBooks)[number]; qty: number; unitPrice: number; isWholesale: boolean }[] = [];
    for (const item of input.items) {
      const book = bookMap.get(item.bookId);
      if (!book) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Один из товаров недоступен" });
      }
      if (book.stock < item.qty) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `«${book.title}»: в наличии ${book.stock} шт.`,
        });
      }
      const { unitPrice, isWholesale } = priceForBook(book, tiers, item.qty, wholesaleOk);
      lines.push({ book, qty: item.qty, unitPrice, isWholesale });
    }

    const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
    const anyWholesale = lines.some((l) => l.isWholesale);

    // Минимальная сумма оптового заказа (настраивается админом)
    if (wholesaleOk) {
      const minWholesale = await getMinWholesaleOrder();
      if (minWholesale > 0 && anyWholesale && subtotal < minWholesale) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Минимальная сумма оптового заказа — ${minWholesale.toLocaleString("ru-RU")} ₸`,
        });
      }
    }

    // Промокод
    let discount = 0;
    let appliedPromo: string | null = null;
    if (input.promoCode) {
      const promo = await db
        .select()
        .from(promocodes)
        .where(eq(promocodes.code, input.promoCode.trim().toUpperCase()))
        .limit(1)
        .then((r) => r.at(0));
      const now = new Date();
      if (
        promo &&
        promo.isActive &&
        (!promo.expiresAt || promo.expiresAt > now) &&
        (promo.minSubtotal == null || subtotal >= promo.minSubtotal)
      ) {
        discount = Math.round((subtotal * promo.discountPercent) / 100);
        appliedPromo = promo.code;
      } else {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Промокод недействителен" });
      }
    }

    // Доставка
    const deliveryMethods = await getDeliveryMethods();
    const delivery = deliveryMethods.find((m) => m.id === input.deliveryMethod);
    if (!delivery) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Выберите способ доставки" });
    }
    const freeFrom = await getFreeDeliveryFrom();
    const deliveryFee =
      delivery.fee > 0 && freeFrom > 0 && subtotal - discount >= freeFrom ? 0 : delivery.fee;

    const paymentMethods = await getPaymentMethods();
    const payment = paymentMethods.find((m) => m.id === input.paymentMethod);
    if (!payment) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Выберите способ оплаты" });
    }

    const total = subtotal - discount + deliveryFee;
    const number = generateOrderNumber();

    const orderId = await db.transaction(async (tx) => {
      // Атомарное списание остатков с проверкой
      for (const line of lines) {
        const res = await tx
          .update(books)
          .set({ stock: sql`${books.stock} - ${line.qty}` })
          .where(and(eq(books.id, line.book.id), sql`${books.stock} >= ${line.qty}`));
        const affected = (res as unknown as [{ affectedRows: number }])[0]?.affectedRows ?? 0;
        if (affected === 0) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `«${line.book.title}» только что выкупили. Обновите корзину.`,
          });
        }
      }

      const [{ id }] = await tx
        .insert(orders)
        .values({
          number,
          userId: ctx.user?.id ?? null,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email || null,
          city: input.city,
          address: input.address,
          deliveryMethod: delivery.name,
          paymentMethod: payment.name,
          comment: input.comment ?? null,
          status: "new",
          subtotal,
          discount,
          deliveryFee,
          total,
          promoCode: appliedPromo,
          isWholesale: anyWholesale,
          idempotencyKey: input.idempotencyKey,
        })
        .$returningId();

      await tx.insert(orderItems).values(
        lines.map((l) => ({
          orderId: id,
          bookId: l.book.id,
          title: l.book.title,
          author: l.book.author,
          coverUrl: l.book.coverUrl,
          price: l.unitPrice,
          qty: l.qty,
        })),
      );

      return id;
    });

    // Очищаем купленные позиции из серверной корзины
    if (ctx.user) {
      await removePurchasedFromCart(ctx.user.id, bookIds);
    }

    return { orderId, orderNumber: number, total, duplicate: false };
  }),

  myOrders: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const list = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, ctx.user.id))
      .orderBy(desc(orders.createdAt))
      .limit(100);
    return list;
  }),

  myOrderById: authedQuery
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const order = await db
        .select()
        .from(orders)
        .where(and(eq(orders.id, input.id), eq(orders.userId, ctx.user.id)))
        .limit(1)
        .then((r) => r.at(0));
      if (!order) return null;
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      return { order, items };
    }),

  // Отслеживание заказа без входа: номер + телефон
  track: publicQuery
    .input(z.object({ number: z.string().min(4).max(32), phone: z.string().min(6).max(32) }))
    .query(async ({ input }) => {
      const db = getDb();
      const order = await db
        .select({
          number: orders.number,
          status: orders.status,
          total: orders.total,
          createdAt: orders.createdAt,
          customerName: orders.customerName,
        })
        .from(orders)
        .where(eq(orders.number, input.number.trim().toUpperCase()))
        .limit(1)
        .then((r) => r.at(0));
      if (!order) return null;
      // Сверяем телефон, не раскрывая чужие данные
      const full = await db
        .select({ phone: orders.phone })
        .from(orders)
        .where(eq(orders.number, order.number))
        .limit(1)
        .then((r) => r.at(0));
      const normalize = (p: string) => p.replace(/\D/g, "");
      if (!full || normalize(full.phone) !== normalize(input.phone)) return null;
      return order;
    }),

  validatePromo: publicQuery
    .input(z.object({ code: z.string().min(1).max(64), subtotal: z.number().int().min(0) }))
    .query(async ({ input }) => {
      const db = getDb();
      const promo = await db
        .select()
        .from(promocodes)
        .where(eq(promocodes.code, input.code.trim().toUpperCase()))
        .limit(1)
        .then((r) => r.at(0));
      if (!promo || !promo.isActive) return { valid: false as const, message: "Промокод не найден" };
      if (promo.expiresAt && promo.expiresAt < new Date())
        return { valid: false as const, message: "Срок действия промокода истёк" };
      if (promo.minSubtotal != null && input.subtotal < promo.minSubtotal)
        return {
          valid: false as const,
          message: `Минимальная сумма для промокода — ${promo.minSubtotal.toLocaleString("ru-RU")} ₸`,
        };
      return {
        valid: true as const,
        discountPercent: promo.discountPercent,
        discount: Math.round((input.subtotal * promo.discountPercent) / 100),
        code: promo.code,
      };
    }),
});
