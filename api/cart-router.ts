import { z } from "zod";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { cartItems, books } from "@db/schema";

export const cartRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: cartItems.id,
        bookId: cartItems.bookId,
        qty: cartItems.qty,
        title: books.title,
        author: books.author,
        slug: books.slug,
        coverUrl: books.coverUrl,
        priceRetail: books.priceRetail,
        salePrice: books.salePrice,
        stock: books.stock,
        isActive: books.isActive,
      })
      .from(cartItems)
      .innerJoin(books, eq(cartItems.bookId, books.id))
      .where(eq(cartItems.userId, ctx.user.id));
    return rows;
  }),

  add: authedQuery
    .input(z.object({ bookId: z.number().int().positive(), qty: z.number().int().min(1).max(999).default(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db
        .insert(cartItems)
        .values({ userId: ctx.user.id, bookId: input.bookId, qty: input.qty })
        .onDuplicateKeyUpdate({
          set: { qty: sqlQtyIncrement(input.qty) },
        });
      return { success: true };
    }),

  setQty: authedQuery
    .input(z.object({ bookId: z.number().int().positive(), qty: z.number().int().min(0).max(999) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.qty === 0) {
        await db
          .delete(cartItems)
          .where(and(eq(cartItems.userId, ctx.user.id), eq(cartItems.bookId, input.bookId)));
      } else {
        await db
          .insert(cartItems)
          .values({ userId: ctx.user.id, bookId: input.bookId, qty: input.qty })
          .onDuplicateKeyUpdate({ set: { qty: input.qty } });
      }
      return { success: true };
    }),

  remove: authedQuery
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .delete(cartItems)
        .where(and(eq(cartItems.userId, ctx.user.id), eq(cartItems.bookId, input.bookId)));
      return { success: true };
    }),

  clear: authedQuery.mutation(async ({ ctx }) => {
    await getDb().delete(cartItems).where(eq(cartItems.userId, ctx.user.id));
    return { success: true };
  }),

  // Слияние гостевой корзины (localStorage) с серверной после входа
  merge: authedQuery
    .input(z.object({ items: z.array(z.object({ bookId: z.number().int().positive(), qty: z.number().int().min(1).max(999) })).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      for (const item of input.items) {
        await db
          .insert(cartItems)
          .values({ userId: ctx.user.id, bookId: item.bookId, qty: item.qty })
          .onDuplicateKeyUpdate({ set: { qty: sqlQtyIncrement(item.qty) } });
      }
      return { success: true };
    }),
});

function sqlQtyIncrement(delta: number) {
  return sql`LEAST(${cartItems.qty} + ${delta}, 999)`;
}

// Для orderRouter: удалить купленные позиции из серверной корзины
export async function removePurchasedFromCart(userId: number, bookIds: number[]) {
  if (bookIds.length === 0) return;
  await getDb()
    .delete(cartItems)
    .where(and(eq(cartItems.userId, userId), inArray(cartItems.bookId, bookIds)));
}
