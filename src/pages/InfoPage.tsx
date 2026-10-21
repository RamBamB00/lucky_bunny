import { Layout } from "@/components/Layout";
import { trpc } from "@/providers/trpc";
import { Skeleton } from "@/components/ui/skeleton";

const TITLES: Record<string, string> = {
  pageDelivery: "Доставка и оплата",
  pageReturns: "Возврат и обмен",
  pageTerms: "Условия покупки",
  aboutText: "О магазине",
};

export default function InfoPage({ pageKey }: { pageKey: "pageDelivery" | "pageReturns" | "pageTerms" | "aboutText" }) {
  const { data, isLoading } = trpc.shop.page.useQuery({ key: pageKey });

  return (
    <Layout>
      <div className="container-lb max-w-3xl py-10">
        <h1 className="text-2xl sm:text-3xl">{TITLES[pageKey]}</h1>
        {isLoading ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-5/6" />
            <Skeleton className="h-5 w-4/6" />
          </div>
        ) : (
          <div className="mt-6 whitespace-pre-line text-sm leading-relaxed text-foreground/90 sm:text-base">
            {data?.content || "Информация скоро появится."}
          </div>
        )}
      </div>
    </Layout>
  );
}
