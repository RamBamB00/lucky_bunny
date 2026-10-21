import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/Shared";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AGE_GROUPS, LANGUAGES } from "@contracts/shop";

const SORTS = [
  { value: "popular", label: "По популярности" },
  { value: "new", label: "Сначала новые" },
  { value: "price_asc", label: "Цена: по возрастанию" },
  { value: "price_desc", label: "Цена: по убыванию" },
  { value: "title", label: "По названию" },
] as const;

const FLAG_LABELS: Record<string, string> = {
  new: "Новинки",
  bestseller: "Бестселлеры",
  recommended: "Рекомендуем",
  sale: "Акции и скидки",
};

function FilterPanel({
  searchParams,
  setParam,
  toggleArrayParam,
}: {
  searchParams: URLSearchParams;
  setParam: (k: string, v: string | null) => void;
  toggleArrayParam: (k: string, v: string) => void;
}) {
  const { data: categories } = trpc.catalog.categories.useQuery();
  const { data: facets } = trpc.catalog.facets.useQuery();

  const activeAuthors = searchParams.get("authors")?.split("|").filter(Boolean) ?? [];
  const activePublishers = searchParams.get("publishers")?.split("|").filter(Boolean) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-bold">Категория</p>
        <div className="flex flex-col gap-1">
          <button
            onClick={() => setParam("category", null)}
            className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${!searchParams.get("category") ? "bg-secondary font-bold" : ""}`}
          >
            Все категории
          </button>
          {categories?.map((c) => (
            <button
              key={c.id}
              onClick={() => setParam("category", c.slug)}
              className={`rounded-lg px-3 py-2 text-left text-sm hover:bg-muted ${searchParams.get("category") === c.slug ? "bg-secondary font-bold" : ""}`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">Цена, ₸</p>
        <div className="flex gap-2">
          <input
            type="number"
            inputMode="numeric"
            placeholder="от"
            defaultValue={searchParams.get("minPrice") ?? ""}
            onBlur={(e) => setParam("minPrice", e.target.value || null)}
            className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Цена от"
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="до"
            defaultValue={searchParams.get("maxPrice") ?? ""}
            onBlur={(e) => setParam("maxPrice", e.target.value || null)}
            className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Цена до"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">Возраст</p>
        <div className="flex flex-wrap gap-2">
          {AGE_GROUPS.map((a) => (
            <button
              key={a}
              onClick={() => setParam("age", searchParams.get("age") === a ? null : a)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                searchParams.get("age") === a ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold">Язык</p>
        <div className="flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <button
              key={l}
              onClick={() => setParam("language", searchParams.get("language") === l ? null : l)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${
                searchParams.get("language") === l ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {facets && facets.authors.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold">Авторы</summary>
          <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
            {facets.authors.map((a) => (
              <label key={a} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={activeAuthors.includes(a)}
                  onChange={() => toggleArrayParam("authors", a)}
                  className="h-4 w-4 accent-[#5E8C7B]"
                />
                {a}
              </label>
            ))}
          </div>
        </details>
      )}

      {facets && facets.publishers.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-bold">Издательства</summary>
          <div className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto pr-1">
            {facets.publishers.map((p) => (
              <label key={p} className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm hover:bg-muted">
                <input
                  type="checkbox"
                  checked={activePublishers.includes(p)}
                  onChange={() => toggleArrayParam("publishers", p)}
                  className="h-4 w-4 accent-[#5E8C7B]"
                />
                {p}
              </label>
            ))}
          </div>
        </details>
      )}

      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
        <input
          type="checkbox"
          checked={searchParams.get("inStock") === "1"}
          onChange={(e) => setParam("inStock", e.target.checked ? "1" : null)}
          className="h-4 w-4 accent-[#5E8C7B]"
        />
        Только в наличии
      </label>
    </div>
  );
}

export default function Catalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const queryInput = useMemo(() => {
    const flag = searchParams.get("flag");
    return {
      search: searchParams.get("search") ?? undefined,
      categorySlug: searchParams.get("category") ?? undefined,
      authors: searchParams.get("authors")?.split("|").filter(Boolean) || undefined,
      publishers: searchParams.get("publishers")?.split("|").filter(Boolean) || undefined,
      minPrice: searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined,
      maxPrice: searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined,
      ageGroup: searchParams.get("age") ?? undefined,
      language: searchParams.get("language") ?? undefined,
      inStockOnly: searchParams.get("inStock") === "1",
      flag: (flag === "new" || flag === "bestseller" || flag === "recommended" || flag === "sale" ? flag : undefined) as
        | "new" | "bestseller" | "recommended" | "sale" | undefined,
      sort: (searchParams.get("sort") as "popular" | "new" | "price_asc" | "price_desc" | "title") ?? "popular",
      page: Number(searchParams.get("page") ?? "1"),
      pageSize: 12,
    };
  }, [searchParams]);

  const { data, isLoading, isFetching } = trpc.catalog.list.useQuery(queryInput);

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value == null) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setSearchParams(next, { preventScrollReset: true });
  };

  const toggleArrayParam = (key: string, value: string) => {
    const current = searchParams.get(key)?.split("|").filter(Boolean) ?? [];
    const nextArr = current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
    setParam(key, nextArr.length ? nextArr.join("|") : null);
  };

  const resetFilters = () => setSearchParams(new URLSearchParams(), { preventScrollReset: true });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const flagLabel = queryInput.flag ? FLAG_LABELS[queryInput.flag] : null;
  const hasFilters =
    searchParams.toString().length > 0 &&
    ![...searchParams.keys()].every((k) => k === "sort" || k === "page");

  return (
    <Layout>
      <div className="container-lb py-6">
        {/* Хлебные крошки */}
        <nav aria-label="Хлебные крошки" className="mb-3 text-sm text-muted-foreground">
          <a href="/" className="hover:text-primary">Главная</a>
          <span className="mx-1">/</span>
          <span aria-current="page">Каталог</span>
        </nav>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl">
            {flagLabel ?? (queryInput.search ? `Поиск: «${queryInput.search}»` : "Каталог книг")}
          </h1>
          <div className="flex items-center gap-2">
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="min-h-11 rounded-full lg:hidden">
                  <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden /> Фильтры
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto bg-card">
                <SheetTitle className="mb-4 font-display text-lg">Фильтры</SheetTitle>
                <FilterPanel searchParams={searchParams} setParam={setParam} toggleArrayParam={toggleArrayParam} />
                {hasFilters && (
                  <Button variant="outline" className="mt-4 w-full" onClick={() => { resetFilters(); setFiltersOpen(false); }}>
                    Сбросить фильтры
                  </Button>
                )}
              </SheetContent>
            </Sheet>

            <label className="sr-only" htmlFor="sort">Сортировка</label>
            <select
              id="sort"
              value={queryInput.sort}
              onChange={(e) => setParam("sort", e.target.value)}
              className="min-h-11 rounded-full border border-input bg-card px-4 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Фильтры десктоп */}
          <aside className="hidden lg:block">
            <div className="card-lb sticky top-40 p-4">
              <FilterPanel searchParams={searchParams} setParam={setParam} toggleArrayParam={toggleArrayParam} />
              {hasFilters && (
                <Button variant="outline" size="sm" className="mt-4 w-full" onClick={resetFilters}>
                  Сбросить фильтры
                </Button>
              )}
            </div>
          </aside>

          <div>
            {data && (
              <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
                Найдено: {data.total} {isFetching && "· обновляем…"}
              </p>
            )}

            {isLoading ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[2/3.6] w-full rounded-2xl" />
                ))}
              </div>
            ) : data && data.items.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                {data.items.map((b) => (
                  <BookCard key={b.id} book={b} />
                ))}
              </div>
            ) : (
              <EmptyState
                title="Ничего не нашлось"
                hint="Попробуйте изменить запрос или сбросить фильтры — возможно, книга прячется за одним из них."
                actionTo={hasFilters ? undefined : "/catalog"}
                actionLabel={hasFilters ? undefined : "Весь каталог"}
              />
            )}

            {/* Пагинация */}
            {totalPages > 1 && (
              <nav aria-label="Страницы каталога" className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 rounded-full"
                  disabled={queryInput.page <= 1}
                  onClick={() => setParam("page", String(queryInput.page - 1))}
                  aria-label="Предыдущая страница"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setParam("page", String(i + 1))}
                    aria-current={queryInput.page === i + 1 ? "page" : undefined}
                    className={`min-h-11 min-w-11 rounded-full text-sm font-bold ${
                      queryInput.page === i + 1 ? "bg-primary text-primary-foreground" : "bg-card border border-input hover:bg-muted"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  className="min-h-11 min-w-11 rounded-full"
                  disabled={queryInput.page >= totalPages}
                  onClick={() => setParam("page", String(queryInput.page + 1))}
                  aria-label="Следующая страница"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </nav>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
