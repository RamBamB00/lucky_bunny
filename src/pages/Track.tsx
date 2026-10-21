import { useState, type FormEvent } from "react";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@contracts/shop";
import { formatDateTime, formatPrice } from "@/lib/format";

export default function Track() {
  const [number, setNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [submitted, setSubmitted] = useState<{ number: string; phone: string } | null>(null);

  const query = trpc.order.track.useQuery(submitted ?? { number: "___", phone: "________" }, {
    enabled: !!submitted,
    retry: false,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setSubmitted({ number: number.trim(), phone: phone.trim() });
  };

  return (
    <Layout>
      <div className="container-lb max-w-xl py-10">
        <h1 className="text-2xl sm:text-3xl">Отследить заказ</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Введите номер заказа и телефон, указанный при оформлении.
        </p>
        <form onSubmit={submit} className="card-lb mt-6 space-y-4 p-5">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Номер заказа</span>
            <input
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="LB-251020-1234"
              required
              className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Телефон</span>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+7 700 000-00-00"
              required
              className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button type="submit" className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground">
            Найти заказ
          </button>
        </form>

        {submitted && !query.isLoading && (
          <div className="card-lb mt-4 p-5" aria-live="polite">
            {query.data ? (
              <>
                <p className="text-sm text-muted-foreground">Заказ {query.data.number} от {formatDateTime(query.data.createdAt)}</p>
                <p className="mt-2 text-xl font-extrabold">
                  Статус: <span className="text-primary">{ORDER_STATUS_LABELS[query.data.status as OrderStatus] ?? query.data.status}</span>
                </p>
                <p className="mt-1 text-sm">Сумма: {formatPrice(query.data.total)}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Заказ не найден. Проверьте номер и телефон — они должны совпадать с данными оформления.
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
