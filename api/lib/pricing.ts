import type { Book, WholesaleTier } from "@db/schema";

// Единая серверная логика ценообразования.
// Клиенту нельзя доверять — цены всегда считаются здесь.
export function priceForBook(
  book: Book,
  tiers: WholesaleTier[],
  qty: number,
  isWholesaleApproved: boolean,
): { unitPrice: number; isWholesale: boolean } {
  const retail = book.salePrice ?? book.priceRetail;

  if (!isWholesaleApproved) {
    return { unitPrice: retail, isWholesale: false };
  }

  // Лучший подходящий уровень оптовой цены
  const applicable = tiers
    .filter((t) => t.bookId === book.id && qty >= t.minQty)
    .sort((a, b) => b.minQty - a.minQty);
  if (applicable.length > 0) {
    return { unitPrice: applicable[0].price, isWholesale: true };
  }

  if (
    book.priceWholesale != null &&
    book.wholesaleMinQty != null &&
    qty >= book.wholesaleMinQty
  ) {
    return { unitPrice: book.priceWholesale, isWholesale: true };
  }

  return { unitPrice: retail, isWholesale: false };
}

// Оптовая цена «от» для отображения в каталоге (минимальная цена уровня)
export function wholesaleFromPrice(
  book: Book,
  tiers: WholesaleTier[],
): number | null {
  const own = tiers.filter((t) => t.bookId === book.id);
  if (own.length > 0) return Math.min(...own.map((t) => t.price));
  return book.priceWholesale ?? null;
}
