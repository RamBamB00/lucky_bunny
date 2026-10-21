import { useEffect, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useCart } from "@/providers/cart";

export type CartLineDetailed = {
  bookId: number;
  qty: number;
  title: string;
  author: string | null;
  slug: string;
  coverUrl: string | null;
  unitPrice: number;
  stock: number;
  isActive?: boolean;
};

/** Данные книг из корзины (корзина локальная, детали подтягиваются по id). */
export function useCartDetailed() {
  const cart = useCart();
  const ids = cart.items.map((i) => i.bookId);

  const books = trpc.catalog.byIds.useQuery({ ids }, { enabled: ids.length > 0 });

  const lines = useMemo<CartLineDetailed[]>(() => {
    const map = new Map((books.data ?? []).map((b) => [b.id, b]));
    return cart.items
      .map((i) => {
        const b = map.get(i.bookId);
        if (!b) return null;
        return {
          bookId: b.id,
          qty: i.qty,
          title: b.title,
          author: b.author,
          slug: b.slug,
          coverUrl: b.coverUrl,
          unitPrice: b.salePrice ?? b.priceRetail,
          stock: b.stock,
          isActive: b.isActive,
        } as CartLineDetailed;
      })
      .filter((x): x is CartLineDetailed => x !== null);
  }, [books.data, cart.items]);

  // Книги, которые удалены или скрыты, убираем из корзины
  useEffect(() => {
    if (!books.data) return;
    const known = new Set(books.data.map((b) => b.id));
    cart.items.forEach((i) => {
      if (!known.has(i.bookId)) cart.remove(i.bookId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.data]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const loading = ids.length > 0 && books.isLoading;

  return { lines, subtotal, loading };
}
