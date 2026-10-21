/**
 * Простой кеш в памяти процесса для редко меняющихся публичных данных
 * (настройки магазина, категории, баннеры, данные главной).
 * - TTL ограничивает «устаревание» данных;
 * - одинаковые одновременные запросы объединяются в один;
 * - любая мутация администратора сбрасывает кеш целиком (см. middleware.ts).
 */
type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let generation = 0;

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const gen = generation;
  const p = load()
    .then((value) => {
      // Если кеш сбросили, пока шёл запрос, не сохраняем устаревшие данные
      if (gen === generation) store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function clearCache() {
  generation += 1;
  store.clear();
  inflight.clear();
}
