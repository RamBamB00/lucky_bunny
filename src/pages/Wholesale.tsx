import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { BadgePercent, ClipboardList, Handshake, PackageCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { formatPrice } from "@/lib/format";
import { BookCard } from "@/components/BookCard";

const PERKS = [
  { icon: BadgePercent, title: "Специальные цены", text: "Оптовые цены и ценовые уровни в зависимости от объёма заказа" },
  { icon: ClipboardList, title: "Персональный менеджер", text: "Поможем собрать ассортимент под вашу аудиторию" },
  { icon: PackageCheck, title: "Быстрая отгрузка", text: "Со склада в течение 1–3 рабочих дней после подтверждения" },
  { icon: Handshake, title: "Для любого формата", text: "Книжные магазины, детские сады, школы, корпоративные подарки" },
];

function WholesaleRequestForm() {
  const [companyName, setCompanyName] = useState("");
  const [message, setMessage] = useState("");
  const request = trpc.shop.requestWholesale.useMutation({
    onSuccess: () => toast.success("Заявка отправлена! Мы проверим её и откроем оптовые цены."),
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    request.mutate({ companyName, message: message || undefined });
  };

  return (
    <form onSubmit={submit} className="card-lb space-y-4 p-5">
      <h2 className="text-lg">Заявка на сотрудничество</h2>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">Название компании *</span>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          required
          minLength={2}
          className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-semibold">О вашем бизнесе</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          placeholder="Формат: магазин, школа, сад; примерные объёмы"
          className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      </label>
      <button
        type="submit"
        disabled={request.isPending}
        className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        Отправить заявку
      </button>
      <p className="text-xs text-muted-foreground">Заявка проверяется администратором — обычно в течение рабочего дня.</p>
    </form>
  );
}

export default function Wholesale() {
  const { isAuthenticated } = useAuth();
  const { data: config } = trpc.shop.publicConfig.useQuery();
  const { data: page } = trpc.shop.page.useQuery({ key: "wholesaleText" });
  const { data: status } = trpc.shop.myWholesaleStatus.useQuery(undefined, { enabled: isAuthenticated });
  const approved = status?.accountType === "wholesale" && status?.wholesaleStatus === "approved";

  // Оптовый каталог (виден с оптовыми ценами после одобрения)
  const { data: booksData } = trpc.catalog.list.useQuery(
    { sort: "popular", page: 1, pageSize: 12 },
    { enabled: approved },
  );

  return (
    <Layout>
      <div className="container-lb py-8">
        <div className="max-w-3xl">
          <h1 className="text-2xl sm:text-3xl">Оптовым покупателям</h1>
          {config && config.minWholesaleOrder > 0 && (
            <p className="mt-3 inline-block rounded-full bg-secondary px-4 py-2 text-sm font-bold">
              Минимальная сумма оптового заказа: {formatPrice(config.minWholesaleOrder)}
            </p>
          )}
          <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
            {page?.content || "Условия оптового сотрудничества скоро появятся."}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PERKS.map((p) => (
            <div key={p.title} className="card-lb p-5">
              <p.icon className="h-7 w-7 text-primary" aria-hidden />
              <h2 className="mt-3 font-sans text-base font-extrabold">{p.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 max-w-xl">
          {approved ? (
            <div className="rounded-2xl bg-secondary p-5">
              <p className="font-bold">Ваш оптовый аккаунт одобрен</p>
              <p className="mt-1 text-sm">Оптовые цены уже применяются в каталоге и корзине автоматически.</p>
            </div>
          ) : status?.wholesaleStatus === "pending" ? (
            <div className="rounded-2xl bg-accent p-5">
              <p className="font-bold">Заявка на рассмотрении</p>
              <p className="mt-1 text-sm">Мы проверим данные и откроем доступ к оптовым ценам.</p>
            </div>
          ) : isAuthenticated ? (
            <WholesaleRequestForm />
          ) : (
            <div className="card-lb p-5">
              <p className="text-sm">
                Чтобы подать заявку на оптовое сотрудничество,{" "}
                <Link to="/register?type=wholesale" className="font-bold text-primary hover:underline">
                  зарегистрируйтесь как оптовый покупатель
                </Link>{" "}
                или <Link to="/login" className="font-bold text-primary hover:underline">войдите</Link>.
              </p>
            </div>
          )}
        </div>

        {approved && booksData && booksData.items.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-5 text-xl sm:text-2xl">Каталог с оптовыми ценами</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {booksData.items.map((b) => (
                <BookCard key={b.id} book={b} />
              ))}
            </div>
            <Link to="/catalog" className="mt-5 inline-block text-sm font-bold text-primary hover:underline">
              Весь каталог →
            </Link>
          </section>
        )}
      </div>
    </Layout>
  );
}
