import { Link, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { formatPrice } from "@/lib/format";

export default function OrderSuccess() {
  const [params] = useSearchParams();
  const number = params.get("number") ?? "";
  const total = Number(params.get("total") ?? "0");

  return (
    <Layout>
      <div className="container-lb flex flex-col items-center py-16 text-center">
        <CheckCircle2 className="h-16 w-16 text-primary" aria-hidden />
        <h1 className="mt-4 text-2xl sm:text-3xl">Заказ оформлен!</h1>
        <p className="mt-3 max-w-md text-muted-foreground">
          Номер вашего заказа — <b className="text-foreground">{number}</b>
          {total > 0 && <> на сумму <b className="text-foreground">{formatPrice(total)}</b></>}.
          Мы свяжемся с вами для подтверждения.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/track" className="btn-press min-h-11 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground">
            Отследить заказ
          </Link>
          <Link to="/catalog" className="btn-press min-h-11 rounded-full border border-input bg-card px-6 py-3 text-sm font-bold">
            Продолжить покупки
          </Link>
        </div>
      </div>
    </Layout>
  );
}
