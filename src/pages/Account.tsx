import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { EmptyState } from "@/components/Shared";
import { BookCard } from "@/components/BookCard";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/const";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@contracts/shop";
import { formatDateTime, formatPrice } from "@/lib/format";

function ProfileTab() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ name: "", phone: "", newsletterOptIn: false });
  useEffect(() => {
    if (user) setForm({ name: user.name ?? "", phone: user.phone ?? "", newsletterOptIn: user.newsletterOptIn });
  }, [user]);

  const update = trpc.account.updateProfile.useMutation({
    onSuccess: () => { toast.success("Данные сохранены"); utils.auth.me.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [pw, setPw] = useState({ current: "", next: "" });
  const changePw = trpc.localAuth.changePassword.useMutation({
    onSuccess: () => { toast.success("Пароль изменён"); setPw({ current: "", next: "" }); },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => { e.preventDefault(); update.mutate(form); };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={submit} className="card-lb space-y-4 p-5">
        <h2 className="text-lg">Личные данные</h2>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Имя</span>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required minLength={2}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">Телефон</span>
          <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} required minLength={6}
            className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <p className="text-sm text-muted-foreground">Email: {user?.email ?? "—"}</p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.newsletterOptIn} onChange={(e) => setForm((f) => ({ ...f, newsletterOptIn: e.target.checked }))}
            className="h-4 w-4 accent-[#5E8C7B]" />
          Получать новости и акции на email
        </label>
        <button type="submit" disabled={update.isPending}
          className="btn-press min-h-11 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          Сохранить
        </button>
      </form>

      {user?.unionId.startsWith("local:") && (
        <form
          onSubmit={(e) => { e.preventDefault(); changePw.mutate({ currentPassword: pw.current, newPassword: pw.next }); }}
          className="card-lb h-fit space-y-4 p-5"
        >
          <h2 className="text-lg">Смена пароля</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Текущий пароль</span>
            <input type="password" value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} required
              className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Новый пароль</span>
            <input type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required minLength={6}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
          </label>
          <button type="submit" disabled={changePw.isPending}
            className="btn-press min-h-11 rounded-full border border-input bg-card px-6 py-2.5 text-sm font-bold hover:bg-muted disabled:opacity-50">
            Изменить пароль
          </button>
        </form>
      )}
    </div>
  );
}

