import { z } from "zod";
import { and, asc, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { ORDER_STATUSES } from "@contracts/shop";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  orders, orderItems, users, promocodes, banners, reviews,
  contactMessages, wholesaleRequests, passwordResets, adminLogs, books,
} from "@db/schema";
import { getSetting, setSetting } from "./lib/settings";
import { logAdminAction } from "./lib/adminlog";
import { hashPassword } from "./lib/passwords";

export const adminRouter = createRouter({
  // ---------- Статистика ----------
  stats: adminQuery.query(async () => {
    const db = getDb();
    const [booksCount] = await db.select({ c: sql<number>`count(*)` }).from(books);
    const [ordersCount] = await db.select({ c: sql<number>`count(*)` }).from(orders);
    const [usersCount] = await db.select({ c: sql<number>`count(*)` }).from(users);
    const [revenue] = await db
      .select({ s: sql<number>`COALESCE(sum(${orders.total}), 0)` })
      .from(orders)
      .where(sql`${orders.status} != 'cancelled'`);
    const byStatus = await db
      .select({ status: orders.status, c: sql<number>`count(*)` })
      .from(orders)
      .groupBy(orders.status);
    const recent = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(8);
    const [pendingWholesale] = await db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.wholesaleStatus, "pending"));
    return {
      books: Number(booksCount.c),
      orders: Number(ordersCount.c),
      users: Number(usersCount.c),
      revenue: Number(revenue.s),
      byStatus: byStatus.map((r) => ({ status: r.status, count: Number(r.c) })),
      recent,
      pendingWholesale: Number(pendingWholesale.c),
    };
  }),

  // ---------- Заказы ----------
  listOrders: adminQuery
    .input(
      z.object({
        search: z.string().max(200).optional(),
        status: z.enum(ORDER_STATUSES).optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.search) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(like(orders.number, q), like(orders.customerName, q), like(orders.phone, q)));
      }
      if (input.status) conds.push(eq(orders.status, input.status));
      if (input.dateFrom) conds.push(gte(orders.createdAt, new Date(input.dateFrom)));
      if (input.dateTo) {
        const to = new Date(input.dateTo);
        to.setDate(to.getDate() + 1);
        conds.push(sql`${orders.createdAt} < ${to}`);
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(orders).where(where);
      const items = await db
        .select()
        .from(orders)
        .where(where)
        .orderBy(desc(orders.createdAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { items, total: Number(count) };
    }),

  orderDetail: adminQuery.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = getDb();
    const order = await db.select().from(orders).where(eq(orders.id, input.id)).limit(1).then((r) => r.at(0));
    if (!order) throw new TRPCError({ code: "NOT_FOUND" });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
    return { order, items };
  }),

  setOrderStatus: adminQuery
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(ORDER_STATUSES),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      // Ручная пометка «Оплачен» фиксируется с основанием
      if (input.status === "paid" && !input.note) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Укажите основание оплаты (номер транзакции, примечание)",
        });
      }
      await db.update(orders).set({ status: input.status }).where(eq(orders.id, input.id));
      await logAdminAction(ctx.user, "order.status", `Заказ #${input.id} → ${input.status}${input.note ? ` (${input.note})` : ""}`);
      return { success: true };
    }),

  setOrderComment: adminQuery
    .input(z.object({ id: z.number().int().positive(), adminComment: z.string().max(2000) }))
    .mutation(async ({ input }) => {
      await getDb().update(orders).set({ adminComment: input.adminComment }).where(eq(orders.id, input.id));
      return { success: true };
    }),

  exportOrders: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db.select().from(orders).orderBy(desc(orders.createdAt)).limit(5000);
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[;\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = "number;date;customer;phone;city;address;delivery;payment;status;subtotal;discount;deliveryFee;total;wholesale";
    const lines = rows.map((o) =>
      [o.number, o.createdAt.toISOString(), o.customerName, o.phone, o.city, o.address, o.deliveryMethod,
       o.paymentMethod, o.status, o.subtotal, o.discount, o.deliveryFee, o.total, o.isWholesale ? "да" : "нет"]
        .map(esc).join(";"),
    );
    return [header, ...lines].join("\n");
  }),

  // ---------- Пользователи ----------
  listUsers: adminQuery
    .input(z.object({ search: z.string().max(200).optional(), page: z.number().int().min(1).default(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.search) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(like(users.name, q), like(users.email, q), like(users.phone, q), like(users.companyName, q)));
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(users).where(where);
      const items = await db
        .select({
          id: users.id, name: users.name, email: users.email, phone: users.phone,
          role: users.role, accountType: users.accountType, wholesaleStatus: users.wholesaleStatus,
          companyName: users.companyName, createdAt: users.createdAt,
        })
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(30)
        .offset((input.page - 1) * 30);
      return { items, total: Number(count) };
    }),

  setUserRole: adminQuery
    .input(z.object({ id: z.number().int().positive(), role: z.enum(["user", "admin"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.user.id && input.role !== "admin") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Нельзя снять права администратора с себя" });
      }
      await getDb().update(users).set({ role: input.role }).where(eq(users.id, input.id));
      await logAdminAction(ctx.user, "user.role", `user #${input.id} → ${input.role}`);
      return { success: true };
    }),

  setWholesaleStatus: adminQuery
    .input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected", "pending"]) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .update(users)
        .set({
          wholesaleStatus: input.status,
          accountType: input.status === "approved" ? "wholesale" : "retail",
        })
        .where(eq(users.id, input.id));
      await db
        .update(wholesaleRequests)
        .set({ status: input.status })
        .where(eq(wholesaleRequests.userId, input.id));
      await logAdminAction(ctx.user, "user.wholesale", `user #${input.id} → ${input.status}`);
      return { success: true };
    }),

  listWholesaleRequests: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: wholesaleRequests.id,
        userId: wholesaleRequests.userId,
        companyName: wholesaleRequests.companyName,
        message: wholesaleRequests.message,
        status: wholesaleRequests.status,
        createdAt: wholesaleRequests.createdAt,
        userName: users.name,
        userEmail: users.email,
        userPhone: users.phone,
      })
      .from(wholesaleRequests)
      .leftJoin(users, eq(wholesaleRequests.userId, users.id))
      .orderBy(desc(wholesaleRequests.createdAt))
      .limit(100);
  }),

  // Заявки на восстановление пароля
  listPasswordResets: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: passwordResets.id,
        userId: passwordResets.userId,
        email: passwordResets.email,
        status: passwordResets.status,
        createdAt: passwordResets.createdAt,
        userName: users.name,
      })
      .from(passwordResets)
      .leftJoin(users, eq(passwordResets.userId, users.id))
      .orderBy(desc(passwordResets.createdAt))
      .limit(100);
  }),

  // Админ задаёт новый пароль по заявке на восстановление
  resolvePasswordReset: adminQuery
    .input(z.object({ resetId: z.number().int().positive(), newPassword: z.string().min(6).max(128) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const req = await db.select().from(passwordResets).where(eq(passwordResets.id, input.resetId)).limit(1).then((r) => r.at(0));
      if (!req || req.status !== "pending") throw new TRPCError({ code: "NOT_FOUND", message: "Заявка не найдена" });
      await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, req.userId));
      await db.update(passwordResets).set({ status: "done" }).where(eq(passwordResets.id, input.resetId));
      await logAdminAction(ctx.user, "user.passwordReset", `user #${req.userId}`);
      return { success: true };
    }),

  rejectPasswordReset: adminQuery
    .input(z.object({ resetId: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await getDb().update(passwordResets).set({ status: "rejected" }).where(eq(passwordResets.id, input.resetId));
      return { success: true };
    }),

  // ---------- Промокоды ----------
  listPromocodes: adminQuery.query(async () => {
    return getDb().select().from(promocodes).orderBy(desc(promocodes.createdAt));
  }),

  upsertPromocode: adminQuery
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        code: z.string().min(2).max(64),
        discountPercent: z.number().int().min(1).max(90),
        minSubtotal: z.number().int().min(0).optional().nullable(),
        isActive: z.boolean().default(true),
        expiresAt: z.string().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const data = {
        code: input.code.trim().toUpperCase(),
        discountPercent: input.discountPercent,
        minSubtotal: input.minSubtotal ?? null,
        isActive: input.isActive,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      };
      if (input.id) {
        await db.update(promocodes).set(data).where(eq(promocodes.id, input.id));
        await logAdminAction(ctx.user, "promo.update", data.code);
        return { id: input.id };
      }
      const [{ id }] = await db.insert(promocodes).values(data).$returningId();
      await logAdminAction(ctx.user, "promo.create", data.code);
      return { id };
    }),

  deletePromocode: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().delete(promocodes).where(eq(promocodes.id, input.id));
    return { success: true };
  }),

  // ---------- Баннеры ----------
  listBanners: adminQuery.query(async () => {
    return getDb().select().from(banners).orderBy(asc(banners.sortOrder));
  }),

  upsertBanner: adminQuery
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        title: z.string().min(1).max(255),
        subtitle: z.string().max(512).optional().nullable(),
        imageUrl: z.string().max(2000).optional().nullable(),
        link: z.string().max(512).optional().nullable(),
        bgColor: z.string().max(32).optional().nullable(),
        isActive: z.boolean().default(true),
        sortOrder: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const data = {
        title: input.title, subtitle: input.subtitle ?? null, imageUrl: input.imageUrl ?? null,
        link: input.link ?? null, bgColor: input.bgColor ?? null,
        isActive: input.isActive, sortOrder: input.sortOrder,
      };
      if (input.id) {
        await db.update(banners).set(data).where(eq(banners.id, input.id));
        return { id: input.id };
      }
      const [{ id }] = await db.insert(banners).values(data).$returningId();
      return { id };
    }),

  deleteBanner: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().delete(banners).where(eq(banners.id, input.id));
    return { success: true };
  }),

  // ---------- Отзывы ----------
  listReviews: adminQuery.query(async () => {
    const db = getDb();
    return db
      .select({
        id: reviews.id, bookId: reviews.bookId, authorName: reviews.authorName,
        rating: reviews.rating, text: reviews.text, isApproved: reviews.isApproved,
        createdAt: reviews.createdAt, bookTitle: books.title,
      })
      .from(reviews)
      .leftJoin(books, eq(reviews.bookId, books.id))
      .orderBy(desc(reviews.createdAt))
      .limit(200);
  }),

  setReviewApproved: adminQuery
    .input(z.object({ id: z.number().int().positive(), isApproved: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb().update(reviews).set({ isApproved: input.isApproved }).where(eq(reviews.id, input.id));
      return { success: true };
    }),

  deleteReview: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
    await getDb().delete(reviews).where(eq(reviews.id, input.id));
    return { success: true };
  }),

  // ---------- Сообщения ----------
  listMessages: adminQuery.query(async () => {
    return getDb().select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200);
  }),

  markMessageRead: adminQuery
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      await getDb().update(contactMessages).set({ isRead: true }).where(eq(contactMessages.id, input.id));
      return { success: true };
    }),

  // ---------- Настройки ----------
  getSettings: adminQuery.query(async () => {
    const keys = [
      "topBarText", "contacts", "deliveryMethods", "paymentMethods",
      "freeDeliveryFrom", "minWholesaleOrder", "wholesaleText",
      "pageDelivery", "pageReturns", "pageTerms", "aboutText",
    ];
    const out: Record<string, string> = {};
    for (const k of keys) out[k] = (await getSetting(k)) ?? "";
    return out;
  }),

  setSettings: adminQuery
    .input(z.record(z.string(), z.string()))
    .mutation(async ({ ctx, input }) => {
      for (const [k, v] of Object.entries(input)) {
        await setSetting(k, v);
      }
      await logAdminAction(ctx.user, "settings.update", Object.keys(input).join(", "));
      return { success: true };
    }),

  // ---------- Журнал ----------
  listLogs: adminQuery.query(async () => {
    return getDb().select().from(adminLogs).orderBy(desc(adminLogs.createdAt)).limit(200);
  }),
});

