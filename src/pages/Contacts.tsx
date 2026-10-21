import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";

export default function Contacts() {
  const { data: config } = trpc.shop.publicConfig.useQuery();
  const [form, setForm] = useState({ name: "", contact: "", message: "" });
  const send = trpc.shop.contact.useMutation({
    onSuccess: () => {
      toast.success("Сообщение отправлено — мы ответим в ближайшее время.");
      setForm({ name: "", contact: "", message: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate(form);
  };

  const c = config?.contacts;

  return (
    <Layout>
      <div className="container-lb grid max-w-4xl gap-8 py-10 md:grid-cols-2">
        <div>
          <h1 className="text-2xl sm:text-3xl">Контакты</h1>
          <ul className="mt-6 space-y-3 text-sm">
            {c?.phone && (
              <li><span className="font-bold">Телефон: </span><a className="text-primary hover:underline" href={`tel:${c.phone.replace(/[^+\d]/g, "")}`}>{c.phone}</a></li>
            )}
            {c?.email && (
              <li><span className="font-bold">Email: </span><a className="text-primary hover:underline" href={`mailto:${c.email}`}>{c.email}</a></li>
            )}
            {c?.whatsapp && (
              <li><span className="font-bold">WhatsApp: </span><a className="text-primary hover:underline" href={`https://wa.me/${c.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">Написать нам</a></li>
            )}
            {c?.address && <li><span className="font-bold">Адрес: </span>{c.address}</li>}
          </ul>
        </div>
        <form onSubmit={submit} className="card-lb space-y-4 p-5">
          <h2 className="text-lg">Написать нам</h2>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Имя *</span>
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              minLength={2}
              className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Телефон или email *</span>
            <input
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
              required
              minLength={3}
              className="min-h-11 w-full rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">Сообщение *</span>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              required
              minLength={3}
              rows={4}
              className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <button
            type="submit"
            disabled={send.isPending}
            className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            Отправить
          </button>
        </form>
      </div>
    </Layout>
  );
}
