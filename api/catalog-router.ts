import { z } from "zod";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  like,
  inArray,
  isNotNull,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { books, categories, wholesaleTiers, reviews, users } from "@db/schema";
import { wholesaleFromPrice } from "./lib/pricing";
import { cached } from "./lib/cache";

const sortEnum = z
  .enum(["popular", "new", "price_asc", "price_desc", "title"])
  .default("popular");

const listInput = z.object({
  search: z.string().max(200).optional(),
  categorySlug: z.string().max(255).optional(),
  authors: z.array(z.string().max(255)).optional(),
  publishers: z.array(z.string().max(255)).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  ageGroup: z.string().max(32).optional(),
  language: z.string().max(64).optional(),
  inStockOnly: z.boolean().default(false),
  flag: z.enum(["new", "bestseller", "recommended", "sale"]).optional(),
  sort: sortEnum,
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(48).default(12),
});

function isWholesaleApproved(user?: { accountType: string; wholesaleStatus: string }) {
  return !!user && user.accountType === "wholesale" && user.wholesaleStatus === "approved";
}

export const catalogRouter = createRouter({
  categories: publicQuery.query(() =>
    cached("catalog:categories", 60_000, () =>
      getDb()
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
    ),
  ),

  facets: publicQuery.query(async () => {
    const db = getDb();
    const authorRows = await db
      .selectDistinct({ author: books.author })
      .from(books)
      .where(and(eq(books.isActive, true), isNotNull(books.author)))
      .orderBy(asc(books.author));
    const publisherRows = await db
      .selectDistinct({ publisher: books.publisher })
      .from(books)
      .where(and(eq(books.isActive, true), isNotNull(books.publisher)))
      .orderBy(asc(books.publisher));
    return {
      authors: authorRows.map((r) => r.author).filter(Boolean) as string[],
      publishers: publisherRows.map((r) => r.publisher).filter(Boolean) as string[],
    };
  }),

  list: publicQuery.input(listInput).query(async ({ ctx, input }) => {
    const db = getDb();
    const conds: SQL[] = [eq(books.isActive, true)];

    if (input.search) {
      const q = `%${input.search.trim()}%`;
      conds.push(
        or(
          like(books.title, q),
          like(books.author, q),
          like(books.isbn, q),
          like(books.publisher, q),
        )!,
      );
    }
    if (input.categorySlug) {
      const cat = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, input.categorySlug))
        .limit(1)
        .then((r) => r.at(0));
      if (!cat) return { items: [], total: 0, page: input.page, pageSize: input.pageSize };
      conds.push(eq(books.categoryId, cat.id));
    }
    if (input.authors?.length) conds.push(inArray(books.author, input.authors));
    if (input.publishers?.length) conds.push(inArray(books.publisher, input.publishers));
    if (input.minPrice != null) {
      conds.push(gte(sql`COALESCE(${books.salePrice}, ${books.priceRetail})`, input.minPrice));
    }
    if (input.maxPrice != null) {
      conds.push(lte(sql`COALESCE(${books.salePrice}, ${books.priceRetail})`, input.maxPrice));
    }
    if (input.ageGroup) conds.push(eq(books.ageGroup, input.ageGroup));
    if (input.language) conds.push(eq(books.language, input.language));
    if (input.inStockOnly) conds.push(gte(books.stock, 1));
    if (input.flag === "new") conds.push(eq(books.isNew, true));
    if (input.flag === "bestseller") conds.push(eq(books.isBestseller, true));
    if (input.flag === "recommended") conds.push(eq(books.isRecommended, true));
    if (input.flag === "sale") conds.push(isNotNull(books.salePrice));

    const where = and(...conds);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(books)
      .where(where);

    const orderBy =
      input.sort === "price_asc"
        ? [asc(sql`COALESCE(${books.salePrice}, ${books.priceRetail})`)]
        : input.sort === "price_desc"
          ? [desc(sql`COALESCE(${books.salePrice}, ${books.priceRetail})`)]
          : input.sort === "title"
            ? [asc(books.title)]
            : input.sort === "new"
              ? [desc(books.createdAt)]
              : [desc(books.isBestseller), desc(books.createdAt)];

    const items = await db
      .select()
      .from(books)
      .where(where)
      .orderBy(...orderBy)
      .limit(input.pageSize)
      .offset((input.page - 1) * input.pageSize);

    // Оптовые цены видны только одобренным оптовикам
    let tiersByBook = new Map<number, number | null>();
    if (isWholesaleApproved(ctx.user) && items.length > 0) {
      const tiers = await db
        .select()
        .from(wholesaleTiers)
        .where(inArray(wholesaleTiers.bookId, items.map((b) => b.id)));
      for (const b of items) {
        tiersByBook.set(b.id, wholesaleFromPrice(b, tiers));
      }
    }

    return {
      items: items.map((b) => ({
        ...b,
        priceWholesale: null,
        wholesaleMinQty: null,
        wholesaleFrom: tiersByBook.get(b.id) ?? null,
      })),
      total: Number(count),
      page: input.page,
      pageSize: input.pageSize,
    };
  }),

  bySlug: publicQuery
    .input(z.object({ slug: z.string().max(255) }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const book = await db
        .select()
        .from(books)
        .where(and(eq(books.slug, input.slug), eq(books.isActive, true)))
        .limit(1)
        .then((r) => r.at(0));
      if (!book) return null;

      const category = book.categoryId
        ? await db
            .select()
            .from(categories)
            .where(eq(categories.id, book.categoryId))
            .limit(1)
            .then((r) => r.at(0))
        : null;

      const similar = book.categoryId
        ? await db
            .select()
            .from(books)
            .where(
              and(
                eq(books.categoryId, book.categoryId),
                eq(books.isActive, true),
                sql`${books.id} != ${book.id}`,
              ),
            )
            .limit(8)
        : [];

      const bookReviews = await db
        .select({
          id: reviews.id,
          authorName: reviews.authorName,
          rating: reviews.rating,
          text: reviews.text,
          createdAt: reviews.createdAt,
        })
        .from(reviews)
        .where(and(eq(reviews.bookId, book.id), eq(reviews.isApproved, true)))
        .orderBy(desc(reviews.createdAt));

      let tiers: { minQty: number; price: number }[] = [];
      if (isWholesaleApproved(ctx.user)) {
        tiers = await db
          .select({ minQty: wholesaleTiers.minQty, price: wholesaleTiers.price })
          .from(wholesaleTiers)
          .where(eq(wholesaleTiers.bookId, book.id))
          .orderBy(asc(wholesaleTiers.minQty));
      }

      return {
        book: { ...book, priceWholesale: null, wholesaleMinQty: null },
        category,
        similar: similar.map((b) => ({ ...b, priceWholesale: null, wholesaleMinQty: null })),
        reviews: bookReviews,
        wholesaleTiers: tiers,
      };
    }),

  home: publicQuery.query(() =>
    cached("catalog:home", 60_000, async () => {
      const db = getDb();
      const active = eq(books.isActive, true);
      const [newBooks, bestsellers, recommended, sale, cats] = await Promise.all([
        db.select().from(books).where(and(active, eq(books.isNew, true))).orderBy(desc(books.createdAt)).limit(8),
        db.select().from(books).where(and(active, eq(books.isBestseller, true))).limit(8),
        db.select().from(books).where(and(active, eq(books.isRecommended, true))).limit(8),
        db.select().from(books).where(and(active, isNotNull(books.salePrice))).limit(8),
        db.select().from(categories).where(eq(categories.isActive, true)).orderBy(asc(categories.sortOrder)).limit(8),
      ]);
      const strip = (b: typeof books.$inferSelect) => ({
        ...b,
        priceWholesale: null,
        wholesaleMinQty: null,
      });
      return {
        newBooks: newBooks.map(strip),
        bestsellers: bestsellers.map(strip),
        recommended: recommended.map(strip),
        sale: sale.map(strip),
        categories: cats,
      };
    }),
  ),

  // Книги по списку id (для гостевой корзины)
  byIds: publicQuery
    .input(z.object({ ids: z.array(z.number().int().positive()).min(1).max(200) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select()
        .from(books)
        .where(and(inArray(books.id, input.ids), eq(books.isActive, true)));
      return rows.map((b) => ({ ...b, priceWholesale: null, wholesaleMinQty: null }));
    }),

  // Подсказки для поиска
  suggest: publicQuery
    .input(z.object({ q: z.string().min(1).max(100) }))
    .query(async ({ input }) => {
      const db = getDb();
      const q = `%${input.q.trim()}%`;
      return db
        .select({ id: books.id, slug: books.slug, title: books.title, author: books.author, coverUrl: books.coverUrl })
        .from(books)
        .where(and(eq(books.isActive, true), or(like(books.title, q), like(books.author, q), like(books.isbn, q))))
        .limit(6);
    }),

  // Отзыв на книгу (только авторизованные, модерация админом)
  createReview: publicQuery
    .input(
      z.object({
        bookId: z.number().int().positive(),
        rating: z.number().int().min(1).max(5),
        text: z.string().min(3).max(2000),
        authorName: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.insert(reviews).values({
        bookId: input.bookId,
        userId: ctx.user?.id ?? null,
        authorName: input.authorName,
        rating: input.rating,
        text: input.text,
        isApproved: false,
      });
      return { success: true, message: "Отзыв отправлен на модерацию" };
    }),
});

export { isWholesaleApproved };

// Для admin-роутера
export async function getUserById(id: number) {
  return getDb().select().from(users).where(eq(users.id, id)).limit(1).then((r) => r.at(0));
}
