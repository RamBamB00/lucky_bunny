import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { BookOpen } from "lucide-react";

// Плавное появление при скролле (IntersectionObserver, без анимационных библиотек)
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setVisible(true);
            io.disconnect();
          }
        });
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${visible ? "is-visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ title, linkTo, linkLabel }: { title: string; linkTo?: string; linkLabel?: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <h2 className="text-xl sm:text-2xl">{title}</h2>
      {linkTo && (
        <Link to={linkTo} className="shrink-0 text-sm font-bold text-primary hover:underline">
          {linkLabel ?? "Смотреть все"}
        </Link>
      )}
    </div>
  );
}

export function EmptyState({ title, hint, actionTo, actionLabel }: { title: string; hint?: string; actionTo?: string; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
      <BookOpen className="h-10 w-10 text-muted-foreground" aria-hidden />
      <p className="font-display text-lg">{title}</p>
      {hint && <p className="max-w-md text-sm text-muted-foreground">{hint}</p>}
      {actionTo && actionLabel && (
        <Link to={actionTo} className="btn-press mt-2 rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
