import { getDb } from "../queries/connection";
import { adminLogs } from "@db/schema";

export async function logAdminAction(
  user: { id: number; name?: string | null } | undefined,
  action: string,
  details?: string,
) {
  try {
    await getDb().insert(adminLogs).values({
      userId: user?.id ?? null,
      userName: user?.name ?? null,
      action,
      details: details ?? null,
    });
  } catch (e) {
    console.error("[admin-log] failed:", e);
  }
}
