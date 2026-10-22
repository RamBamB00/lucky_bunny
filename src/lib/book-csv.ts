// Шаблон CSV для импорта каталога и вспомогательные функции работы с файлом.

const HEADER =
  "isbn;title;author;publisher;category;language;year;pages;binding;ageGroup;description;priceRetail;priceWholesale;wholesaleMinQty;salePrice;stock;coverUrl;isNew;isBestseller;isRecommended;isActive";

const EXAMPLES = [
  "978-5-17-090006-2;Маленький принц;Антуан де Сент-Экзюпери;АСТ;Классика;Русский;2022;96;Твёрдый;6+;Философская сказка о дружбе и ответственности;3500;2800;10;;25;https://example.com/covers/prince.jpg;да;нет;да;да",
  "978-601-7000-01-5;Алиса в Стране чудес;Льюис Кэрролл;Самокат;Сказки;Русский;2021;160;Твёрдый;6+;\"Приключения Алисы, которая упала в кроличью нору\";4200;;;3900;12;;нет;да;нет;да",
];

export const BOOK_CSV_TEMPLATE = [HEADER, ...EXAMPLES].join("\r\n") + "\r\n";

export function downloadBookCsvTemplate() {
  // BOM нужен, чтобы Excel правильно открыл кириллицу
  const blob = new Blob(["\uFEFF" + BOOK_CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "books-import-template.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Excel в русской Windows часто сохраняет CSV в windows-1251 — пробуем UTF-8, затем 1251
export async function readCsvFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    return new TextDecoder("windows-1251").decode(buf);
  }
}
