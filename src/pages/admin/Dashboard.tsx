import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@contracts/shop";
import { formatDateTime, formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.admin.stats.useQuery();

  if (isLoading || !stats) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>;
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl">Обзор магазина</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Выручка", value: formatPrice(stats.revenue) },
          { label: "Заказы", value: String(stats.orders) },
          { label: "Товаров в каталоге", value: String(stats.books) },
          { label: "Пользователей", value: String(stats.users) },
        ].map((s) => (
          <div key={s.label} className="card-lb p-4">
            <p className="text-xs font-semibold text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-xl font-extrabold sm:text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      {stats.pendingWholesale > 0 && (
        <Link to="/admin/users" className="mt-4 block rounded-2xl bg-accent p-4 text-sm font-bold hover:opacity-90">
          Заявок на оптовый аккаунт: {stats.pendingWholesale} — проверить →
        </Link>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="card-lb p-4">
          <h2 className="mb-3 text-lg">Заказы по статусам</h2>
          <ul className="space-y-2 text-sm">
            {stats.byStatus.map((s) => (
              <li key={s.status} className="flex justify-between">
                <span>{ORDER_STATUS_LABELS[s.status as OrderStatus] ?? s.status}</span>
                <b>{s.count}</b>
              </li>
            ))}
            {stats.byStatus.length === 0 && <li className="text-muted-foreground">Заказов пока нет</li>}
          </ul>
        </div>

        <div className="card-lb p-4">
          <h2 className="mb-3 text-lg">Последние заказы</h2>
          <ul className="space-y-2 text-sm">
            {stats.recent.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2">
                <Link to={`/admin/orders?id=${o.id}`} className="truncate font-semibold hover:text-primary">
                  {o.number} · {o.customerName}
                </Link>
                <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</span>
                <b className="shrink-0">{formatPrice(o.total)}</b>
              </li>
            ))}
            {stats.recent.length === 0 && <li className="text-muted-foreground">Пока пусто</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