function OrdersTab() {
  const { data: orders, isLoading } = trpc.order.myOrders.useQuery();
  const [openId, setOpenId] = useState<number | null>(null);
  const detail = trpc.order.myOrderById.useQuery({ id: openId ?? 0 }, { enabled: openId != null });

  if (isLoading) return <p className="text-sm text-muted-foreground">Загружаем заказы…</p>;
  if (!orders || orders.length === 0) {
    return <EmptyState title="Заказов пока нет" hint="Ваши заказы появятся здесь после оформления." actionTo="/catalog" actionLabel="В каталог" />;
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <div key={o.id} className="card-lb p-4">
          <button onClick={() => setOpenId(openId === o.id ? null : o.id)} className="w-full text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">{o.number}</p>
              <span className="badge-sticker border-primary bg-secondary">{ORDER_STATUS_LABELS[o.status as OrderStatus]}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(o.createdAt)} · {formatPrice(o.total)} {o.isWholesale && "· опт"}
            </p>
          </button>
          {openId === o.id && detail.data && (
            <div className="mt-3 border-t border-border pt-3">
              <ul className="space-y-1 text-sm">
                {detail.data.items.map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <span className="truncate">{i.title} × {i.qty}</span>
                    <span className="shrink-0 font-semibold">{formatPrice(i.price * i.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                <div className="flex justify-between"><dt>Доставка</dt><dd>{o.deliveryFee === 0 ? "бесплатно" : formatPrice(o.deliveryFee)}</dd></div>
                {o.discount > 0 && <div className="flex justify-between"><dt>Скидка</dt><dd>−{formatPrice(o.discount)}</dd></div>}
                <div className="flex justify-between"><dt>Способ доставки</dt><dd>{o.deliveryMethod}</dd></div>
                <div className="flex justify-between"><dt>Оплата</dt><dd>{o.paymentMethod}</dd></div>
                <div className="flex justify-between"><dt>Адрес</dt><dd className="text-right">{o.city}, {o.address}</dd></div>
              </dl>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function FavoritesTab() {
  const { data: favs, isLoading } = trpc.favorites.list.useQuery();
  if (isLoading) return <p className="text-sm text-muted-foreground">Загружаем…</p>;
  if (!favs || favs.length === 0) {
    return <EmptyState title="В избранном пусто" hint="Нажимайте на сердечко у книг, чтобы не потерять их." actionTo="/catalog" actionLabel="В каталог" />;
  }
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {favs.map((f) => (
        <BookCard key={f.bookId} book={{ id: f.bookId, slug: f.slug, title: f.title, author: f.author, coverUrl: f.coverUrl, priceRetail: f.priceRetail, salePrice: f.salePrice, stock: f.stock }} />
      ))}
    </div>
  );
}

function AddressesTab() {
  const utils = trpc.useUtils();
  const { data: addresses } = trpc.account.addresses.useQuery();
  const [form, setForm] = useState({ label: "", city: "", address: "" });
  const add = trpc.account.addAddress.useMutation({
    onSuccess: () => { utils.account.addresses.invalidate(); setForm({ label: "", city: "", address: "" }); toast.success("Адрес сохранён"); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.account.deleteAddress.useMutation({ onSuccess: () => utils.account.addresses.invalidate() });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-3">
        {(!addresses || addresses.length === 0) && <p className="text-sm text-muted-foreground">Сохранённых адресов нет.</p>}
        {addresses?.map((a) => (
          <div key={a.id} className="card-lb flex items-start justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-bold">{a.label || "Адрес"}</p>
              <p className="text-sm text-muted-foreground">{a.city}, {a.address}</p>
            </div>
            <button onClick={() => del.mutate({ id: a.id })} className="min-h-11 text-xs text-muted-foreground hover:text-destructive">
              Удалить
            </button>
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); add.mutate(form); }}
        className="card-lb h-fit space-y-4 p-5"
      >
        <h2 className="text-lg">Новый адрес</h2>
        <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Название (дом, работа)"
          className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} placeholder="Город *" required minLength={2}
          className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Улица, дом, квартира *" required minLength={3}
          className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <button type="submit" disabled={add.isPending}
          className="btn-press min-h-11 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
          Добавить
        </button>
      </form>
    </div>
  );
}

const TABS = [
  ["orders", "Заказы"],
  ["favorites", "Избранное"],
  ["profile", "Профиль"],
  ["addresses", "Адреса"],
] as const;

export default function Account() {
  const { user, isAuthenticated, isLoading, logout } = useAuth({ redirectOnUnauthenticated: true, redirectPath: LOGIN_PATH });
  const [tab, setTab] = useState<(typeof TABS)[number][0]>("orders");

  if (isLoading || !isAuthenticated || !user) {
    return <Layout><div className="container-lb py-16 text-center text-sm text-muted-foreground">Загружаем кабинет…</div></Layout>;
  }

  return (
    <Layout>
      <div className="container-lb py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl">Здравствуйте, {user.name?.split(" ")[0] ?? "друг"}</h1>
            {user.accountType === "wholesale" && (
              <p className="mt-1 text-sm">
                Оптовый аккаунт:{" "}
                <b className={user.wholesaleStatus === "approved" ? "text-primary" : "text-[#B26A1B]"}>
                  {user.wholesaleStatus === "approved" ? "одобрен — действуют оптовые цены" : user.wholesaleStatus === "pending" ? "на проверке" : "отклонён"}
                </b>
              </p>
            )}
            {user.role === "admin" && (
              <Link to="/admin" className="mt-1 inline-block text-sm font-bold text-primary hover:underline">
                Панель администратора →
              </Link>
            )}
          </div>
          <button
            onClick={logout}
            className="btn-press flex min-h-11 items-center gap-2 rounded-full border border-input bg-card px-5 py-2.5 text-sm font-bold hover:bg-muted"
          >
            <LogOut className="h-4 w-4" aria-hidden /> Выйти
          </button>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map(([v, label]) => (
            <button
              key={v}
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-bold ${
                tab === v ? "bg-primary text-primary-foreground" : "border border-input bg-card hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "orders" && <OrdersTab />}
        {tab === "favorites" && <FavoritesTab />}
        {tab === "profile" && <ProfileTab />}
        {tab === "addresses" && <AddressesTab />}
      </div>
    </Layout>
  );
}
