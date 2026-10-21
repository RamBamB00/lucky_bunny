import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@contracts/shop";
import { formatDateTime, formatPrice } from "@/lib/format";

function OrderDetail({ id, onClose }: { id: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.orderDetail.useQuery({ id });
  const [note, setNote] = useState("");
  const [adminComment, setAdminComment] = useState("");
  const [status, setStatus] = useState<OrderStatus>("new");

  useEffect(() => {
    if (data) {
      setStatus(data.order.status);
      setAdminComment(data.order.adminComment ?? "");
      setNote("");
    }
  }, [data]);

  const setStatusMut = trpc.admin.setOrderStatus.useMutation({
    onSuccess: () => {
      toast.success("Статус обновлён");
      utils.admin.listOrders.invalidate();
      utils.admin.orderDetail.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const saveComment = trpc.admin.setOrderComment.useMutation({
    onSuccess: () => toast.success("Комментарий сохранён"),
    onError: (e) => toast.error(e.message),
  });

  if (!data) return null;
  const o = data.order;

  const submitStatus = (e: FormEvent) => {
    e.preventDefault();
    setStatusMut.mutate({ id: o.id, status, note: note || undefined });
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto bg-card">
        <DialogTitle className="font-display text-xl">Заказ {o.number}</DialogTitle>
        <div className="mt-2 space-y-4 text-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Покупатель</p>
              <p className="font-semibold">{o.customerName}</p>
              <p>{o.phone}</p>
              {o.email && <p>{o.email}</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Доставка</p>
              <p className="font-semibold">{o.deliveryMethod}</p>
              <p>{o.city}, {o.address}</p>
              <p className="mt-1 text-xs text-muted-foreground">Оплата: {o.paymentMethod}</p>
            </div>
          </div>

          {o.comment && <p className="rounded-xl bg-muted p-3 text-xs">Комментарий покупателя: {o.comment}</p>}

          <ul className="divide-y divide-border rounded-xl border border-border">
            {data.items.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 truncate">{i.title} × {i.qty}</span>
                <span className="shrink-0 font-semibold">{formatPrice(i.price * i.qty)}</span>
              </li>
            ))}
          </ul>

          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Товары</dt><dd>{formatPrice(o.subtotal)}</dd></div>
            {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Скидка {o.promoCode && `(${o.promoCode})`}</dt><dd>−{formatPrice(o.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted-foreground">Доставка</dt><dd>{o.deliveryFee === 0 ? "бесплатно" : formatPrice(o.deliveryFee)}</dd></div>
            <div className="flex justify-between font-extrabold"><dt>Итого</dt><dd>{formatPrice(o.total)}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">{formatDateTime(o.createdAt)} {o.isWholesale && "· оптовый заказ"}</p>

          <form onSubmit={submitStatus} className="rounded-2xl border border-border p-4">
            <p className="mb-2 text-sm font-bold">Сменить статус</p>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm"
                aria-label="Новый статус"
              >
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
              </select>
              {status === "paid" && (
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Основание оплаты (обязательно)"
                  className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
                />
              )}
              <Button type="submit" size="sm" className="rounded-full" disabled={setStatusMut.isPending}>
                Применить
              </Button>
            </div>
          </form>

          <div>
            <p className="mb-1 text-sm font-bold">Внутренний комментарий</p>
            <div className="flex gap-2">
              <input
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
                placeholder="Заметка для сотрудников"
              />
              <Button type="button" variant="outline" className="rounded-full" onClick={() => saveComment.mutate({ id: o.id, adminComment })}>
                Сохранить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminOrders() {
  const [params] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<number | null>(params.get("id") ? Number(params.get("id")) : null);

  const { data, isLoading } = trpc.admin.listOrders.useQuery({
    search: search || undefined,
    status: (status || undefined) as OrderStatus | undefined,
    page,
    pageSize: 20,
  });
  const exportOrders = trpc.admin.exportOrders.useQuery(undefined, { enabled: false });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 20)) : 1;

  const downloadCsv = async () => {
    const res = await exportOrders.refetch();
    if (!res.data) return;
    const blob = new Blob(["\uFEFF" + res.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "orders.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl">Заказы</h1>
        <Button variant="outline" className="rounded-full" onClick={downloadCsv}>Экспорт CSV</Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Номер, клиент или телефон"
          aria-label="Поиск заказов"
          className="min-h-11 w-full max-w-xs rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className="min-h-11 rounded-xl border border-input bg-card px-3 text-sm"
          aria-label="Фильтр по статусу"
        >
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      <div className="card-lb overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-3">Номер</th>
              <th className="p-3">Дата</th>
              <th className="p-3">Клиент</th>
              <th className="p-3">Сумма</th>
              <th className="p-3">Статус</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Загружаем…</td></tr>}
            {data?.items.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0">
                <td className="p-3 font-semibold">{o.number}{o.isWholesale && <span className="ml-1 text-xs text-primary">опт</span>}</td>
                <td className="p-3 text-xs">{formatDateTime(o.createdAt)}</td>
                <td className="p-3">{o.customerName}<br /><span className="text-xs text-muted-foreground">{o.phone}</span></td>
                <td className="p-3 font-semibold">{formatPrice(o.total)}</td>
                <td className="p-3">
                  <span className={`rounded-full px-2 py-1 text-xs font-bold ${o.status === "cancelled" ? "bg-muted text-muted-foreground" : "bg-secondary"}`}>
                    {ORDER_STATUS_LABELS[o.status as OrderStatus]}
                  </span>
                </td>
                <td className="p-3 text-right">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setOpenId(o.id)}>Открыть</Button>
                </td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Заказы не найдены</td></tr>
            )}
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

      {openId != null && <OrderDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}
