import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { favorites, books } from "@db/schema";

export const favoritesRouter = createRouter({
  list: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    return db
      .select({
        id: favorites.id,
        bookId: books.id,
        slug: books.slug,
        title: books.title,
        author: books.author,
        coverUrl: books.coverUrl,
        priceRetail: books.priceRetail,
        salePrice: books.salePrice,
        stock: books.stock,
      })
      .from(favorites)
      .innerJoin(books, eq(favorites.bookId, books.id))
      .where(eq(favorites.userId, ctx.user.id));
  }),

  ids: authedQuery.query(async ({ ctx }) => {
    const rows = await getDb()
      .select({ bookId: favorites.bookId })
      .from(favorites)
      .where(eq(favorites.userId, ctx.user.id));
    return rows.map((r) => r.bookId);
  }),

  toggle: authedQuery
    .input(z.object({ bookId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db
        .select({ id: favorites.id })
        .from(favorites)
        .where(and(eq(favorites.userId, ctx.user.id), eq(favorites.bookId, input.bookId)))
        .limit(1);
      if (existing.length > 0) {
        await db.delete(favorites).where(eq(favorites.id, existing[0].id));
        return { favorite: false };
      }
      await db.insert(favorites).values({ userId: ctx.user.id, bookId: input.bookId });
      return { favorite: true };
    }),

  merge: authedQuery
    .input(z.object({ bookIds: z.array(z.number().int().positive()).max(500) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const existing = await db
        .select({ bookId: favorites.bookId })
        .from(favorites)
        .where(and(eq(favorites.userId, ctx.user.id), inArray(favorites.bookId, input.bookIds)));
      const have = new Set(existing.map((e) => e.bookId));
      for (const bookId of input.bookIds) {
        if (!have.has(bookId)) {
          await db.insert(favorites).values({ userId: ctx.user.id, bookId });
        }
      }
      return { success: true };
    }),
});
