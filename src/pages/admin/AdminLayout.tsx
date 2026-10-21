import { Link, NavLink, Navigate, Outlet } from "react-router";
import {
  BookCopy, ClipboardList, Home, LayoutDashboard, MessageSquare, Settings, Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV = [
  { to: "/admin", label: "Обзор", icon: LayoutDashboard, end: true },
  { to: "/admin/books", label: "Товары", icon: BookCopy },
  { to: "/admin/orders", label: "Заказы", icon: ClipboardList },
  { to: "/admin/users", label: "Пользователи", icon: Users },
  { to: "/admin/content", label: "Контент", icon: MessageSquare },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
];

export default function AdminLayout() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">Проверяем доступ…</div>;
  }
  if (!isAuthenticated || user?.role !== "admin") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border bg-card p-4 lg:flex">
        <Link to="/" className="flex items-center gap-2 px-2 py-2">
          <img src="/logo.png" alt="" className="h-9 w-9 rounded-full object-cover" />
          <span className="font-display text-sm leading-tight">Lucky Bunny<br /><span className="text-xs text-muted-foreground">админ-панель</span></span>
        </Link>
        <nav className="mt-6 flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold ${
                  isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`
              }
            >
              <n.icon className="h-4 w-4" aria-hidden /> {n.label}
            </NavLink>
          ))}
        </nav>
        <Link to="/" className="mt-auto flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold hover:bg-muted">
          <Home className="h-4 w-4" aria-hidden /> На сайт
        </Link>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Мобильная навигация админки */}
        <nav className="sticky top-0 z-40 flex gap-1 overflow-x-auto border-b border-border bg-card p-2 no-scrollbar lg:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-xs font-bold ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-muted/60"
                }`
              }
            >
              <n.icon className="h-4 w-4" aria-hidden /> {n.label}
            </NavLink>
          ))}
          <Link to="/" className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-muted/60 px-4 text-xs font-bold">
            <Home className="h-4 w-4" aria-hidden /> Сайт
          </Link>
        </nav>
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
