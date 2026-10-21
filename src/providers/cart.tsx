import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type CartLine = { bookId: number; qty: number };

type CartContextValue = {
  items: CartLine[];
  count: number;
  add: (bookId: number, qty?: number) => void;
  setQty: (bookId: number, qty: number) => void;
  remove: (bookId: number) => void;
  clear: () => void;
  clearLocal: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const LS_KEY = "lb_cart";

function readLocal(): CartLine[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (i): i is CartLine =>
          typeof i?.bookId === "number" && typeof i?.qty === "number" && i.qty > 0,
      )
      .map((i) => ({ bookId: i.bookId, qty: Math.min(999, Math.floor(i.qty)) }));
  } catch {
    return [];
  }
}

/**
 * Корзина хранится только в браузере (localStorage) — для гостей и
 * для вошедших пользователей одинаково. Оформление идёт через WhatsApp.
 */
export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => readLocal());

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(items));
    } catch {
      /* хранилище недоступно — корзина живёт только до перезагрузки */
    }
  }, [items]);

  // Синхронизация между вкладками
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY) setItems(readLocal());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((bookId: number, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.bookId === bookId);
      if (found) {
        return prev.map((i) => (i.bookId === bookId ? { ...i, qty: Math.min(999, i.qty + qty) } : i));
      }
      return [...prev, { bookId, qty: Math.min(999, qty) }];
    });
  }, []);

  const setQty = useCallback((bookId: number, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => i.bookId !== bookId)
        : prev.map((i) => (i.bookId === bookId ? { ...i, qty: Math.min(999, qty) } : i)),
    );
  }, []);

  const remove = useCallback((bookId: number) => {
    setItems((prev) => prev.filter((i) => i.bookId !== bookId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.qty, 0),
      add,
      setQty,
      remove,
      clear,
      clearLocal: clear,
    }),
    [items, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
