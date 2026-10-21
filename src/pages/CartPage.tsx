import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { Minus, Plus, Trash2, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/Shared";
import { useCart } from "@/providers/cart";
import { useCartDetailed, type CartLineDetailed } from "@/hooks/useCartDetailed";
import { trpc } from "@/providers/trpc";
import { formatPrice } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const CONTACT_KEY = "lb_cart_contact";
const MAX_URL_TEXT = 3500;

type Contact = { name: string; phone: string; city: string; address: string; delivery: "delivery" | "pickup"; comment: string };
const EMPTY_CONTACT: Contact = { name: "", phone: "", city: "", address: "", delivery: "delivery", comment: "" };

function loadContact(): Contact {
  try {
    const raw = localStorage.getItem(CONTACT_KEY);
    if (!raw) return EMPTY_CONTACT;
    return { ...EMPTY_CONTACT, ...(JSON.parse(raw) as Partial<Contact>), comment: "" };
  } catch {
    return EMPTY_CONTACT;
  }
}

/** Количество, которое реально можно заказать (с учётом остатка). */
function effectiveQty(l: CartLineDetailed) {
  return Math.min(l.qty, l.stock);
}

function buildMessage(lines: CartLineDetailed[], c: Contact, greeting: string) {
  const items = lines.filter((l) => effectiveQty(l) > 0);
  const totalQty = items.reduce((s, l) => s + effectiveQty(l), 0);
  const total = items.reduce((s, l) => s + effectiveQty(l) * l.unitPrice, 0);

  const rows = items.map((l, idx) => {
    const q = effectiveQty(l);
    const head = `${idx + 1}. *${l.title}*${l.author ? ` — ${l.author}` : ""}`;
    return `${head}\n   ${q} шт × ${formatPrice(l.unitPrice)} = ${formatPrice(q * l.unitPrice)}`;
  });

  const info = [
    `Имя: ${c.name.trim()}`,
    `Телефон: ${c.phone.trim()}`,
    c.city.trim() && `Город: ${c.city.trim()}`,
    c.delivery === "delivery" ? `Получение: доставка${c.address.trim() ? `, ${c.address.trim()}` : ""}` : "Получение: самовывоз",
    c.comment.trim() && `Комментарий: ${c.comment.trim()}`,
  ].filter(Boolean);

  return [
    greeting,
    "",
    ...rows,
    "",
    `*Итого:* ${totalQty} шт, ${formatPrice(total)}`,
    "",
    ...info,
    "",
    `Заказ с сайта, ${new Date().toLocaleString("ru-RU")}`,
  ].join("\n");
}

export default function CartPage() {
  const cart = useCart();
  const { lines, subtotal, loading } = useCartDetailed();
  const { data: config } = trpc.shop.publicConfig.useQuery();
  const [contact, setContact] = useState<Contact>(() => loadContact());
  const [sent, setSent] = useState(false);
  const [errors, setErrors] = useState<{ name?: boolean; phone?: boolean }>({});

  const waNumber = (config?.contacts?.whatsapp ?? "").replace(/\D/g, "");
  const greeting = "Здравствуйте! Хочу сделать заказ:";

  useEffect(() => {
    try {
      localStorage.setItem(CONTACT_KEY, JSON.stringify({ ...contact, comment: "" }));
    } catch {
      /* ignore */
    }
  }, [contact]);

  const orderable = useMemo(() => lines.filter((l) => effectiveQty(l) > 0), [lines]);
  const orderTotal = orderable.reduce((s, l) => s + effectiveQty(l) * l.unitPrice, 0);
  const orderQty = orderable.reduce((s, l) => s + effectiveQty(l), 0);

  const set = <K extends keyof Contact>(k: K, v: Contact[K]) => setContact((p) => ({ ...p, [k]: v }));

  const validate = () => {
    const e = { name: !contact.name.trim(), phone: contact.phone.replace(/\D/g, "").length < 10 };
    setErrors(e);
    if (e.name || e.phone) {
      toast.error("Укажите имя и телефон");
      return false;
    }
    return true;
  };

  const copyText = async () => {
    if (!validate()) return;
    try {
      await navigator.clipboard.writeText(buildMessage(lines, contact, greeting));
      toast.success("Список скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  };

  const sendToWhatsApp = async () => {
    if (orderable.length === 0) return;
    if (!validate()) return;
    if (!waNumber) {
      toast.error("Номер WhatsApp магазина не настроен. Свяжитесь с нами другим способом.");
      return;
    }
    const text = buildMessage(lines, contact, greeting);
    const encoded = encodeURIComponent(text);
    if (encoded.length > MAX_URL_TEXT) {
      try {
        await navigator.clipboard.writeText(text);
        toast.message("Список слишком длинный для ссылки. Он скопирован — вставьте его в чат.");
      } catch {
        toast.error("Список слишком длинный. Нажмите «Скопировать список» и вставьте в чат.");
      }
      window.open(`https://wa.me/${waNumber}`, "_blank", "noopener,noreferrer");
    } else {
      window.open(`https://wa.me/${waNumber}?text=${encoded}`, "_blank", "noopener,noreferrer");
    }
    setSent(true);
  };

  return (
    <Layout>
      <div className="container-lb py-6">
        <h1 className="mb-6 text-2xl sm:text-3xl">Корзина</h1>

        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
          </div>
        ) : lines.length === 0 ? (
          <EmptyState
            title="Корзина пуста"
            hint="Загляните в каталог — там много хороших книг."
            actionTo="/catalog"
            actionLabel="Перейти в каталог"
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <ul className="space-y-3">
              {lines.map((l) => (
                <li key={l.bookId} className="card-lb flex gap-4 p-3">
                  <Link to={`/book/${l.slug}`} className="shrink-0">
                    {l.coverUrl ? (
                      <img src={l.coverUrl} alt="" className="h-28 w-20 rounded-xl object-cover" loading="lazy" />
                    ) : (
                      <div className="flex h-28 w-20 items-center justify-center rounded-xl bg-muted text-center text-[10px] text-muted-foreground">
                        {l.title}
                      </div>
                    )}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link to={`/book/${l.slug}`} className="truncate text-sm font-bold hover:text-primary">
                      {l.title}
                    </Link>
                    {l.author && <p className="truncate text-xs text-muted-foreground">{l.author}</p>}
                    <p className="text-xs text-muted-foreground">{formatPrice(l.unitPrice)} за шт.</p>
                    {l.stock === 0 && (
                      <p className="mt-1 text-xs font-semibold text-destructive">
                        Нет в наличии — не попадёт в заказ
                      </p>
                    )}
                    {l.stock > 0 && l.stock < l.qty && (
                      <p className="mt-1 text-xs font-semibold text-destructive">
                        В наличии только {l.stock} шт. — в заказ попадёт {l.stock}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-2">
                      <div className="flex items-center rounded-full border border-input">
                        <button
                          onClick={() => cart.setQty(l.bookId, l.qty - 1)}
                          className="flex min-h-11 min-w-11 items-center justify-center"
                          aria-label="Уменьшить"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-8 text-center text-sm font-bold">{l.qty}</span>
                        <button
                          onClick={() => cart.setQty(l.bookId, Math.min(l.stock || l.qty, l.qty + 1))}
                          className="flex min-h-11 min-w-11 items-center justify-center"
                          aria-label="Увеличить"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-base font-extrabold">{formatPrice(effectiveQty(l) * l.unitPrice)}</p>
                      <button
                        onClick={() => cart.remove(l.bookId)}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-destructive"
                        aria-label={`Удалить «${l.title}»`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <aside className="card-lb h-fit p-5 lg:sticky lg:top-40">
              <h2 className="text-lg">Оформление заказа</h2>
              <div className="mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Книг: {orderQty}</span>
                  <span className="text-base font-extrabold">{formatPrice(orderTotal)}</span>
                </div>
                {subtotal !== orderTotal && (
                  <p className="text-xs text-muted-foreground">Сумма учитывает только книги в наличии.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Оплата на сайте не требуется: заказ отправится нам в WhatsApp, менеджер уточнит детали и оплату.
                </p>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Input
                    placeholder="Ваше имя *"
                    value={contact.name}
                    onChange={(e) => set("name", e.target.value)}
                    aria-invalid={errors.name}
                    className={errors.name ? "border-destructive" : ""}
                  />
                </div>
                <div>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="Телефон *"
                    value={contact.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    aria-invalid={errors.phone}
                    className={errors.phone ? "border-destructive" : ""}
                  />
                </div>
                <Input placeholder="Город" value={contact.city} onChange={(e) => set("city", e.target.value)} />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {([
                    ["delivery", "Доставка"],
                    ["pickup", "Самовывоз"],
                  ] as const).map(([v, label]) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => set("delivery", v)}
                      className={`min-h-11 rounded-full border px-3 font-semibold ${
                        contact.delivery === v ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {contact.delivery === "delivery" && (
                  <Input placeholder="Адрес доставки" value={contact.address} onChange={(e) => set("address", e.target.value)} />
                )}
                <Textarea
                  placeholder="Комментарий к заказу"
                  rows={2}
                  value={contact.comment}
                  onChange={(e) => set("comment", e.target.value)}
                />
              </div>

              <button
                onClick={sendToWhatsApp}
                disabled={orderable.length === 0}
                className="btn-press mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3 text-base font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle className="h-5 w-5" />
                Заказать в WhatsApp
              </button>
              <button
                onClick={copyText}
                disabled={orderable.length === 0}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-input px-6 py-2 text-sm font-semibold hover:bg-muted disabled:opacity-50"
              >
                <Copy className="h-4 w-4" />
                Скопировать список
              </button>

              {sent && (
                <div className="mt-3 rounded-xl bg-muted p-3 text-xs">
                  <p>Если сообщение отправлено, корзину можно очистить.</p>
                  <button
                    onClick={() => { cart.clear(); setSent(false); }}
                    className="mt-2 font-bold text-primary hover:underline"
                  >
                    Очистить корзину
                  </button>
                </div>
              )}

              <button
                onClick={() => cart.clear()}
                className="mt-2 w-full rounded-full py-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Очистить корзину
              </button>
            </aside>
          </div>
        )}
      </div>
    </Layout>
  );
}
