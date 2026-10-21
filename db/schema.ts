import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  int,
  bigint,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ---------- Пользователи ----------

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  phone: varchar("phone", { length: 32 }),
  avatar: text("avatar"),
  passwordHash: varchar("passwordHash", { length: 255 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  accountType: mysqlEnum("accountType", ["retail", "wholesale"])
    .default("retail")
    .notNull(),
  wholesaleStatus: mysqlEnum("wholesaleStatus", [
    "none",
    "pending",
    "approved",
    "rejected",
  ])
    .default("none")
    .notNull(),
  companyName: varchar("companyName", { length: 255 }),
  newsletterOptIn: boolean("newsletterOptIn").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ---------- Каталог ----------

export const categories = mysqlTable("categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
});

export type Category = typeof categories.$inferSelect;

export const books = mysqlTable(
  "books",
  {
    id: serial("id").primaryKey(),
    isbn: varchar("isbn", { length: 32 }),
    slug: varchar("slug", { length: 255 }).notNull().unique(),
    title: varchar("title", { length: 512 }).notNull(),
    author: varchar("author", { length: 255 }),
    publisher: varchar("publisher", { length: 255 }),
    description: text("description"),
    categoryId: bigint("categoryId", { mode: "number", unsigned: true }),
    language: varchar("language", { length: 64 }),
    year: int("year"),
    pages: int("pages"),
    binding: varchar("binding", { length: 64 }),
    ageGroup: varchar("ageGroup", { length: 32 }),
    coverUrl: text("coverUrl"),
    priceRetail: int("priceRetail").notNull(),
    priceWholesale: int("priceWholesale"),
    wholesaleMinQty: int("wholesaleMinQty"),
    salePrice: int("salePrice"),
    stock: int("stock").default(0).notNull(),
    isNew: boolean("isNew").default(false).notNull(),
    isBestseller: boolean("isBestseller").default(false).notNull(),
    isRecommended: boolean("isRecommended").default(false).notNull(),
    isActive: boolean("isActive").default(true).notNull(),
    isDemo: boolean("isDemo").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("books_title_idx").on(t.title),
    index("books_author_idx").on(t.author),
    index("books_isbn_idx").on(t.isbn),
    index("books_category_idx").on(t.categoryId),
  ],
);

export type Book = typeof books.$inferSelect;
export type InsertBook = typeof books.$inferInsert;

// Оптовые ценовые уровни (объём → цена)
export const wholesaleTiers = mysqlTable(
  "wholesale_tiers",
  {
    id: serial("id").primaryKey(),
    bookId: bigint("bookId", { mode: "number", unsigned: true }).notNull(),
    minQty: int("minQty").notNull(),
    price: int("price").notNull(),
  },
  (t) => [index("tier_book_idx").on(t.bookId)],
);

export type WholesaleTier = typeof wholesaleTiers.$inferSelect;

// ---------- Заказы ----------

export const orders = mysqlTable(
  "orders",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 32 }).notNull().unique(),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    customerName: varchar("customerName", { length: 255 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    email: varchar("email", { length: 320 }),
    city: varchar("city", { length: 128 }).notNull(),
    address: varchar("address", { length: 512 }).notNull(),
    deliveryMethod: varchar("deliveryMethod", { length: 64 }).notNull(),
    paymentMethod: varchar("paymentMethod", { length: 64 }).notNull(),
    comment: text("comment"),
    status: mysqlEnum("status", [
      "new",
      "confirmed",
      "paid",
      "assembling",
      "shipped",
      "delivered",
      "cancelled",
    ])
      .default("new")
      .notNull(),
    subtotal: int("subtotal").notNull(),
    discount: int("discount").default(0).notNull(),
    deliveryFee: int("deliveryFee").default(0).notNull(),
    total: int("total").notNull(),
    promoCode: varchar("promoCode", { length: 64 }),
    isWholesale: boolean("isWholesale").default(false).notNull(),
    adminComment: text("adminComment"),
    idempotencyKey: varchar("idempotencyKey", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    uniqueIndex("orders_idem_idx").on(t.idempotencyKey),
  ],
);

export type Order = typeof orders.$inferSelect;

export const orderItems = mysqlTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: bigint("orderId", { mode: "number", unsigned: true }).notNull(),
    bookId: bigint("bookId", { mode: "number", unsigned: true }).notNull(),
    title: varchar("title", { length: 512 }).notNull(),
    author: varchar("author", { length: 255 }),
    coverUrl: text("coverUrl"),
    price: int("price").notNull(),
    qty: int("qty").notNull(),
  },
  (t) => [index("oi_order_idx").on(t.orderId)],
);

export type OrderItem = typeof orderItems.$inferSelect;

// ---------- Корзина (серверная, для авторизованных) ----------

export const cartItems = mysqlTable(
  "cart_items",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    bookId: bigint("bookId", { mode: "number", unsigned: true }).notNull(),
    qty: int("qty").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("cart_user_book_idx").on(t.userId, t.bookId)],
);

export type CartItem = typeof cartItems.$inferSelect;

// ---------- Избранное ----------

export const favorites = mysqlTable(
  "favorites",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    bookId: bigint("bookId", { mode: "number", unsigned: true }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("fav_user_book_idx").on(t.userId, t.bookId)],
);

// ---------- Адреса ----------

export const addresses = mysqlTable(
  "addresses",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
    label: varchar("label", { length: 128 }),
    city: varchar("city", { length: 128 }).notNull(),
    address: varchar("address", { length: 512 }).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
  },
  (t) => [index("addr_user_idx").on(t.userId)],
);

export type Address = typeof addresses.$inferSelect;

// ---------- Отзывы ----------

export const reviews = mysqlTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    bookId: bigint("bookId", { mode: "number", unsigned: true }).notNull(),
    userId: bigint("userId", { mode: "number", unsigned: true }),
    authorName: varchar("authorName", { length: 255 }).notNull(),
    rating: int("rating").notNull(),
    text: text("text").notNull(),
    isApproved: boolean("isApproved").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => [index("rev_book_idx").on(t.bookId)],
);

export type Review = typeof reviews.$inferSelect;

// ---------- Промокоды ----------

export const promocodes = mysqlTable("promocodes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  discountPercent: int("discountPercent").notNull(),
  minSubtotal: int("minSubtotal"),
  isActive: boolean("isActive").default(true).notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Promocode = typeof promocodes.$inferSelect;

// ---------- Баннеры ----------

export const banners = mysqlTable("banners", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 512 }),
  imageUrl: text("imageUrl"),
  link: varchar("link", { length: 512 }),
  bgColor: varchar("bgColor", { length: 32 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type Banner = typeof banners.$inferSelect;

// ---------- Заявки на опт ----------

export const wholesaleRequests = mysqlTable("wholesale_requests", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  companyName: varchar("companyName", { length: 255 }),
  message: text("message"),
  status: mysqlEnum("status", ["pending", "approved", "rejected"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ---------- Заявки на восстановление пароля ----------

export const passwordResets = mysqlTable("password_resets", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["pending", "done", "rejected"])
    .default("pending")
    .notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ---------- Настройки магазина (key-value) ----------

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: text("value"),
});

// ---------- Журнал административных действий ----------

export const adminLogs = mysqlTable("admin_logs", {
  id: serial("id").primaryKey(),
  userId: bigint("userId", { mode: "number", unsigned: true }),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 255 }).notNull(),
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ---------- Подписка на новости ----------

export const newsletterSubs = mysqlTable("newsletter_subs", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ---------- Контактные сообщения ----------

export const contactMessages = mysqlTable("contact_messages", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  contact: varchar("contact", { length: 255 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
