import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { EmptyState } from "@/components/Shared";
import { useAuth } from "@/hooks/useAuth";
import { useFavorites } from "@/providers/favorites";
import { Skeleton } from "@/components/ui/skeleton";

export default function Favorites() {
  const { isAuthenticated } = useAuth();
  const fav = useFavorites();
  const ids = [...fav.ids];

  const serverList = trpc.favorites.list.useQuery(undefined, { enabled: isAuthenticated });
  const guestBooks = trpc.catalog.byIds.useQuery({ ids }, { enabled: !isAuthenticated && ids.length > 0 });

  const loading = isAuthenticated ? serverList.isLoading : guestBooks.isLoading;
  const books = isAuthenticated
    ? (serverList.data ?? []).map((f) => ({
        id: f.bookId, slug: f.slug, title: f.title, author: f.author,
        coverUrl: f.coverUrl, priceRetail: f.priceRetail, salePrice: f.salePrice, stock: f.stock,
      }))
    : (guestBooks.data ?? []);

  return (
    <Layout>
      <div className="container-lb py-6">
        <h1 className="mb-6 text-2xl sm:text-3xl">Избранное</h1>
        {loading ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3.6] w-full rounded-2xl" />)}
          </div>
        ) : books.length === 0 ? (
          <EmptyState
            title="В избранном пусто"
            hint="Нажимайте на сердечко у книг, чтобы сохранить их здесь."
            actionTo="/catalog"
            actionLabel="В каталог"
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {books.map((b) => <BookCard key={b.id} book={b} />)}
          </div>
        )}
      </div>
    </Layout>
  );
}
