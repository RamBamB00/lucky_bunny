import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Download, Upload } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";

function TextSetting({ label, skey, values, setValues, multiline }: {
  label: string; skey: string; values: Record<string, string>;
  setValues: (fn: (v: Record<string, string>) => Record<string, string>) => void; multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}</span>
      {multiline ? (
        <textarea
          value={values[skey] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [skey]: e.target.value }))}
          rows={8}
          className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      ) : (
        <input
          value={values[skey] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [skey]: e.target.value }))}
          className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </label>
  );
}

export default function AdminSettings() {
  const utils = trpc.useUtils();
  const { data: settingsData } = trpc.admin.getSettings.useQuery();
  const { data: logs } = trpc.admin.listLogs.useQuery();
  const [values, setValues] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settingsData) setValues(settingsData);
  }, [settingsData]);

  const save = trpc.admin.setSettings.useMutation({
    onSuccess: () => { toast.success("Настройки сохранены"); utils.shop.publicConfig.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [contacts, setContacts] = useState({ phone: "", email: "", whatsapp: "", address: "", instagram: "" });
  useEffect(() => {
    try {
      const parsed = JSON.parse(values.contacts || "{}");
      setContacts({ phone: "", email: "", whatsapp: "", address: "", instagram: "", ...parsed });
    } catch { /* noop */ }
  }, [values.contacts]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    // Проверяем JSON-поля
    for (const key of ["deliveryMethods", "paymentMethods"]) {
      try { JSON.parse(values[key] || "[]"); } catch {
        toast.error(`Поле «${key}» содержит некорректный JSON`);
        return;
      }
    }
    save.mutate({ ...values, contacts: JSON.stringify(contacts) });
  };

  const importCsv = trpc.adminCatalog.importBooks.useMutation({
    onSuccess: (r) => {
      toast.success(`Импорт: создано ${r.created}, обновлено ${r.updated}${r.errors.length ? `, ошибок ${r.errors.length}` : ""}`);
      if (r.errors.length) console.warn("Import errors:", r.errors);
      utils.adminCatalog.listBooks.invalidate();
      utils.catalog.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const exportBooks = trpc.adminCatalog.exportBooks.useQuery(undefined, { enabled: false });

  const onImportFile = async (file: File) => {
    const text = await file.text();
    importCsv.mutate({ csv: text });
  };

  const downloadExport = async () => {
    const res = await exportBooks.refetch();
    if (!res.data) return;
    const blob = new Blob(["\uFEFF" + res.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "catalog.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <h1 className="mb-6 text-2xl">Настройки магазина</h1>

      <form onSubmit={submit} className="grid gap-4 lg:grid-cols-2">
        <section className="card-lb space-y-4 p-5">
          <h2 className="text-lg">Витрина</h2>
          <TextSetting label="Верхняя информационная полоса" skey="topBarText" values={values} setValues={setValues} />
          <div className="grid gap-3 sm:grid-cols-2">
            <TextSetting label="Бесплатная доставка от, ₸ (0 — нет)" skey="freeDeliveryFrom" values={values} setValues={setValues} />
            <TextSetting label="Мин. сумма оптового заказа, ₸ (0 — нет)" skey="minWholesaleOrder" values={values} setValues={setValues} />
          </div>

          <h2 className="pt-2 text-lg">Контакты</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {([["phone", "Телефон"], ["email", "Email"], ["whatsapp", "WhatsApp (номер)"], ["address", "Адрес"], ["instagram", "Instagram"]] as const).map(([k, label]) => (
              <label key={k} className="block">
                <span className="mb-1 block text-sm font-semibold">{label}</span>
                <input
                  value={contacts[k]}
                  onChange={(e) => setContacts((c) => ({ ...c, [k]: e.target.value }))}
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ))}
          </div>
        </section>

        <section className="card-lb space-y-4 p-5">
          <h2 className="text-lg">Доставка и оплата (JSON)</h2>
          <p className="text-xs text-muted-foreground">
            Способы доставки: список {"[{ id, name, description, fee, eta }]"}.
            Способы оплаты: {"[{ id, name, description }]"}.
          </p>
          <TextSetting label="Способы доставки" skey="deliveryMethods" values={values} setValues={setValues} multiline />
          <TextSetting label="Способы оплаты" skey="paymentMethods" values={values} setValues={setValues} multiline />
        </section>

        <section className="card-lb space-y-4 p-5 lg:col-span-2">
          <h2 className="text-lg">Тексты страниц</h2>
          <TextSetting label="Страница «Доставка и оплата»" skey="pageDelivery" values={values} setValues={setValues} multiline />
          <TextSetting label="Страница «Возврат и обмен»" skey="pageReturns" values={values} setValues={setValues} multiline />
          <TextSetting label="Страница «Условия покупки»" skey="pageTerms" values={values} setValues={setValues} multiline />
          <TextSetting label="Условия опта (страница «Оптовым покупателям»)" skey="wholesaleText" values={values} setValues={setValues} multiline />
          <TextSetting label="О магазине" skey="aboutText" values={values} setValues={setValues} multiline />
        </section>

        <div className="lg:col-span-2">
          <Button type="submit" className="rounded-full" disabled={save.isPending}>Сохранить все настройки</Button>
        </div>
      </form>

      <section className="card-lb mt-6 p-5">
        <h2 className="mb-3 text-lg">Импорт / экспорт каталога</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          CSV с разделителем «;»: isbn;title;author;publisher;category;language;year;description;priceRetail;priceWholesale;wholesaleMinQty;stock;coverUrl.
          Книги с существующим ISBN обновляются, остальные создаются. Отчёт об ошибках показывается после импорта.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => fileRef.current?.click()} disabled={importCsv.isPending}>
            <Upload className="mr-2 h-4 w-4" /> {importCsv.isPending ? "Импортируем…" : "Импорт CSV"}
          </Button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); e.target.value = ""; }} />
          <Button variant="outline" className="rounded-full" onClick={downloadExport}>
            <Download className="mr-2 h-4 w-4" /> Экспорт CSV
          </Button>
        </div>
        {importCsv.data && importCsv.data.errors.length > 0 && (
          <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-muted p-3 text-xs text-destructive">
            {importCsv.data.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
      </section>

      <section className="card-lb mt-6 p-5">
        <h2 className="mb-3 text-lg">Журнал действий</h2>
        {(!logs || logs.length === 0) && <p className="text-sm text-muted-foreground">Пока пусто.</p>}
        <ul className="max-h-96 space-y-1 overflow-y-auto text-xs">
          {logs?.map((l) => (
            <li key={l.id} className="flex flex-wrap gap-x-3 rounded-lg px-2 py-1.5 hover:bg-muted">
              <span className="text-muted-foreground">{formatDateTime(l.createdAt)}</span>
              <b>{l.userName ?? "—"}</b>
              <span>{l.action}</span>
              <span className="text-muted-foreground">{l.details}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
