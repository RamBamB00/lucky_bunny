import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";

export default function Register() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    accountType: (params.get("type") === "wholesale" ? "wholesale" : "retail") as "retail" | "wholesale",
    companyName: "",
  });
  const [consent, setConsent] = useState(false);
  const [newsletter, setNewsletter] = useState(false);

  const register = trpc.localAuth.register.useMutation({
    onSuccess: async (r) => {
      await utils.invalidate();
      if (r.wholesalePending) {
        toast.success("Аккаунт создан! Заявка на опт отправлена на проверку.");
      } else {
        toast.success("Добро пожаловать в Lucky Bunny!");
      }
      navigate("/account");
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Подтвердите согласие с условиями");
      return;
    }
    register.mutate({ ...form, newsletterOptIn: newsletter });
  };

  const field = (label: string, key: "name" | "email" | "phone" | "password" | "companyName", type = "text", required = true) => (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold">{label}{required && " *"}</span>
      <input
        type={type}
        required={required}
        minLength={key === "password" ? 6 : key === "name" ? 2 : undefined}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );

  return (
    <Layout>
      <div className="container-lb flex justify-center py-12">
        <div className="card-lb w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl">Регистрация</h1>

          <div className="mt-4 grid grid-cols-2 gap-2 rounded-full bg-muted p-1" role="radiogroup" aria-label="Тип аккаунта">
            {([
              ["retail", "Покупатель"],
              ["wholesale", "Оптовый покупатель"],
            ] as const).map(([v, label]) => (
              <button
                key={v}
                type="button"
                onClick={() => setForm((f) => ({ ...f, accountType: v }))}
                aria-pressed={form.accountType === v}
                className={`min-h-11 rounded-full text-sm font-bold transition-colors ${
                  form.accountType === v ? "bg-card shadow" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {field("Имя и фамилия", "name")}
            {form.accountType === "wholesale" && field("Название компании", "companyName")}
            {field("Email", "email", "email")}
            {field("Телефон", "phone", "tel")}
            {field("Пароль (не короче 6 символов)", "password", "password")}

            {form.accountType === "wholesale" && (
              <p className="rounded-xl bg-secondary p-3 text-xs">
                Оптовые цены откроются после проверки заявки администратором.
              </p>
            )}

            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={newsletter} onChange={(e) => setNewsletter(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5E8C7B]" />
              Хочу получать новости и акции на email (необязательно)
            </label>
            <label className="flex items-start gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#5E8C7B]" />
              Соглашаюсь с <Link to="/terms" className="font-semibold text-primary hover:underline">условиями покупки</Link> *
            </label>

            <button
              type="submit"
              disabled={register.isPending}
              className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {register.isPending ? "Создаём…" : "Создать аккаунт"}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Уже есть аккаунт? <Link to="/login" className="font-semibold text-primary hover:underline">Войти</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
