import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/format";
import { AGE_GROUPS, BINDINGS, LANGUAGES } from "@contracts/shop";
import { downloadBookCsvTemplate } from "@/lib/book-csv";
import ImportBooksDialog from "./ImportBooksDialog";

type Tier = { minQty: number; price: number };

type BookForm = {
  title: string; isbn: string; author: string; publisher: string; description: string;
  categoryId: string; language: string; year: string; pages: string; binding: string;
  ageGroup: string; coverUrl: string; priceRetail: string; priceWholesale: string;
  wholesaleMinQty: string; salePrice: string; stock: string;
  isNew: boolean; isBestseller: boolean; isRecommended: boolean; isActive: boolean;
};

const EMPTY: BookForm = {
  title: "", isbn: "", author: "", publisher: "", description: "", categoryId: "",
  language: "Русский", year: "", pages: "", binding: "Твёрдый", ageGroup: "",
  coverUrl: "", priceRetail: "", priceWholesale: "", wholesaleMinQty: "", salePrice: "",
  stock: "0", isNew: false, isBestseller: false, isRecommended: false, isActive: true,
};

function BookEditor({
  open, onClose, bookId, onSaved,
}: { open: boolean; onClose: () => void; bookId: number | null; onSaved: () => void }) {
  const [form, setForm] = useState<BookForm>(EMPTY);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const { data: categories } = trpc.adminCatalog.listCategories.useQuery();
  const { data: existing } = trpc.adminCatalog.getBook.useQuery({ id: bookId ?? 0 }, { enabled: bookId != null });

  useEffect(() => {
    if (!open) return;
    if (existing && bookId != null) {
      const b = existing.book;
      setForm({
        title: b.title, isbn: b.isbn ?? "", author: b.author ?? "", publisher: b.publisher ?? "",
        description: b.description ?? "", categoryId: b.categoryId ? String(b.categoryId) : "",
        language: b.language ?? "Русский", year: b.year ? String(b.year) : "",
        pages: b.pages ? String(b.pages) : "", binding: b.binding ?? "", ageGroup: b.ageGroup ?? "",
        coverUrl: b.coverUrl ?? "", priceRetail: String(b.priceRetail),
        priceWholesale: b.priceWholesale != null ? String(b.priceWholesale) : "",
        wholesaleMinQty: b.wholesaleMinQty != null ? String(b.wholesaleMinQty) : "",
        salePrice: b.salePrice != null ? String(b.salePrice) : "",
        stock: String(b.stock), isNew: b.isNew, isBestseller: b.isBestseller,
        isRecommended: b.isRecommended, isActive: b.isActive,
      });
      setTiers(existing.tiers.map((t) => ({ minQty: t.minQty, price: t.price })));
    } else if (bookId == null) {
      setForm(EMPTY);
      setTiers([]);
    }
  }, [open, existing, bookId]);

  const create = trpc.adminCatalog.createBook.useMutation({
    onSuccess: () => { toast.success("Книга добавлена"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.adminCatalog.updateBook.useMutation({
    onSuccess: () => { toast.success("Изменения сохранены"); onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  const num = (v: string) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : null; };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const data = {
      title: form.title, isbn: form.isbn || null, author: form.author || null,
      publisher: form.publisher || null, description: form.description || null,
      categoryId: form.categoryId ? Number(form.categoryId) : null,
      language: form.language || null, year: num(form.year), pages: num(form.pages),
      binding: form.binding || null, ageGroup: form.ageGroup || null,
      coverUrl: form.coverUrl || null,
      priceRetail: num(form.priceRetail) ?? 0,
      priceWholesale: num(form.priceWholesale),
      wholesaleMinQty: num(form.wholesaleMinQty),
      salePrice: num(form.salePrice),
      stock: num(form.stock) ?? 0,
      isNew: form.isNew, isBestseller: form.isBestseller,
      isRecommended: form.isRecommended, isActive: form.isActive,
    };
    if (bookId != null) {
      update.mutate({ id: bookId, data, tiers: tiers.filter((t) => t.minQty > 0) });
    } else {
      create.mutate(data);
    }
  };

  const inp = (label: string, key: keyof BookForm, type = "text", required = false) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}{required && " *"}</span>
      <input
        type={type}
        value={String(form[key])}
        required={required}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );

  const sel = (label: string, key: keyof BookForm, options: readonly string[]) => (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      <select
        value={String(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );

  const flag = (label: string, key: keyof BookForm) => (
    <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        checked={Boolean(form[key])}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
        className="h-4 w-4 accent-[#5E8C7B]"
      />
      {label}
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto bg-card">
        <DialogTitle className="font-display text-xl">{bookId != null ? "Редактировать книгу" : "Новая книга"}</DialogTitle>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {inp("Название", "title", "text", true)}
            {inp("ISBN", "isbn")}
            {inp("Автор", "author")}
            {inp("Издательство", "publisher")}
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Категория</span>
              <select
                value={form.categoryId}
                onChange={(e) => setForm((f) => ({ ...f, categoryId: e.target.value }))}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">—</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            {sel("Язык", "language", LANGUAGES)}
            {inp("Год издания", "year", "number")}
            {inp("Страниц", "pages", "number")}
            {sel("Переплёт", "binding", BINDINGS)}
            {sel("Возраст", "ageGroup", AGE_GROUPS)}
          </div>

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-muted-foreground">Описание</span>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {inp("URL обложки", "coverUrl", "url")}
          {form.coverUrl && (
            <img src={form.coverUrl} alt="Предпросмотр обложки" className="h-40 rounded-xl border border-border object-cover" />
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            {inp("Розничная цена, ₸", "priceRetail", "number", true)}
            {inp("Цена со скидкой, ₸", "salePrice", "number")}
            {inp("Остаток, шт.", "stock", "number")}
            {inp("Оптовая цена, ₸", "priceWholesale", "number")}
            {inp("Мин. кол-во для опта", "wholesaleMinQty", "number")}
          </div>

          {bookId != null && (
            <div className="rounded-2xl border border-border p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold">Оптовые ценовые уровни</p>
                <Button type="button" variant="outline" size="sm" onClick={() => setTiers((t) => [...t, { minQty: 10, price: 0 }])}>
                  <Plus className="mr-1 h-3 w-3" /> Уровень
                </Button>
              </div>
              {tiers.length === 0 && <p className="text-xs text-muted-foreground">Нет уровней — действует базовая оптовая цена.</p>}
              {tiers.map((t, i) => (
                <div key={i} className="mb-2 flex items-center gap-2">
                  <span className="text-xs">от</span>
                  <input
                    type="number" value={t.minQty} min={1}
                    onChange={(e) => setTiers((arr) => arr.map((x, j) => (j === i ? { ...x, minQty: Number(e.target.value) } : x)))}
                    className="min-h-11 w-20 rounded-lg border border-input bg-background px-2 text-sm"
                    aria-label="Минимальное количество"
                  />
                  <span className="text-xs">шт. —</span>
                  <input
                    type="number" value={t.price} min={0}
                    onChange={(e) => setTiers((arr) => arr.map((x, j) => (j === i ? { ...x, price: Number(e.target.value) } : x)))}
                    className="min-h-11 w-28 rounded-lg border border-input bg-background px-2 text-sm"
                    aria-label="Цена за экземпляр"
                  />
                  <span className="text-xs">₸</span>
                  <button type="button" onClick={() => setTiers((arr) => arr.filter((_, j) => j !== i))} aria-label="Удалить уровень"
                    className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {flag("Новинка", "isNew")}
            {flag("Бестселлер", "isBestseller")}
            {flag("Рекомендуем", "isRecommended")}
            {flag("Активна (видна в каталоге)", "isActive")}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={create.isPending || update.isPending} className="rounded-full">
              {bookId != null ? "Сохранить" : "Добавить книгу"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="rounded-full">Отмена</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminBooks() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.adminCatalog.listBooks.useQuery({ search: search || undefined, page, pageSize: 20 });
  const setActive = trpc.adminCatalog.setBookActive.useMutation({
    onSuccess: () => utils.adminCatalog.listBooks.invalidate(),
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.adminCatalog.deleteBook.useMutation({
    onSuccess: () => { toast.success("Книга удалена"); utils.adminCatalog.listBooks.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Товары</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={downloadBookCsvTemplate}>
            <Download className="mr-1 h-4 w-4" /> Скачать шаблон CSV
          </Button>
          <Button variant="outline" className="rounded-full" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" /> Импорт из CSV
          </Button>
          <Button className="rounded-full" onClick={() => { setEditId(null); setEditorOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Добавить книгу
          </Button>
        </div>
      </div>

      <input
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder="Поиск по названию, автору, ISBN"
        aria-label="Поиск товаров"
        className="mb-4 min-h-11 w-full max-w-md rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <div className="card-lb overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-3">Книга</th>
              <th className="p-3">ISBN</th>
              <th className="p-3">Цена</th>
              <th className="p-3">Остаток</th>
              <th className="p-3">Статус</th>
              <th className="p-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загружаем…</td></tr>
            )}
            {data?.items.map((b) => (
              <tr key={b.id} className="border-b border-border/60 last:border-0">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    {b.coverUrl && <img src={b.coverUrl} alt="" className="h-12 w-8 rounded object-cover" loading="lazy" />}
                    <div className="min-w-0">
                      <p className="max-w-56 truncate font-semibold">{b.title}</p>
                      <p className="max-w-56 truncate text-xs text-muted-foreground">
                        {b.author ?? ""} {b.isDemo && "· демо"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-xs">{b.isbn ?? "—"}</td>
                <td className="p-3 font-semibold">
                  {formatPrice(b.salePrice ?? b.priceRetail)}
                  {b.salePrice && <span className="ml-1 text-xs text-muted-foreground line-through">{formatPrice(b.priceRetail)}</span>}
                </td>
                <td className={`p-3 font-semibold ${b.stock <= 0 ? "text-destructive" : ""}`}>{b.stock}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${b.isActive ? "bg-secondary" : "bg-muted text-muted-foreground"}`}>
                    {b.isActive ? "Активна" : "В архиве"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex justify-end gap-1">
                    <button onClick={() => { setEditId(b.id); setEditorOpen(true); }} aria-label="Редактировать"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-muted">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setActive.mutate({ id: b.id, isActive: !b.isActive })}
                      className="min-h-11 rounded-full px-3 text-xs font-semibold hover:bg-muted"
                    >
                      {b.isActive ? "В архив" : "Вернуть"}
                    </button>
                    <button
                      onClick={() => { if (confirm(`Удалить «${b.title}» безвозвратно?`)) del.mutate({ id: b.id }); }}
                      aria-label="Удалить"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
          <span>Стр. {page} из {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Вперёд</Button>
        </div>
      )}

      <ImportBooksDialog open={importOpen} onClose={() => setImportOpen(false)} />

      <BookEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        bookId={editId}
        onSaved={() => utils.adminCatalog.listBooks.invalidate()}
      />
    </div>
  );
}
