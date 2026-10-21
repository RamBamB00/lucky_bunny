import { Link } from "react-router";
import { Heart, ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/providers/cart";
import { useFavorites } from "@/providers/favorites";
import { formatPrice } from "@/lib/format";

export type BookCardData = {
  id: number;
  slug: string;
  title: string;
  author: string | null;
  publisher?: string | null;
  coverUrl: string | null;
  priceRetail: number;
  salePrice: number | null;
  stock: number;
  isNew?: boolean;
  isBestseller?: boolean;
  isDemo?: boolean;
  wholesaleFrom?: number | null;
};

export function BookCard({ book }: { book: BookCardData }) {
  const cart = useCart();
  const fav = useFavorites();
  const price = book.salePrice ?? book.priceRetail;
  const discount = book.salePrice ? Math.round((1 - book.salePrice / book.priceRetail) * 100) : 0;
  const outOfStock = book.stock <= 0;
  const isFav = fav.has(book.id);

  return (
    <article className="group relative flex flex-col card-lb overflow-hidden transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_8px_24px_rgba(46,42,37,0.12)]">
      <Link to={`/book/${book.slug}`} className="relative block bg-muted" aria-label={book.title}>
        <div className="aspect-[2/3] w-full overflow-hidden">
          {book.coverUrl ? (
            <img
              src={book.coverUrl}
              alt={`Обложка: ${book.title}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center p-4 text-center font-display text-sm text-muted-foreground">
              {book.title}
            </div>
          )}
        </div>
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {book.isNew && <span className="badge-sticker border-primary bg-secondary text-foreground">Новинка</span>}
          {book.isBestseller && <span className="badge-sticker border-[#E8A04C] bg-[#FFB583] text-foreground">Бестселлер</span>}
          {discount > 0 && <span className="badge-sticker border-[#D96A68] bg-[#F28482] text-white">−{discount}%</span>}
          {book.isDemo && <span className="badge-sticker border-border bg-card text-muted-foreground normal-case tracking-normal">Демо</span>}
        </div>
      </Link>

      <button
        onClick={() => fav.toggle(book.id)}
        aria-label={isFav ? "Убрать из избранного" : "В избранное"}
        aria-pressed={isFav}
        className="absolute right-2 top-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-card/90 shadow-sm transition-colors hover:bg-accent"
      >
        <Heart className={`h-5 w-5 ${isFav ? "fill-[#F28482] text-[#F28482]" : "text-foreground"}`} aria-hidden />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3">
        {book.author && <p className="truncate text-xs text-muted-foreground">{book.author}</p>}
        <h3 className="font-sans text-sm font-bold leading-snug">
          <Link to={`/book/${book.slug}`} className="line-clamp-2 hover:text-primary">
            {book.title}
          </Link>
        </h3>

        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-extrabold">{formatPrice(price)}</span>
            {book.salePrice && (
              <span className="text-xs text-muted-foreground line-through">{formatPrice(book.priceRetail)}</span>
            )}
          </div>
          {book.wholesaleFrom != null && (
            <p className="mt-0.5 text-xs font-semibold text-primary">опт от {formatPrice(book.wholesaleFrom)}</p>
          )}
          <p className={`mt-0.5 text-xs ${outOfStock ? "text-destructive" : "text-muted-foreground"}`}>
            {outOfStock ? "Нет в наличии" : `В наличии: ${book.stock} шт.`}
          </p>
          <button
            disabled={outOfStock}
            onClick={() => {
              cart.add(book.id, 1);
              toast.success(`«${book.title}» — в корзине`);
            }}
            className="btn-press mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ShoppingBasket className="h-4 w-4" aria-hidden />
            {outOfStock ? "Нет в наличии" : "В корзину"}
          </button>
        </div>
      </div>
    </article>
  );
}
