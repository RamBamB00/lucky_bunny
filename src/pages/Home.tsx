import { Link } from "react-router";
import { ArrowRight, BadgePercent, BookHeart, Package, Sparkles, Truck, Users } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";
import { BookCard } from "@/components/BookCard";
import { Reveal, SectionTitle } from "@/components/Shared";
import { NewsletterForm } from "@/components/NewsletterForm";
import { Skeleton } from "@/components/ui/skeleton";

function BookRow({ books, loading }: { books?: any[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[2/3.6] w-full rounded-2xl" />
        ))}
      </div>
    );
  }
  if (!books || books.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  );
}

const ADVANTAGES = [
  { icon: BookHeart, title: "Отобрано с любовью", text: "Каждая книга в каталоге — та, которую мы читали бы своим детям" },
  { icon: Truck, title: "Доставка по Казахстану", text: "Курьер, самовывоз или почта — выбирайте удобный способ" },
  { icon: BadgePercent, title: "Опт и розница", text: "Специальные цены для магазинов, школ и корпоративных клиентов" },
  { icon: Package, title: "Бережная упаковка", text: "Книги приезжают в идеальном состоянии" },
];

export default function Home() {
  const { data: home, isLoading } = trpc.catalog.home.useQuery();
  const { data: banners } = trpc.shop.banners.useQuery();
  const banner = banners?.[0];

  return (
    <Layout>
      {/* Hero */}
      <section className="container-lb pt-6">
        <div
          className="relative overflow-hidden rounded-3xl border border-border/60"
          style={{ backgroundColor: banner?.bgColor ?? "#B9E4C9" }}
        >
          <div className="grid items-center gap-6 p-6 sm:p-10 lg:grid-cols-2">
            <div>
              <span className="badge-sticker border-foreground/20 bg-card/70">Книжный интернет-магазин</span>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl">
                {banner?.title ?? "Книги, с которыми тепло"}
              </h1>
              <p className="mt-4 max-w-md text-base text-foreground/80 sm:text-lg">
                {banner?.subtitle ?? "Детские сказки, энциклопедии и художественная литература — с доставкой по Казахстану"}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to={banner?.link ?? "/catalog"}
                  className="btn-press inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-bold text-background hover:opacity-90"
                >
                  Перейти в каталог <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  to="/wholesale"
                  className="btn-press inline-flex min-h-11 items-center rounded-full border-2 border-foreground/70 px-6 py-3 text-sm font-bold hover:bg-foreground hover:text-background"
                >
                  Оптовым покупателям
                </Link>
              </div>
            </div>
            <div className="relative hidden justify-center lg:flex">
              <img
                src="/logo.png"
                alt="Lucky Bunny — Toys & Books"
                className="w-72 rounded-3xl border-4 border-card shadow-[0_12px_40px_rgba(46,42,37,0.18)] xl:w-80"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Быстрые переходы */}
      <section className="container-lb mt-8">
        <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
          {[
            { to: "/catalog", label: "Весь каталог", icon: Sparkles },
            { to: "/catalog?flag=new", label: "Новинки", icon: Sparkles },
            { to: "/catalog?flag=bestseller", label: "Бестселлеры", icon: Sparkles },
            { to: "/catalog?category=skazki", label: "Для детей", icon: Sparkles },
            { to: "/wholesale", label: "Опт", icon: Users },
          ].map((q) => (
            <Link
              key={q.label}
              to={q.to}
              className="btn-press flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
            >
              {q.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Категории */}
      {home && home.categories.length > 0 && (
        <section className="container-lb mt-12">
          <Reveal>
            <SectionTitle title="Популярные категории" linkTo="/catalog" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {home.categories.map((c, i) => (
                <Link
                  key={c.id}
                  to={`/catalog?category=${c.slug}`}
                  className="btn-press flex min-h-20 items-center justify-center rounded-2xl border border-border/60 px-4 py-5 text-center text-sm font-bold hover:shadow-md"
                  style={{ backgroundColor: ["#F5CAC3", "#B9E4C9", "#FFB583", "#BAAAD7", "#BBE9F2"][i % 5] }}
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </Reveal>
        </section>
      )}

      {/* Новинки */}
      <section className="container-lb mt-12">
        <Reveal>
          <SectionTitle title="Новинки" linkTo="/catalog?flag=new" />
          <BookRow books={home?.newBooks} loading={isLoading} />
        </Reveal>
      </section>

      {/* Бестселлеры */}
      <section className="container-lb mt-12">
        <Reveal>
          <SectionTitle title="Популярные книги" linkTo="/catalog?flag=bestseller" />
          <BookRow books={home?.bestsellers} loading={isLoading} />
        </Reveal>
      </section>

      {/* Акции */}
      {home && home.sale.length > 0 && (
        <section className="mt-12 bg-accent/60 py-10">
          <div className="container-lb">
            <Reveal>
              <SectionTitle title="Специальные предложения" linkTo="/catalog?flag=sale" />
              <BookRow books={home.sale} loading={isLoading} />
            </Reveal>
          </div>
        </section>
      )}

      {/* Преимущества */}
      <section className="container-lb mt-12">
        <Reveal>
          <SectionTitle title="Почему Lucky Bunny" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {ADVANTAGES.map((a) => (
              <div key={a.title} className="card-lb p-5">
                <a.icon className="h-7 w-7 text-primary" aria-hidden />
                <h3 className="mt-3 font-sans text-base font-extrabold">{a.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{a.text}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Оптовый блок */}
      <section className="container-lb mt-12">
        <Reveal>
          <div className="grid items-center gap-6 rounded-3xl bg-primary p-6 text-primary-foreground sm:p-10 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="text-2xl sm:text-3xl">Магазинам, школам и садам</h2>
              <p className="mt-3 max-w-xl text-sm opacity-90 sm:text-base">
                Оптовые цены от минимального количества, индивидуальные ценовые уровни для крупных заказов и персональный менеджер.
                Зарегистрируйте оптовый аккаунт — после проверки откроются специальные условия.
              </p>
            </div>
            <Link
              to="/wholesale"
              className="btn-press inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-foreground px-8 py-3 text-sm font-bold text-foreground hover:opacity-90"
            >
              Условия опта <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Подписка */}
      <section className="container-lb mt-12">
        <Reveal>
          <div className="card-lb mx-auto max-w-2xl p-6 text-center sm:p-8">
            <h2 className="text-xl sm:text-2xl">Новости и новые поступления</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Раз в пару недель — о новинках и акциях. Только с вашего согласия, отписаться можно в любой момент.
            </p>
            <NewsletterForm />
          </div>
        </Reveal>
      </section>
    </Layout>
  );
}
