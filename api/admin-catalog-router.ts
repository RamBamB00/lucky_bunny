import { z } from "zod";
import { and, asc, desc, eq, like, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { books, categories, wholesaleTiers } from "@db/schema";
import { slugify } from "./lib/slug";
import { logAdminAction } from "./lib/adminlog";

const bookInput = z.object({
  isbn: z.string().max(32).optional().nullable(),
  title: z.string().min(1).max(512),
  author: z.string().max(255).optional().nullable(),
  publisher: z.string().max(255).optional().nullable(),
  description: z.string().max(10000).optional().nullable(),
  categoryId: z.number().int().positive().optional().nullable(),
  language: z.string().max(64).optional().nullable(),
  year: z.number().int().min(1800).max(2100).optional().nullable(),
  pages: z.number().int().min(1).max(100000).optional().nullable(),
  binding: z.string().max(64).optional().nullable(),
  ageGroup: z.string().max(32).optional().nullable(),
  coverUrl: z.string().max(2000).optional().nullable(),
  priceRetail: z.number().int().min(0),
  priceWholesale: z.number().int().min(0).optional().nullable(),
  wholesaleMinQty: z.number().int().min(1).optional().nullable(),
  salePrice: z.number().int().min(0).optional().nullable(),
  stock: z.number().int().min(0).default(0),
  isNew: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  isRecommended: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

async function uniqueSlug(base: string, excludeId?: number): Promise<string> {
  const db = getDb();
  let slug = slugify(base);
  let attempt = 0;
  for (;;) {
    const candidate = attempt === 0 ? slug : `${slug}-${attempt + 1}`;
    const existing = await db
      .select({ id: books.id })
      .from(books)
      .where(eq(books.slug, candidate))
      .limit(1)
      .then((r) => r.at(0));
    if (!existing || existing.id === excludeId) return candidate;
    attempt += 1;
  }
}

export const adminCatalogRouter = createRouter({
  listBooks: adminQuery
    .input(
      z.object({
        search: z.string().max(200).optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.search) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(like(books.title, q), like(books.author, q), like(books.isbn, q)));
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(books).where(where);
      const items = await db
        .select()
        .from(books)
        .where(where)
        .orderBy(desc(books.updatedAt))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { items, total: Number(count) };
    }),

  getBook: adminQuery.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
    const db = getDb();
    const book = await db.select().from(books).where(eq(books.id, input.id)).limit(1).then((r) => r.at(0));
    if (!book) throw new TRPCError({ code: "NOT_FOUND" });
    const tiers = await db.select().from(wholesaleTiers).where(eq(wholesaleTiers.bookId, book.id)).orderBy(asc(wholesaleTiers.minQty));
    return { book, tiers };
    }),

  createBook: adminQuery.input(bookInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const slug = await uniqueSlug(input.title);
    const [{ id }] = await db.insert(books).values({ ...input, slug }).$returningId();
    await logAdminAction(ctx.user, "book.create", `#${id} «${input.title}»`);
    return { id, slug };
  }),

  updateBook: adminQuery
    .input(z.object({ id: z.number().int().positive(), data: bookInput.partial(), tiers: z.array(z.object({ minQty: z.number().int().min(1), price: z.number().int().min(0) })).max(20).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      await db.update(books).set(input.data).where(eq(books.id, input.id));
      if (input.tiers) {
        await db.delete(wholesaleTiers).where(eq(wholesaleTiers.bookId, input.id));
        if (input.tiers.length > 0) {
          await db.insert(wholesaleTiers).values(input.tiers.map((t) => ({ ...t, bookId: input.id })));
        }
      }
      await logAdminAction(ctx.user, "book.update", `#${input.id}`);
      return { success: true };
    }),

  setBookActive: adminQuery
    .input(z.object({ id: z.number().int().positive(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await getDb().update(books).set({ isActive: input.isActive }).where(eq(books.id, input.id));
      await logAdminAction(ctx.user, input.isActive ? "book.restore" : "book.archive", `#${input.id}`);
      return { success: true };
    }),

  deleteBook: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db.delete(wholesaleTiers).where(eq(wholesaleTiers.bookId, input.id));
    await db.delete(books).where(eq(books.id, input.id));
    await logAdminAction(ctx.user, "book.delete", `#${input.id}`);
    return { success: true };
  }),

  // Категории
  listCategories: adminQuery.query(async () => {
    return getDb().select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
  }),

  upsertCategory: adminQuery
    .input(
      z.object({
        id: z.number().int().positive().optional(),
        name: z.string().min(1).max(255),
        sortOrder: z.number().int().default(0),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.id) {
        await db.update(categories).set({ name: input.name, sortOrder: input.sortOrder, isActive: input.isActive }).where(eq(categories.id, input.id));
        await logAdminAction(ctx.user, "category.update", `#${input.id} ${input.name}`);
        return { id: input.id };
      }
      const [{ id }] = await db
        .insert(categories)
        .values({ name: input.name, slug: slugify(input.name), sortOrder: input.sortOrder, isActive: input.isActive })
        .$returningId();
      await logAdminAction(ctx.user, "category.create", `#${id} ${input.name}`);
      return { id };
    }),

  deleteCategory: adminQuery.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const db = getDb();
    await db.update(books).set({ categoryId: null }).where(eq(books.categoryId, input.id));
    await db.delete(categories).where(eq(categories.id, input.id));
    await logAdminAction(ctx.user, "category.delete", `#${input.id}`);
    return { success: true };
  }),

  // Экспорт каталога в CSV
  exportBooks: adminQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ book: books, category: categories.name })
      .from(books)
      .leftJoin(categories, eq(books.categoryId, categories.id))
      .orderBy(asc(books.title));
    const header = "isbn;title;author;publisher;category;language;year;description;priceRetail;priceWholesale;wholesaleMinQty;stock;coverUrl";
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[;\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r) =>
      [r.book.isbn, r.book.title, r.book.author, r.book.publisher, r.category, r.book.language, r.book.year,
       r.book.description, r.book.priceRetail, r.book.priceWholesale, r.book.wholesaleMinQty, r.book.stock, r.book.coverUrl]
        .map(esc)
        .join(";"),
    );
    return [header, ...lines].join("\n");
  }),

  // Импорт каталога из CSV (разделитель «;» или «,», первая строка — заголовок)
  importBooks: adminQuery
    .input(z.object({ csv: z.string().min(1).max(5_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const rows = parseCsv(input.csv);
      if (rows.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "CSV пуст или без данных" });
      const header = rows[0].map((h) => h.trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);

      const report = { created: 0, updated: 0, errors: [] as string[] };
      const cats = await db.select().from(categories);
      const catByName = new Map(cats.map((c) => [c.name.toLowerCase(), c.id]));

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length === 0 || r.every((c) => !c.trim())) continue;
        const rowNum = i + 1;
        try {
          const get = (name: string) => {
            const idx = col(name);
            return idx >= 0 ? (r[idx] ?? "").trim() : "";
          };
          const title = get("title") || get("название");
          if (!title) throw new Error("нет названия");
          const isbn = get("isbn") || null;
          const priceRetail = parseInt(get("priceretail") || get("розничная цена"), 10);
          if (!Number.isFinite(priceRetail)) throw new Error("нет розничной цены");
          const num = (v: string) => {
            const n = parseInt(v, 10);
            return Number.isFinite(n) ? n : null;
          };

          const categoryName = get("category") || get("категория");
          let categoryId: number | null = null;
          if (categoryName) {
            const found = catByName.get(categoryName.toLowerCase());
            if (found) categoryId = found;
            else {
              const [{ id }] = await db
                .insert(categories)
                .values({ name: categoryName, slug: slugify(categoryName) })
                .$returningId();
              catByName.set(categoryName.toLowerCase(), id);
              categoryId = id;
            }
          }

          const data = {
            isbn,
            title,
            author: get("author") || get("автор") || null,
            publisher: get("publisher") || get("издательство") || null,
            categoryId,
            language: get("language") || get("язык") || null,
            year: num(get("year") || get("год")),
            description: get("description") || get("описание") || null,
            priceRetail,
            priceWholesale: num(get("pricewholesale") || get("оптовая цена")),
            wholesaleMinQty: num(get("wholesaleminqty") || get("мин. опт. кол-во")),
            stock: num(get("stock") || get("остаток")) ?? 0,
            coverUrl: get("coverurl") || get("обложка") || null,
          };

          if (isbn) {
            const existing = await db.select({ id: books.id }).from(books).where(eq(books.isbn, isbn)).limit(1).then((x) => x.at(0));
            if (existing) {
              await db.update(books).set(data).where(eq(books.id, existing.id));
              report.updated += 1;
              continue;
            }
          }
          const slug = await uniqueSlug(title);
          await db.insert(books).values({ ...data, slug });
          report.created += 1;
        } catch (e) {
          report.errors.push(`Строка ${rowNum}: ${e instanceof Error ? e.message : "ошибка"}`);
        }
      }

      await logAdminAction(ctx.user, "book.import", `создано ${report.created}, обновлено ${report.updated}, ошибок ${report.errors.length}`);
      return report;
    }),
});

// Простой CSV-парсер с поддержкой кавычек и ;/, разделителей
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ""; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ";" || ch === ",") pushField();
    else if (ch === "\n") pushRow();
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}
