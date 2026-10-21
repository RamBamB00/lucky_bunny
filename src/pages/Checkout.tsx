import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/Shared";
import { useCart } from "@/providers/cart";
import { useCartDetailed } from "@/hooks/useCartDetailed";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";

function newIdemKey() {
  return `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const cart = useCart();
  const { lines, subtotal, loading } = useCartDetailed();
  const { data: config } = trpc.shop.publicConfig.useQuery();

  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    deliveryMethod: "",
    paymentMethod: "",
    comment: "",
  });
  const [promo, setPromo] = useState("");
  const [consent, setConsent] = useState(false);
  const [idemKey, setIdemKey] = useState(() => newIdemKey());

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        customerName: f.customerName || user.name || "",
        phone: f.phone || user.phone || "",
        email: f.email || user.email || "",
      }));
    }
  }, [user]);

  const promoCheck = trpc.order.validatePromo.useQuery(
    { code: promo, subtotal },
    { enabled: promo.trim().length >= 2, retry: false },
  );

  const discount = promoCheck.data?.valid ? promoCheck.data.discount : 0;
  const deliveryMethods = config?.deliveryMethods ?? [];
  const paymentMethods = config?.paymentMethods ?? [];
  const selectedDelivery = deliveryMethods.find((m) => m.id === form.deliveryMethod);
  const freeFrom = config?.freeDeliveryFrom ?? 0;
  const deliveryFee = selectedDelivery
    ? selectedDelivery.fee > 0 && freeFrom > 0 && subtotal - discount >= freeFrom
      ? 0
      : selectedDelivery.fee
    : 0;
  const total = subtotal - discount + deliveryFee;

  const createOrder = trpc.order.create.useMutation({
    onSuccess: (r) => {
      cart.clear();
      navigate(`/order-success?number=${encodeURIComponent(r.orderNumber)}&total=${r.total}`, { replace: true });
    },
    onError: (e) => {
      toast.error(e.message);
      setIdemKey(newIdemKey());
    },
  });

  const canSubmit = useMemo(
    () =>
      lines.length > 0 &&
      form.customerName.trim().length >= 2 &&
      form.phone.trim().length >= 6 &&
      form.city.trim().length >= 2 &&
      form.address.trim().length >= 3 &&
      form.deliveryMethod &&
      form.paymentMethod &&
      consent &&
      !createOrder.isPending,
    [lines, form, consent, createOrder.isPending],
  );

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    createOrder.mutate({
      ...form,
      email: form.email || undefined,
      promoCode: promoCheck.data?.valid ? promo : undefined,
      items: lines.map((l) => ({ bookId: l.bookId, qty: l.qty })),
      idempotencyKey: idemKey,
      consent: true,
    });
  };

  if (!loading && lines.length === 0) {
    return (
      <Layout>
        <div className="container-lb py-10">
          <EmptyState title="Корзина пуста" hint="Добавьте книги, чтобы оформить заказ." actionTo="/catalog" actionLabel="В каталог" />
        </div>
      </Layout>
    );
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts: { type?: string; required?: boolean; placeholder?: string; inputMode?: "tel" | "email" } = {},
  ) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}{opts.required !== false && " *"}</span>
      <input
        type={opts.type ?? "text"}
        inputMode={opts.inputMode}
        required={opts.required !== false}
        placeholder={opts.placeholder}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );

  return (
    <Layout>
      <div className="container-lb py-6">
        <h1 className="mb-6 text-2xl sm:text-3xl">Оформление заказа</h1>
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <section className="card-lb p-5">
              <h2 className="mb-4 text-lg">Контактные данные</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {field("Имя и фамилия", "customerName", { placeholder: "Айгерим Сатыбалды" })}
                {field("Телефон", "phone", { type: "tel", inputMode: "tel", placeholder: "+7 700 000-00-00" })}
                {field("Email", "email", { type: "email", inputMode: "email", required: false, placeholder: "you@example.com" })}
                {field("Город", "city", { placeholder: "Алматы" })}
                <div className="sm:col-span-2">{field("Адрес доставки", "address", { placeholder: "Улица, дом, квартира" })}</div>
              </div>
            </section>

            <section className="card-lb p-5">
              <h2 className="mb-4 text-lg">Способ доставки</h2>
              <div className="space-y-2" role="radiogroup" aria-label="Способ доставки">
                {deliveryMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      form.deliveryMethod === m.id ? "border-primary bg-secondary/50" : "border-input bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name="delivery"
                      value={m.id}
                      checked={form.deliveryMethod === m.id}
                      onChange={() => setForm((f) => ({ ...f, deliveryMethod: m.id }))}
                      className="mt-1 h-4 w-4 accent-[#5E8C7B]"
                    />
                    <span className="flex-1">
                      <span className="block text-sm font-bold">{m.name}</span>
                      {m.description && <span className="block text-xs text-muted-foreground">{m.description}</span>}
                      {m.eta && <span className="block text-xs text-muted-foreground">Срок: {m.eta}</span>}
                    </span>
                    <span className="text-sm font-bold">{m.fee === 0 ? "Бесплатно" : formatPrice(m.fee)}</span>
                  </label>
                ))}
              </div>
              {freeFrom > 0 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Бесплатная доставка при заказе от {formatPrice(freeFrom)}.
                </p>
              )}
            </section>

            <section className="card-lb p-5">
              <h2 className="mb-4 text-lg">Способ оплаты</h2>
              <div className="space-y-2" role="radiogroup" aria-label="Способ оплаты">
                {paymentMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                      form.paymentMethod === m.id ? "border-primary bg-secondary/50" : "border-input bg-card"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={m.id}
                      checked={form.paymentMethod === m.id}
                      onChange={() => setForm((f) => ({ ...f, paymentMethod: m.id }))}
                      className="mt-1 h-4 w-4 accent-[#5E8C7B]"
                    />
                    <span>
                      <span className="block text-sm font-bold">{m.name}</span>
                      {m.description && <span className="block text-xs text-muted-foreground">{m.description}</span>}
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="card-lb p-5">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Комментарий к заказу</span>
                <textarea
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  rows={3}
                  placeholder="Например, удобное время звонка"
                  className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            </section>
          </div>

          <aside className="card-lb h-fit p-5 lg:sticky lg:top-40">
            <h2 className="text-lg">Ваш заказ</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {lines.map((l) => (
                <li key={l.bookId} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">{l.title} × {l.qty}</span>
                  <span className="shrink-0 font-semibold">{formatPrice(l.unitPrice * l.qty)}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 border-t border-border pt-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-muted-foreground">Промокод</span>
                <div className="flex gap-2">
                  <input
                    value={promo}
                    onChange={(e) => setPromo(e.target.value.toUpperCase())}
                    placeholder="WELCOME10"
                    className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </label>
              {promo.trim().length >= 2 && promoCheck.data && (
                <p className={`mt-1 text-xs font-semibold ${promoCheck.data.valid ? "text-primary" : "text-destructive"}`}>
                  {promoCheck.data.valid
                    ? `Скидка ${promoCheck.data.discountPercent}% применена`
                    : promoCheck.data.message}
                </p>
              )}
            </div>

            <dl className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Товары</dt><dd>{formatPrice(subtotal)}</dd></div>
              {discount > 0 && <div className="flex justify-between text-primary"><dt>Скидка</dt><dd>−{formatPrice(discount)}</dd></div>}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Доставка</dt>
                <dd>{selectedDelivery ? (deliveryFee === 0 ? "Бесплатно" : formatPrice(deliveryFee)) : "—"}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-extrabold">
                <dt>Итого</dt><dd>{formatPrice(total)}</dd>
              </div>
            </dl>

            <label className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#5E8C7B]"
              />
              <span>
                Соглашаюсь с <Link to="/terms" className="font-semibold text-primary hover:underline">условиями покупки</Link> и
                обработкой персональных данных
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-press mt-4 flex min-h-11 w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {createOrder.isPending ? "Оформляем…" : "Подтвердить заказ"}
            </button>
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Цены и наличие проверяются на сервере при оформлении.
            </p>
          </aside>
        </form>
      </div>
    </Layout>
  );
}
