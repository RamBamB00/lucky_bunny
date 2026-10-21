// Наполнение магазина стартовыми данными: категории, демо-книги, настройки, промокод, баннер.
// Запуск: npx tsx db/seed.ts
import "dotenv/config";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { eq } from "drizzle-orm";
import { getDb } from "../api/queries/connection";
import { books, categories, settings, promocodes, banners } from "./schema";
import { slugify } from "../api/lib/slug";

const here = dirname(fileURLToPath(import.meta.url));
const demoBooks = JSON.parse(readFileSync(join(here, "../scripts/demo-books.json"), "utf-8"));

async function main() {
  const db = getDb();

  // Категории
  const catNames = ["Сказки", "Познавательное", "Развитие", "Художественная", "Иностранные языки"];
  const catIds = new Map<string, number>();
  for (const [i, name] of catNames.entries()) {
    const slug = slugify(name);
    const existing = await db.select().from(categories).where(eq(categories.slug, slug)).limit(1).then((r) => r.at(0));
    if (existing) catIds.set(name, existing.id);
    else {
      const [{ id }] = await db.insert(categories).values({ name, slug, sortOrder: i }).$returningId();
      catIds.set(name, id);
    }
  }

  // Демо-книги
  for (const b of demoBooks) {
    const existing = await db.select({ id: books.id }).from(books).where(eq(books.slug, b.slug)).limit(1).then((r) => r.at(0));
    if (existing) continue;
    await db.insert(books).values({
      isbn: b.isbn,
      slug: b.slug,
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      description: b.description,
      categoryId: catIds.get(b.category) ?? null,
      language: b.language,
      year: b.year,
      pages: b.pages,
      binding: b.binding,
      ageGroup: b.ageGroup,
      coverUrl: `/covers/${b.slug}.svg`,
      priceRetail: b.priceRetail,
      priceWholesale: b.priceWholesale ?? null,
      wholesaleMinQty: b.wholesaleMinQty ?? null,
      salePrice: b.salePrice ?? null,
      stock: b.stock,
      isNew: !!b.isNew,
      isBestseller: !!b.isBestseller,
      isRecommended: !!b.isRecommended,
      isActive: true,
      isDemo: true,
    });
  }

  // Настройки по умолчанию
  const defaults: Record<string, string> = {
    topBarText: "Бесплатная доставка при заказе от 15 000 ₸",
    contacts: JSON.stringify({
      phone: "+7 (700) 000-00-00",
      email: "hello@luckybunny.kz",
      whatsapp: "",
      address: "г. Алматы, укажите адрес в настройках",
      instagram: "",
    }),
    freeDeliveryFrom: "15000",
    minWholesaleOrder: "50000",
    wholesaleText:
      "Мы работаем с книжными магазинами, детскими садами, школами и корпоративными клиентами.\n\nОптовые условия:\n— специальные цены при заказе от минимального количества экземпляров;\n— индивидуальные ценовые уровни для крупных объёмов;\n— минимальная сумма оптового заказа устанавливается администратором магазина;\n— отгрузка со склада в течение 1–3 рабочих дней после подтверждения.\n\nЧтобы получить доступ к оптовым ценам, зарегистрируйтесь как оптовый покупатель — заявка будет проверена администратором.",
    pageDelivery:
      "Доставка\n\n— Курьерская доставка по городу: 1–2 дня.\n— Самовывоз из пункта выдачи: в день заказа.\n— Почтовая доставка по Казахстану: 3–7 дней.\n\nБесплатная доставка действует при заказе от установленной суммы (см. верхнюю строку сайта).\n\nОплата\n\n— Наличными курьеру или при самовывозе.\n— Переводом на карту Kaspi / Halyk после подтверждения заказа.\n\nТочные сроки и стоимость уточняет менеджер при подтверждении заказа.",
    pageReturns:
      "Возврат и обмен\n\nВы можете вернуть или обменять книгу надлежащего качества в течение 14 дней с момента получения, если сохранены товарный вид и упаковка.\n\nДля оформления возврата свяжитесь с нами по контактам, указанным на сайте, и назовите номер заказа.",
    pageTerms:
      "Условия покупки\n\nОформляя заказ, вы соглашаетесь с условиями продажи товаров в интернет-магазине Lucky Bunny. Цены и наличие указаны на момент оформления заказа и проверяются при подтверждении.\n\nПерсональные данные используются только для обработки заказов и не передаются третьим лицам.",
    aboutText:
      "Lucky Bunny — независимый книжный магазин детской и художественной литературы. Мы отбираем книги, которые хочется читать всей семьёй, и доставляем их по всему Казахстану.",
  };
  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.select().from(settings).where(eq(settings.key, key)).limit(1).then((r) => r.at(0));
    if (!existing) await db.insert(settings).values({ key, value });
  }

  // Промокод
  const promo = await db.select().from(promocodes).where(eq(promocodes.code, "WELCOME10")).limit(1).then((r) => r.at(0));
  if (!promo) {
    await db.insert(promocodes).values({ code: "WELCOME10", discountPercent: 10, minSubtotal: 5000, isActive: true });
  }

  // Баннер
  const existingBanner = await db.select().from(banners).limit(1).then((r) => r.at(0));
  if (!existingBanner) {
    await db.insert(banners).values({
      title: "Книги, с которыми тепло",
      subtitle: "Детские сказки, энциклопедии и художественная литература — с доставкой по Казахстану",
      link: "/catalog",
      bgColor: "#B9E4C9",
      isActive: true,
      sortOrder: 0,
    });
  }

  console.log("Seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
