import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const utils = trpc.useUtils();

  const { data: usersData } = trpc.admin.listUsers.useQuery({ search: search || undefined, page });
  const { data: wholesaleReqs } = trpc.admin.listWholesaleRequests.useQuery();
  const { data: resets } = trpc.admin.listPasswordResets.useQuery();

  const setRole = trpc.admin.setUserRole.useMutation({
    onSuccess: () => { toast.success("Роль обновлена"); utils.admin.listUsers.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const setWholesale = trpc.admin.setWholesaleStatus.useMutation({
    onSuccess: () => {
      toast.success("Статус оптового аккаунта обновлён");
      utils.admin.listUsers.invalidate();
      utils.admin.listWholesaleRequests.invalidate();
      utils.admin.stats.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const [pwFor, setPwFor] = useState<number | null>(null);
  const [newPw, setNewPw] = useState("");
  const resolveReset = trpc.admin.resolvePasswordReset.useMutation({
    onSuccess: () => {
      toast.success("Новый пароль установлен. Передайте его клиенту.");
      setPwFor(null);
      setNewPw("");
      utils.admin.listPasswordResets.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const rejectReset = trpc.admin.rejectPasswordReset.useMutation({
    onSuccess: () => utils.admin.listPasswordResets.invalidate(),
  });

  const pendingWholesale = (wholesaleReqs ?? []).filter((r) => r.status === "pending");
  const pendingResets = (resets ?? []).filter((r) => r.status === "pending");

  const submitNewPw = (e: FormEvent) => {
    e.preventDefault();
    if (pwFor != null) resolveReset.mutate({ resetId: pwFor, newPassword: newPw });
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl">Пользователи</h1>

      {pendingWholesale.length > 0 && (
        <section className="card-lb p-4">
          <h2 className="mb-3 text-lg">Заявки на оптовый аккаунт</h2>
          <ul className="space-y-3">
            {pendingWholesale.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border p-4">
                <p className="text-sm font-bold">{r.userName ?? "Без имени"} — {r.companyName ?? "компания не указана"}</p>
                <p className="text-xs text-muted-foreground">{r.userEmail} · {r.userPhone} · {formatDate(r.createdAt)}</p>
                {r.message && <p className="mt-1 text-sm">{r.message}</p>}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="rounded-full" onClick={() => setWholesale.mutate({ id: r.userId, status: "approved" })}>
                    Одобрить
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => setWholesale.mutate({ id: r.userId, status: "rejected" })}>
                    Отклонить
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingResets.length > 0 && (
        <section className="card-lb p-4">
          <h2 className="mb-3 text-lg">Заявки на восстановление пароля</h2>
          <ul className="space-y-3">
            {pendingResets.map((r) => (
              <li key={r.id} className="rounded-2xl border border-border p-4">
                <p className="text-sm font-bold">{r.userName ?? ""} — {r.email}</p>
                <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</p>
                {pwFor === r.id ? (
                  <form onSubmit={submitNewPw} className="mt-2 flex flex-wrap gap-2">
                    <input
                      type="text"
                      value={newPw}
                      onChange={(e) => setNewPw(e.target.value)}
                      minLength={6}
                      required
                      placeholder="Новый пароль (передайте клиенту)"
                      className="min-h-11 flex-1 rounded-xl border border-input bg-background px-3 text-sm"
                    />
                    <Button size="sm" type="submit" className="rounded-full">Установить</Button>
                    <Button size="sm" variant="outline" type="button" className="rounded-full" onClick={() => setPwFor(null)}>Отмена</Button>
                  </form>
                ) : (
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" className="rounded-full" onClick={() => setPwFor(r.id)}>Задать новый пароль</Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => rejectReset.mutate({ resetId: r.id })}>Отклонить</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div>
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Поиск по имени, email, телефону, компании"
          aria-label="Поиск пользователей"
          className="mb-4 min-h-11 w-full max-w-md rounded-xl border border-input bg-card px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <div className="card-lb overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="p-3">Имя</th>
                <th className="p-3">Контакты</th>
                <th className="p-3">Тип</th>
                <th className="p-3">Роль</th>
                <th className="p-3">Регистрация</th>
                <th className="p-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody>
              {usersData?.items.map((u) => (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 font-semibold">{u.name ?? "—"}</td>
                  <td className="p-3 text-xs">{u.email ?? "—"}<br />{u.phone ?? ""}</td>
                  <td className="p-3 text-xs">
                    {u.accountType === "wholesale" ? (
                      <>Опт · <b className={u.wholesaleStatus === "approved" ? "text-primary" : ""}>{u.wholesaleStatus}</b>
                      {u.companyName && <><br />{u.companyName}</>}</>
                    ) : "Розница"}
                  </td>
                  <td className="p-3 text-xs font-bold">{u.role === "admin" ? "Админ" : "Пользователь"}</td>
                  <td className="p-3 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-1">
                      {u.accountType === "wholesale" && u.wholesaleStatus !== "approved" && (
                        <Button size="sm" variant="outline" className="rounded-full text-xs"
                          onClick={() => setWholesale.mutate({ id: u.id, status: "approved" })}>
                          Одобрить опт
                        </Button>
                      )}
                      <Button
                        size="sm" variant="outline" className="rounded-full text-xs"
                        onClick={() => {
                          const next = u.role === "admin" ? "user" : "admin";
                          if (confirm(`Изменить роль на «${next === "admin" ? "Админ" : "Пользователь"}»?`)) {
                            setRole.mutate({ id: u.id, role: next });
                          }
                        }}
                      >
                        {u.role === "admin" ? "Снять админа" : "Сделать админом"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {usersData && usersData.total > 30 && (
          <div className="mt-4 flex items-center gap-2 text-sm">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Назад</Button>
            <span>Стр. {page}</span>
            <Button variant="outline" size="sm" disabled={page * 30 >= usersData.total} onClick={() => setPage(page + 1)}>Вперёд</Button>
          </div>
        )}
      </div>
    </div>
  );
}
