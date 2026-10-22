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

  // Импорт каталога из CSV: создаёт книги, обновляет существующие по ISBN,
  // сам создаёт недостающие категории и возвращает подробный отчёт.
  importBooks: adminQuery
    .input(z.object({ csv: z.string().min(1).max(10_000_000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const text = input.csv.replace(/^\uFEFF/, "");
      const delimiter = detectDelimiter(text);
      const rows = parseCsv(text, delimiter);
      if (rows.length < 2) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Файл пуст или в нём только строка заголовков" });
      }
      if (rows.length - 1 > IMPORT_MAX_ROWS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Слишком много строк (${rows.length - 1}). За один раз можно загрузить не более ${IMPORT_MAX_ROWS}.`,
        });
      }

      // Сопоставляем заголовки столбцов с полями (русские и английские названия)
      const colIndex = new Map<ImportField, number>();
      const ignoredColumns: string[] = [];
      rows[0].forEach((h, idx) => {
        const field = HEADER_TO_FIELD.get(normHeader(h));
        if (field) {
          if (!colIndex.has(field)) colIndex.set(field, idx);
        } else if (h.trim()) {
          ignoredColumns.push(h.trim());
        }
      });
      if (!colIndex.has("title") && !colIndex.has("isbn")) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Не найден столбец «title» (название). Скачайте шаблон CSV и сверьтесь с заголовками.",
        });
      }

      const report = {
        total: 0,
        created: 0,
        updated: 0,
        skipped: 0,
        categoriesCreated: [] as string[],
        ignoredColumns,
        errors: [] as { row: number; message: string }[],
      };

      // Кэш категорий и ISBN, чтобы не ходить в БД на каждую строку
      const cats = await db.select().from(categories);
      const catByName = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
      const catBySlug = new Map(cats.map((c) => [c.slug, c.id]));
      const existingBooks = await db.select({ id: books.id, isbn: books.isbn }).from(books);
      const bookByIsbn = new Map<string, number>();
      for (const b of existingBooks) {
        if (b.isbn) bookByIsbn.set(normIsbn(b.isbn), b.id);
      }

      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.every((c) => !c.trim())) continue; // пустая строка
        report.total += 1;
        const rowNum = i + 1; // как в Excel: строка 1 — заголовок
        try {
          const cell = (f: ImportField) => {
            const idx = colIndex.get(f);
            return idx === undefined ? undefined : (r[idx] ?? "").trim();
          };
          const filled = (f: ImportField) => (cell(f) ?? "") !== "";

          // ISBN
          const rawIsbn = cell("isbn") ?? "";
          if (/^\d+([.,]\d+)?e\+?\d+$/i.test(rawIsbn)) {
            throw new Error(
              `ISBN «${rawIsbn}» испорчен Excel (научная запись). Задайте столбцу ISBN текстовый формат и введите заново`,
            );
          }
          const isbn = rawIsbn ? normIsbn(rawIsbn) : "";
          const existingId = isbn ? bookByIsbn.get(isbn) : undefined;

          // Собираем значения только из тех столбцов, что есть в файле
          const patch: Record<string, unknown> = {};
          const setStr = (f: ImportField) => {
            if (filled(f)) patch[f] = cell(f);
          };
          const setInt = (f: ImportField, label: string) => {
            if (!filled(f)) return;
            const n = toInt(cell(f)!);
            if (n === null) throw new Error(`«${label}»: «${cell(f)}» — не число`);
            patch[f] = n;
          };
          const setBool = (f: ImportField, label: string) => {
            if (!filled(f)) return;
            const b = toBool(cell(f)!);
            if (b === null) throw new Error(`«${label}»: «${cell(f)}» — ожидалось да/нет`);
            patch[f] = b;
          };

          setStr("title");
          setStr("author");
          setStr("publisher");
          setStr("description");
          setStr("language");
          setStr("binding");
          setStr("ageGroup");
          setStr("coverUrl");
          setInt("year", "Год");
          setInt("pages", "Страниц");
          setInt("priceRetail", "Розничная цена");
          setInt("priceWholesale", "Оптовая цена");
          setInt("wholesaleMinQty", "Мин. кол-во для опта");
          setInt("salePrice", "Цена со скидкой");
          setInt("stock", "Остаток");
          setBool("isNew", "Новинка");
          setBool("isBestseller", "Бестселлер");
          setBool("isRecommended", "Рекомендуем");
          setBool("isActive", "Активна");

          // Категория: ищем по названию, иначе создаём
          const categoryName = cell("category") ?? "";
          if (categoryName) {
            const key = categoryName.toLowerCase();
            const slug = slugify(categoryName);
            let id = catByName.get(key) ?? catBySlug.get(slug);
            if (!id) {
              const [{ id: newId }] = await db
                .insert(categories)
                .values({ name: categoryName.slice(0, 255), slug: slug.slice(0, 255) })
                .$returningId();
              id = newId;
              report.categoriesCreated.push(categoryName);
              catBySlug.set(slug, id);
            }
            catByName.set(key, id);
            patch.categoryId = id;
          }

          if (existingId !== undefined) {
            // ---- обновление существующей книги (по ISBN) ----
            // Пустые ячейки не затирают уже сохранённые данные.
            if (Object.keys(patch).length === 0) {
              report.skipped += 1;
              continue;
            }
            const parsed = bookInput.partial().safeParse(patch);
            if (!parsed.success) throw new Error(formatZod(parsed.error));
            // zod подставляет значения по умолчанию даже в partial() — оставляем только то, что было в файле
            const changes = Object.fromEntries(Object.entries(parsed.data).filter(([k]) => k in patch));
            await db.update(books).set(changes).where(eq(books.id, existingId));
            report.updated += 1;
          } else {
            // ---- создание новой книги ----
            if (!patch.title) throw new Error("не указано название");
            if (patch.priceRetail === undefined) throw new Error("не указана розничная цена");
            const parsed = bookInput.safeParse({ ...patch, isbn: isbn || null });
            if (!parsed.success) throw new Error(formatZod(parsed.error));
            const slug = await uniqueSlug(parsed.data.title);
            const [{ id }] = await db
              .insert(books)
              .values({ ...parsed.data, slug })
              .$returningId();
            if (isbn) bookByIsbn.set(isbn, id);
            report.created += 1;
          }
        } catch (e) {
          report.errors.push({ row: rowNum, message: e instanceof Error ? e.message : "ошибка" });
        }
      }

      await logAdminAction(
        ctx.user,
        "book.import",
        `строк ${report.total}: создано ${report.created}, обновлено ${report.updated}, ошибок ${report.errors.length}, новых категорий ${report.categoriesCreated.length}`,
      );
      return report;
    }),
});

// ---------- Вспомогательные функции импорта ----------

const IMPORT_MAX_ROWS = 5000;

type ImportField =
  | "isbn" | "title" | "author" | "publisher" | "category" | "language" | "year" | "pages"
  | "binding" | "ageGroup" | "description" | "priceRetail" | "priceWholesale" | "wholesaleMinQty"
  | "salePrice" | "stock" | "coverUrl" | "isNew" | "isBestseller" | "isRecommended" | "isActive";

const normHeader = (h: string) => h.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/\s+/g, " ").replace(/ё/g, "е");

const FIELD_ALIASES: Record<ImportField, string[]> = {
  isbn: ["isbn", "исбн"],
  title: ["title", "название", "наименование"],
  author: ["author", "автор"],
  publisher: ["publisher", "издательство"],
  category: ["category", "категория"],
  language: ["language", "язык"],
  year: ["year", "год", "год издания"],
  pages: ["pages", "страниц", "страницы", "кол-во страниц"],
  binding: ["binding", "переплет"],
  ageGroup: ["agegroup", "возраст", "возрастная группа"],
  description: ["description", "описание"],
  priceRetail: ["priceretail", "розничная цена", "цена"],
  priceWholesale: ["pricewholesale", "оптовая цена"],
  wholesaleMinQty: ["wholesaleminqty", "мин. опт. кол-во", "мин. кол-во для опта"],
  salePrice: ["saleprice", "цена со скидкой", "акционная цена"],
  stock: ["stock", "остаток", "количество"],
  coverUrl: ["coverurl", "обложка", "url обложки"],
  isNew: ["isnew", "новинка"],
  isBestseller: ["isbestseller", "бестселлер"],
  isRecommended: ["isrecommended", "рекомендуем"],
  isActive: ["isactive", "активна"],
};

const HEADER_TO_FIELD = new Map<string, ImportField>(
  (Object.entries(FIELD_ALIASES) as [ImportField, string[]][]).flatMap(([field, names]) =>
    names.map((n) => [normHeader(n), field] as [string, ImportField]),
  ),
);

const normIsbn = (s: string) => s.replace(/[\s-]/g, "").toUpperCase();

// «1 200», «1200,00», «1 200 ₸» → 1200
function toInt(v: string): number | null {
  const cleaned = v.replace(/[\s\u00A0₸]|тг\.?/gi, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

function toBool(v: string): boolean | null {
  const s = v.trim().toLowerCase();
  if (["1", "true", "yes", "y", "да", "д", "+"].includes(s)) return true;
  if (["0", "false", "no", "n", "нет", "н", "-"].includes(s)) return false;
  return null;
}

function formatZod(err: z.ZodError): string {
  return err.issues.map((i) => `«${i.path.join(".") || "строка"}»: ${i.message}`).join("; ");
}

// Разделитель определяем по строке заголовков: «;», «,» или табуляция
function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = { ";": 0, ",": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of firstLine) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch in counts) counts[ch as keyof typeof counts] += 1;
  }
  const best = (Object.entries(counts) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ";";
}

// CSV-парсер с поддержкой кавычек, переносов строк внутри ячеек и одного разделителя
function parseCsv(text: string, delimiter: string): string[][] {
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
    else if (ch === delimiter) pushField();
    else if (ch === "\n") pushRow();
    else if (ch === "\r") { /* пропускаем */ }
    else field += ch;
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}
