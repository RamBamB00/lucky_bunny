import { trpc } from "@/providers/trpc";
import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { LOGIN_PATH } from "@/const";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = LOGIN_PATH } =
    options ?? {};

  const navigate = useNavigate();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = trpc.auth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  // Если сервер ответил «не авторизован» (вышли, сессия истекла), React Query
  // всё равно хранит ПРЕДЫДУЩИЕ данные пользователя. Игнорируем их.
  const unauthorized =
    error?.data?.code === "UNAUTHORIZED" || error?.data?.code === "FORBIDDEN";
  const user = unauthorized ? null : (data ?? null);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      // Полная перезагрузка сбрасывает весь кеш (имя, заказы, избранное),
      // иначе в шапке и в кабинете остаются данные прежнего пользователя.
      window.location.assign(redirectPath);
    },
    onError: (e) => {
      // Сессия уже недействительна — просто уходим на страницу входа
      if (e.data?.code === "UNAUTHORIZED" || e.data?.code === "FORBIDDEN") {
        window.location.assign(redirectPath);
      }
    },
  });

  const logout = useCallback(() => logoutMutation.mutate(), [logoutMutation]);

  useEffect(() => {
    if (redirectOnUnauthenticated && !isLoading && !user) {
      const currentPath = window.location.pathname;
      if (currentPath !== redirectPath) {
        navigate(redirectPath);
      }
    }
  }, [redirectOnUnauthenticated, isLoading, user, navigate, redirectPath]);

  return useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading: isLoading || logoutMutation.isPending,
      error,
      logout,
      refresh: refetch,
    }),
    [user, isLoading, logoutMutation.isPending, error, logout, refetch],
  );
}
