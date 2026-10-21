import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";

type FavContextValue = {
  ids: Set<number>;
  count: number;
  toggle: (bookId: number) => void;
  has: (bookId: number) => boolean;
};

const FavContext = createContext<FavContextValue | null>(null);
const LS_KEY = "lb_fav";

function readLocal(): number[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "number") : [];
  } catch {
    return [];
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [local, setLocal] = useState<number[]>(() => readLocal());
  const utils = trpc.useUtils();

  const serverIds = trpc.favorites.ids.useQuery(undefined, { enabled: isAuthenticated });
  const toggleMutation = trpc.favorites.toggle.useMutation({
    onSuccess: () => utils.favorites.ids.invalidate(),
  });
  const mergeMutation = trpc.favorites.merge.useMutation();

  useEffect(() => {
    if (isAuthenticated) {
      const guest = readLocal();
      if (guest.length > 0) {
        mergeMutation.mutate(
          { bookIds: guest },
          { onSuccess: () => { localStorage.removeItem(LS_KEY); setLocal([]); utils.favorites.ids.invalidate(); } },
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) localStorage.setItem(LS_KEY, JSON.stringify(local));
  }, [local, isAuthenticated]);

  const value = useMemo<FavContextValue>(() => {
    if (isAuthenticated) {
      const ids = new Set(serverIds.data ?? []);
      return {
        ids,
        count: ids.size,
        has: (id) => ids.has(id),
        toggle: (bookId) => toggleMutation.mutate({ bookId }),
      };
    }
    const ids = new Set(local);
    return {
      ids,
      count: ids.size,
      has: (id) => ids.has(id),
      toggle: (bookId) =>
        setLocal((prev) => (prev.includes(bookId) ? prev.filter((x) => x !== bookId) : [...prev, bookId])),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, serverIds.data, local]);

  return <FavContext.Provider value={value}>{children}</FavContext.Provider>;
}

export function useFavorites() {
  const ctx = useContext(FavContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
