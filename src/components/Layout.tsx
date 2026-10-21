import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import { Heart, Menu, Search, ShoppingBasket, User, X } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/providers/cart";
import { useFavorites } from "@/providers/favorites";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

function SearchBox({ onNavigate, autoFocus }: { onNavigate?: () => void; autoFocus?: boolean }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const boxRef = useRef<HTMLDivElement>(null);
  const { data: suggestions } = trpc.catalog.suggest.useQuery({ q }, { enabled: q.trim().length >= 2 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = () => {
    if (!q.trim()) return;
    navigate(`/catalog?search=${encodeURIComponent(q.trim())}`);
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-full border border-input bg-card px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <input
          value={q}
          autoFocus={autoFocus}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Название, автор или ISBN"
          aria-label="Поиск по каталогу"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Очистить поиск" className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-40 mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-lg">
          {suggestions && suggestions.length > 0 ? (
            <ul>
              {suggestions.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/book/${s.slug}`}
                    onClick={() => { setOpen(false); onNavigate?.(); }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
                  >
                    {s.coverUrl && <img src={s.coverUrl} alt="" className="h-10 w-7 rounded object-cover" loading="lazy" />}
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{s.title}</span>
                      {s.author && <span className="block truncate text-xs text-muted-foreground">{s.author}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Ничего не найдено — попробуйте изменить запрос</p>
          )}
          <button
            onClick={submit}
            className="block w-full border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-primary hover:bg-muted"
          >
            Показать все результаты
          </button>
        </div>
      )}
    </div>
  );
}

const NAV = [
  { to: "/catalog", label: "Каталог" },
  { to: "/catalog?flag=new", label: "Новинки" },
  { to: "/catalog?flag=bestseller", label: "Бестселлеры" },
  { to: "/catalog?flag=sale", label: "Акции" },
  { to: "/wholesale", label: "Оптовым покупателям" },
  { to: "/delivery", label: "Доставка и оплата" },
];

export function Header() {
  const { user, isAuthenticated } = useAuth();
  const cart = useCart();
  const fav = useFavorites();
  const { data: config } = trpc.shop.publicConfig.useQuery();
  const { data: categories } = trpc.catalog.categories.useQuery();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50">
      {config?.topBarText && (
        <div className="bg-primary px-4 py-2 text-center text-xs font-semibold text-primary-foreground sm:text-sm">
          {config.topBarText}
        </div>
      )}
      <div className="border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="container-lb flex items-center gap-3 py-3">
          {/* Мобильное меню */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden min-h-11 min-w-11" aria-label="Открыть меню">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-sm overflow-y-auto bg-card p-0">
              <SheetTitle className="sr-only">Меню</SheetTitle>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <img src="/logo.png" alt="Lucky Bunny" className="h-10 w-10 rounded-full object-cover" />
                <span className="font-display text-lg">Lucky Bunny</span>
              </div>
              <div className="p-4">
                <SearchBox onNavigate={() => setMobileOpen(false)} />
              </div>
              <nav className="flex flex-col px-2 pb-6">
                {NAV.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-3 py-3 text-base font-semibold hover:bg-muted"
                  >
                    {item.label}
                  </Link>
                ))}
                {categories && categories.length > 0 && (
                  <>
                    <p className="mt-4 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Категории</p>
                    {categories.map((c) => (
                      <Link
                        key={c.id}
                        to={`/catalog?category=${c.slug}`}
                        onClick={() => setMobileOpen(false)}
                        className="rounded-xl px-3 py-2.5 text-sm hover:bg-muted"
                      >
                        {c.name}
                      </Link>
                    ))}
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>

          {/* Логотип */}
          <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="Lucky Bunny — на главную">
            <img src="/logo.png" alt="" className="h-11 w-11 rounded-full border border-border object-cover" />
            <span className="hidden font-display text-xl leading-none sm:block">
              Lucky<br />Bunny
            </span>
          </Link>

          {/* Поиск (десктоп) */}
          <div className="hidden flex-1 md:block">
            <SearchBox />
          </div>

          {/* Действия */}
          <nav className="ml-auto flex items-center gap-1" aria-label="Действия">
            <Link
              to="/favorites"
              className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl px-2 text-xs hover:bg-muted"
              aria-label={`Избранное, ${fav.count}`}
            >
              <Heart className="h-5 w-5" aria-hidden />
              {fav.count > 0 && (
                <span className="absolute -right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F28482] px-1 text-[10px] font-bold text-white">
                  {fav.count}
                </span>
              )}
              <span className="hidden sm:block">Избранное</span>
            </Link>
            <Link
              to={isAuthenticated ? "/account" : "/login"}
              className="flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl px-2 text-xs hover:bg-muted"
              aria-label="Личный кабинет"
            >
              <User className="h-5 w-5" aria-hidden />
              <span className="hidden max-w-20 truncate sm:block">{isAuthenticated ? (user?.name?.split(" ")[0] ?? "Кабинет") : "Войти"}</span>
            </Link>
            <Link
              to="/cart"
              className="relative flex min-h-11 min-w-11 flex-col items-center justify-center rounded-xl px-2 text-xs hover:bg-muted"
              aria-label={`Корзина, ${cart.count}`}
            >
              <ShoppingBasket className="h-5 w-5" aria-hidden />
              {cart.count > 0 && (
                <span className="absolute -right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                  {cart.count}
                </span>
              )}
              <span className="hidden sm:block">Корзина</span>
            </Link>
          </nav>
        </div>

        {/* Поиск на мобильном */}
        <div className="container-lb pb-3 md:hidden">
          <SearchBox />
        </div>

        {/* Навигация (десктоп) */}
        <nav className="hidden border-t border-border/60 lg:block" aria-label="Основная навигация">
          <div className="container-lb flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-full px-4 py-2.5 text-sm font-semibold hover:bg-muted"
              >
                {item.label}
              </Link>
            ))}
            {categories?.slice(0, 4).map((c) => (
              <Link
                key={c.id}
                to={`/catalog?category=${c.slug}`}
                className="rounded-full px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {c.name}
              </Link>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  const { data: config } = trpc.shop.publicConfig.useQuery();
  const { data: categories } = trpc.catalog.categories.useQuery();
  const contacts = config?.contacts;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div className="container-lb grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-full object-cover" />
            <span className="font-display text-lg">Lucky Bunny</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Книжный интернет-магазин: сказки, энциклопедии и художественная литература. Опт и розница.
          </p>
        </div>
        <nav aria-label="Покупателям">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Покупателям</p>
          <ul className="space-y-2 text-sm">
            <li><Link className="hover:text-primary" to="/catalog">Каталог</Link></li>
            <li><Link className="hover:text-primary" to="/delivery">Доставка и оплата</Link></li>
            <li><Link className="hover:text-primary" to="/returns">Возврат и обмен</Link></li>
            <li><Link className="hover:text-primary" to="/terms">Условия покупки</Link></li>
            <li><Link className="hover:text-primary" to="/wholesale">Оптовым покупателям</Link></li>
          </ul>
        </nav>
        <nav aria-label="Категории">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Категории</p>
          <ul className="space-y-2 text-sm">
            {categories?.map((c) => (
              <li key={c.id}><Link className="hover:text-primary" to={`/catalog?category=${c.slug}`}>{c.name}</Link></li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-muted-foreground">Контакты</p>
          <ul className="space-y-2 text-sm">
            {contacts?.phone && <li><a className="hover:text-primary" href={`tel:${contacts.phone.replace(/[^+\d]/g, "")}`}>{contacts.phone}</a></li>}
            {contacts?.email && <li><a className="hover:text-primary" href={`mailto:${contacts.email}`}>{contacts.email}</a></li>}
            {contacts?.whatsapp && (
              <li><a className="hover:text-primary" href={`https://wa.me/${contacts.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">WhatsApp</a></li>
            )}
            {contacts?.address && <li className="text-muted-foreground">{contacts.address}</li>}
            <li><Link className="hover:text-primary" to="/contacts">Форма обратной связи</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {year} Lucky Bunny. Демонстрационные товары помечены в каталоге.
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col paper-bg">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
