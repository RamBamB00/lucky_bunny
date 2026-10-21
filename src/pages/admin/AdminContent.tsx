import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

function CategoriesSection() {
  const utils = trpc.useUtils();
  const { data: cats } = trpc.adminCatalog.listCategories.useQuery();
  const [name, setName] = useState("");
  const upsert = trpc.adminCatalog.upsertCategory.useMutation({
    onSuccess: () => { utils.adminCatalog.listCategories.invalidate(); utils.catalog.categories.invalidate(); setName(""); toast.success("Категория сохранена"); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.adminCatalog.deleteCategory.useMutation({
    onSuccess: () => { utils.adminCatalog.listCategories.invalidate(); utils.catalog.categories.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <section className="card-lb p-5">
      <h2 className="mb-3 text-lg">Категории</h2>
      <form onSubmit={(e) => { e.preventDefault(); upsert.mutate({ name, sortOrder: (cats?.length ?? 0) + 1, isActive: true }); }} className="mb-3 flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Новая категория" required minLength={1}
          className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="sm" className="rounded-full">Добавить</Button>
      </form>
      <ul className="space-y-1">
        {cats?.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
            <span>{c.name} {!c.isActive && <span className="text-xs text-muted-foreground">(скрыта)</span>}</span>
            <button onClick={() => { if (confirm(`Удалить категорию «${c.name}»? Книги останутся без категории.`)) del.mutate({ id: c.id }); }}
              aria-label={`Удалить ${c.name}`} className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PromocodesSection() {
  const utils = trpc.useUtils();
  const { data: promos } = trpc.admin.listPromocodes.useQuery();
  const [form, setForm] = useState({ code: "", discountPercent: "10", minSubtotal: "" });
  const upsert = trpc.admin.upsertPromocode.useMutation({
    onSuccess: () => { utils.admin.listPromocodes.invalidate(); setForm({ code: "", discountPercent: "10", minSubtotal: "" }); toast.success("Промокод сохранён"); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.deletePromocode.useMutation({ onSuccess: () => utils.admin.listPromocodes.invalidate() });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    upsert.mutate({
      code: form.code,
      discountPercent: Number(form.discountPercent),
      minSubtotal: form.minSubtotal ? Number(form.minSubtotal) : null,
      isActive: true,
    });
  };

  return (
    <section className="card-lb p-5">
      <h2 className="mb-3 text-lg">Промокоды</h2>
      <form onSubmit={submit} className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="КОД" required minLength={2}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm uppercase outline-none focus:ring-2 focus:ring-ring" />
        <input type="number" value={form.discountPercent} onChange={(e) => setForm((f) => ({ ...f, discountPercent: e.target.value }))} placeholder="Скидка %" required min={1} max={90}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input type="number" value={form.minSubtotal} onChange={(e) => setForm((f) => ({ ...f, minSubtotal: e.target.value }))} placeholder="Мин. сумма ₸" min={0}
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <Button type="submit" size="sm" className="rounded-full">Создать</Button>
      </form>
      <ul className="space-y-1">
        {promos?.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
            <span>
              <b>{p.code}</b> — {p.discountPercent}%{p.minSubtotal ? `, от ${p.minSubtotal} ₸` : ""}
              {!p.isActive && <span className="ml-1 text-xs text-muted-foreground">(неактивен)</span>}
            </span>
            <button onClick={() => del.mutate({ id: p.id })} aria-label={`Удалить ${p.code}`}
              className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function BannersSection() {
  const utils = trpc.useUtils();
  const { data: banners } = trpc.admin.listBanners.useQuery();
  const [form, setForm] = useState({ title: "", subtitle: "", link: "/catalog", bgColor: "#B9E4C9" });
  const upsert = trpc.admin.upsertBanner.useMutation({
    onSuccess: () => { utils.admin.listBanners.invalidate(); utils.shop.banners.invalidate(); toast.success("Баннер сохранён"); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.deleteBanner.useMutation({ onSuccess: () => utils.admin.listBanners.invalidate() });

  return (
    <section className="card-lb p-5">
      <h2 className="mb-3 text-lg">Главный баннер</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          upsert.mutate({ ...form, isActive: true, sortOrder: 0 });
          setForm({ title: "", subtitle: "", link: "/catalog", bgColor: "#B9E4C9" });
        }}
        className="mb-3 grid gap-2"
      >
        <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Заголовок *" required
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <input value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} placeholder="Подзаголовок"
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        <div className="grid grid-cols-2 gap-2">
          <input value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="Ссылка (например /catalog)"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
          <input value={form.bgColor} onChange={(e) => setForm((f) => ({ ...f, bgColor: e.target.value }))} placeholder="Цвет фона #B9E4C9"
            className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <Button type="submit" size="sm" className="w-fit rounded-full">Опубликовать баннер</Button>
      </form>
      <ul className="space-y-1">
        {banners?.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
            <span className="truncate"><b>{b.title}</b> {!b.isActive && <span className="text-xs text-muted-foreground">(скрыт)</span>}</span>
            <button onClick={() => del.mutate({ id: b.id })} aria-label={`Удалить баннер ${b.title}`}
              className="flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReviewsSection() {
  const utils = trpc.useUtils();
  const { data: reviews } = trpc.admin.listReviews.useQuery();
  const approve = trpc.admin.setReviewApproved.useMutation({ onSuccess: () => utils.admin.listReviews.invalidate() });
  const del = trpc.admin.deleteReview.useMutation({ onSuccess: () => utils.admin.listReviews.invalidate() });

  return (
    <section className="card-lb p-5">
      <h2 className="mb-3 text-lg">Отзывы</h2>
      {(!reviews || reviews.length === 0) && <p className="text-sm text-muted-foreground">Отзывов нет.</p>}
      <ul className="space-y-3">
        {reviews?.map((r) => (
          <li key={r.id} className="rounded-2xl border border-border p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold">{r.authorName} · {r.bookTitle}</p>
              <span className="flex">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} className={`h-3.5 w-3.5 ${s <= r.rating ? "fill-[#FFB583] text-[#E8A04C]" : "text-muted"}`} />
                ))}
              </span>
            </div>
            <p className="mt-1">{r.text}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(r.createdAt)} · {r.isApproved ? "опубликован" : "на модерации"}</p>
            <div className="mt-2 flex gap-2">
              {!r.isApproved && (
                <Button size="sm" className="rounded-full" onClick={() => approve.mutate({ id: r.id, isApproved: true })}>Опубликовать</Button>
              )}
              {r.isApproved && (
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => approve.mutate({ id: r.id, isApproved: false })}>Скрыть</Button>
              )}
              <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => del.mutate({ id: r.id })}>Удалить</Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function MessagesSection() {
  const utils = trpc.useUtils();
  const { data: messages } = trpc.admin.listMessages.useQuery();
  const markRead = trpc.admin.markMessageRead.useMutation({ onSuccess: () => utils.admin.listMessages.invalidate() });

  return (
    <section className="card-lb p-5">
      <h2 className="mb-3 text-lg">Сообщения с формы обратной связи</h2>
      {(!messages || messages.length === 0) && <p className="text-sm text-muted-foreground">Сообщений нет.</p>}
      <ul className="space-y-3">
        {messages?.map((m) => (
          <li key={m.id} className={`rounded-2xl border p-3 text-sm ${m.isRead ? "border-border opacity-70" : "border-primary bg-secondary/30"}`}>
            <p className="font-bold">{m.name} · {m.contact}</p>
            <p className="mt-1">{m.message}</p>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{formatDate(m.createdAt)}</p>
              {!m.isRead && (
                <Button size="sm" variant="outline" className="rounded-full text-xs" onClick={() => markRead.mutate({ id: m.id })}>
                  Отметить прочитанным
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AdminContent() {
  return (
    <div>
      <h1 className="mb-6 text-2xl">Контент и маркетинг</h1>
      <div className="grid gap-4 lg:grid-cols-2">
        <CategoriesSection />
        <PromocodesSection />
        <BannersSection />
        <ReviewsSection />
        <div className="lg:col-span-2"><MessagesSection /></div>
      </div>
    </div>
  );
}
