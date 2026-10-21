import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Layout } from "@/components/Layout";

// Kimi OAuth — не изменять логику построения URL
function getOAuthUrl() {
  const kimiAuthUrl = import.meta.env.VITE_KIMI_AUTH_URL;
  const appID = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const state = btoa(redirectUri);

  const url = new URL(`${kimiAuthUrl}/api/oauth/authorize`);
  url.searchParams.set("client_id", appID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "profile");
  url.searchParams.set("state", state);

  return url.toString();
}

export default function Login() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const login = trpc.localAuth.login.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/account");
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate({ email, password });
  };

  return (
    <Layout>
      <div className="container-lb flex justify-center py-12">
        <div className="card-lb w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl">Вход</h1>
          <p className="mt-1 text-sm text-muted-foreground">В личный кабинет Lucky Bunny</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Email</span>
              <input
                type="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-semibold">Пароль</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            <button
              type="submit"
              disabled={login.isPending}
              className="btn-press min-h-11 w-full rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
            >
              {login.isPending ? "Входим…" : "Войти"}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="font-semibold text-primary hover:underline">
              Забыли пароль?
            </Link>
            <Link to="/register" className="font-semibold text-primary hover:underline">
              Регистрация
            </Link>
          </div>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            или
            <span className="h-px flex-1 bg-border" />
          </div>

          <button
            onClick={() => { window.location.href = getOAuthUrl(); }}
            className="btn-press min-h-11 w-full rounded-full border border-input bg-card py-3 text-sm font-bold hover:bg-muted"
          >
            Войти через Kimi
          </button>
        </div>
      </div>
    </Layout>
  );
}
