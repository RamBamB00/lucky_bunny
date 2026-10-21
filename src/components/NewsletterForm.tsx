import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const subscribe = trpc.shop.subscribe.useMutation({
    onSuccess: () => {
      toast.success("Спасибо! Вы подписаны на новости Lucky Bunny.");
      setEmail("");
      setConsent(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!consent) {
      toast.error("Подтвердите согласие на получение рассылки");
      return;
    }
    subscribe.mutate({ email, consent: true });
  };

  return (
    <form onSubmit={submit} className="mx-auto mt-4 max-w-md">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ваш email"
          aria-label="Email для подписки"
          className="min-h-11 flex-1 rounded-full border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={subscribe.isPending}
          className="btn-press min-h-11 rounded-full bg-primary px-6 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Подписаться
        </button>
      </div>
      <label className="mt-3 flex items-start justify-center gap-2 text-left text-xs text-muted-foreground">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-input accent-[#5E8C7B]"
        />
        Соглашаюсь получать новости и предложения Lucky Bunny на указанный email
      </label>
    </form>
  );
}
