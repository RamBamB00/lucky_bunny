import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { Heart, Minus, Plus, ShoppingBasket, Star } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { SectionTitle } from "@/components/Shared";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useCart } from "@/providers/cart";
import { useFavorites } from "@/providers/favorites";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatPrice } from "@/lib/format";

function ReviewForm({ bookId, onDone }: { bookId: number; onDone: () => void }) {
  const { user } = useAuth();
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [name, setName] = useState(user?.name ?? "");
  const create = trpc.catalog.createReview.useMutation({
    onSuccess: (r) => {
      toast.success(r.message);
      setText("");
      onDone();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate({ bookId, rating, text, authorName: name || "Гость" });
  };

  return (
    <form onSubmit={submit} className="card-lb mt-4 p-4">
      <p className="mb-2 text-sm font-bold">Оставить отзыв</p>
      <div className="mb-2 flex gap-1" role="radiogroup" aria-label="Оценка">
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRating(s)}
            aria-label={`${s} из 5`}
            aria-pressed={rating === s}
            className="min-h-11 min-w-11"
          >
            <Star className={`h-6 w-6 ${s <= rating ? "fill-[#FFB583] text-[#E8A04C]" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ваше имя"
        required
        className="mb-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Расскажите, как вам книга"
        required
        minLength={3}
        rows={3}
        className="mb-2 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <p className="mb-2 text-xs text-muted-foreground">Отзыв появится на сайте после проверки модератором.</p>
      <Button type="submit" disabled={create.isPending} className="rounded-full">Отправить</Button>
    </form>
  );
}

export default function BookPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = trpc.catalog.bySlug.useQuery({ slug: slug ?? "" }, { enabled: !!slug });
  const cart = useCart();
  const fav = useFavorites();
  const { isAuthenticated } = useAuth();
  const [qty, setQty] = useState(1);

  if (isLoading) {
    return (
      <Layout>
        <div className="container-lb grid gap-8 py-8 md:grid-cols-2">
          <Skeleton className="aspect-[2/3] w-full max-w-md rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <div className="container-lb py-16 text-center">
          <h1 className="text-2xl">Книга не найдена</h1>
          <p className="mt-2 text-muted-foreground">Возможно, она была снята с продажи.</p>
          <Link to="/catalog" className="btn-press mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            В каталог
          </Link>
        </div>
      </Layout>
    );
  }

  const { book, category, similar, reviews, wholesaleTiers } = data;
  const price = book.salePrice ?? book.priceRetail;
  const discount = book.salePrice ? Math.round((1 - book.salePrice / book.priceRetail) * 100) : 0;
  const outOfStock = book.stock <= 0;
  const isFav = fav.has(book.id);

  const specs: [string, string | number | null | undefined][] = [
    ["Автор", book.author],
    ["Издательство", book.publisher],
    ["ISBN", book.isbn],
    ["Язык", book.language],
    ["Год издания", book.year],
    ["Страниц", book.pages],
    ["Переплёт", book.binding],
    ["Возраст", book.ageGroup],
  ];

  return (
    <Layout>
      <div className="container-lb py-6">
        <nav aria-label="Хлебные крошки" className="mb-4 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary">Главная</Link>
          <span className="mx-1">/</span>
          <Link to="/catalog" className="hover:text-primary">Каталог</Link>
          {category && (
            <>
              <span className="mx-1">/</span>
              <Link to={`/catalog?category=${category.slug}`} className="hover:text-primary">{category.name}</Link>
            </>
          )}
          <span className="mx-1">/</span>
          <span aria-current="page" className="text-foreground">{book.title}</span>
        </nav>

        <div className="grid gap-8 md:grid-cols-[minmax(0,420px)_1fr]">
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {book.coverUrl ? (
              <img src={book.coverUrl} alt={`Обложка: ${book.title}`} className="w-full object-cover" />
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center p-8 text-center font-display">{book.title}</div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap gap-2">
              {book.isNew && <span className="badge-sticker border-primary bg-secondary">Новинка</span>}
              {book.isBestseller && <span className="badge-sticker border-[#E8A04C] bg-[#FFB583]">Бестселлер</span>}
              {book.isDemo && <span className="badge-sticker border-border bg-card text-muted-foreground normal-case tracking-normal">Демонстрационный товар</span>}
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl">{book.title}</h1>
            {book.author && <p className="mt-1 text-lg text-muted-foreground">{book.author}</p>}

            <div className="mt-5 flex flex-wrap items-center gap-4">
              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-extrabold">{formatPrice(price)}</span>
                  {book.salePrice && <span className="text-lg text-muted-foreground line-through">{formatPrice(book.priceRetail)}</span>}
                  {discount > 0 && <span className="badge-sticker border-[#D96A68] bg-[#F28482] text-white">−{discount}%</span>}
                </div>
                <p className={`mt-1 text-sm font-semibold ${outOfStock ? "text-destructive" : "text-primary"}`}>
                  {outOfStock ? "Нет в наличии" : `В наличии: ${book.stock} шт.`}
                </p>
              </div>
            </div>

            {/* Оптовые уровни — только для одобренных оптовиков */}
            {wholesaleTiers.length > 0 && (
              <div className="mt-4 rounded-2xl bg-secondary p-4">
                <p className="text-sm font-bold">Оптовые цены (ваш уровень)</p>
                <ul className="mt-1 space-y-1 text-sm">
                  {wholesaleTiers.map((t) => (
                    <li key={t.minQty}>от {t.minQty} шт. — <b>{formatPrice(t.price)}</b> за экземпляр</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-full border border-input bg-card">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex min-h-11 min-w-11 items-center justify-center"
                  aria-label="Уменьшить количество"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-10 text-center font-bold" aria-live="polite">{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(book.stock || 1, q + 1))}
                  className="flex min-h-11 min-w-11 items-center justify-center"
                  aria-label="Увеличить количество"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <button
                disabled={outOfStock}
                onClick={() => {
                  cart.add(book.id, qty);
                  toast.success(`«${book.title}» (${qty} шт.) — в корзине`);
                }}
                className="btn-press flex min-h-11 items-center gap-2 rounded-full bg-primary px-8 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                <ShoppingBasket className="h-4 w-4" aria-hidden /> В корзину
              </button>
              <button
                onClick={() => fav.toggle(book.id)}
                aria-pressed={isFav}
                className="btn-press flex min-h-11 items-center gap-2 rounded-full border border-input bg-card px-6 py-3 text-sm font-bold hover:bg-accent"
              >
                <Heart className={`h-4 w-4 ${isFav ? "fill-[#F28482] text-[#F28482]" : ""}`} aria-hidden />
                {isFav ? "В избранном" : "В избранное"}
              </button>
            </div>

            {book.description && (
              <div className="mt-8">
                <h2 className="mb-2 text-lg">О книге</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">{book.description}</p>
              </div>
            )}

            <div className="mt-6">
              <h2 className="mb-2 text-lg">Характеристики</h2>
              <dl className="divide-y divide-border rounded-2xl border border-border bg-card">
                {specs.filter(([, v]) => v != null && v !== "").map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>

        {/* Похожие книги */}
        {similar.length > 0 && (
          <section className="mt-14">
            <SectionTitle title="Похожие книги" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {similar.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
          </section>
        )}

        {/* Отзывы */}
        <section className="mt-14 max-w-2xl">
          <SectionTitle title={`Отзывы${reviews.length ? ` (${reviews.length})` : ""}`} />
          {reviews.length === 0 ? (
            <p className="text-sm text-muted-foreground">Отзывов пока нет — ваш может стать первым.</p>
          ) : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="card-lb p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold">{r.authorName}</p>
                    <div className="flex" aria-label={`Оценка ${r.rating} из 5`}>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star key={s} className={`h-4 w-4 ${s <= r.rating ? "fill-[#FFB583] text-[#E8A04C]" : "text-muted"}`} />
                      ))}
                    </div>
                  </div>
                  <p className="mt-1 text-sm">{r.text}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
          {isAuthenticated ? (
            <ReviewForm bookId={book.id} onDone={() => {}} />
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">
              <Link to="/login" className="font-bold text-primary hover:underline">Войдите</Link>, чтобы оставить отзыв.
            </p>
          )}
        </section>
      </div>
    </Layout>
  );
}
