import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const request = trpc.localAuth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    request.mutate({ email });
  };

  return (
    <Layout>
      <div className="container-lb flex justify-center py-12">
        <div className="card-lb w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl">Восстановление пароля</h1>
          {sent ? (
            <div className="mt-4 rounded-2xl bg-secondary p-4 text-sm">
              <p className="font-bold">Заявка принята</p>
              <p className="mt-1">
                Если аккаунт с таким email существует, администратор магазина свяжется с вами и поможет установить новый пароль.
                Обычно это занимает до одного рабочего дня.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Укажите email аккаунта — мы создадим заявку на восстановление, и администратор свяжется с вами.
              </p>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold">Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <button
                type="submit"
                disabled={request.isPending}
                className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                Отправить заявку
              </button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Link to="/login" className="font-semibold text-primary hover:underline">Вернуться ко входу</Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
