import { Link } from "react-router";
import { Layout } from "@/components/Layout";

export default function NotFound() {
  return (
    <Layout>
      <div className="container-lb flex flex-col items-center py-20 text-center">
        <img src="/logo.png" alt="" className="h-24 w-24 rounded-full object-cover opacity-80" />
        <h1 className="mt-6 text-3xl">Страница не найдена</h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Кажется, эта страница ускакала, как кролик. Проверьте адрес или вернитесь в каталог.
        </p>
        <div className="mt-6 flex gap-3">
          <Link to="/" className="btn-press min-h-11 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            На главную
          </Link>
          <Link to="/catalog" className="btn-press min-h-11 rounded-full border border-input bg-card px-6 py-3 text-sm font-bold">
            В каталог
          </Link>
        </div>
      </div>
    </Layout>
  );
}
