import { db, ensureSchema } from "@/lib/db";

/**
 * Max conversions per account during the free period.
 * - unset / empty: unlimited (good for self-host dev)
 * - positive integer: enforce cap in POST /api/jobs
 */
export function getFreeTrialConversionLimit(): number | null {
  const enforce = (process.env.ENFORCE_FREE_TRIAL_LIMIT ?? "").trim().toLowerCase();
  if (enforce !== "true" && enforce !== "1" && enforce !== "yes") {
    return null; // fully free mode by default
  }
  const raw = process.env.FREE_TRIAL_CONVERSION_LIMIT?.trim();
  if (raw === undefined || raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export async function countUserConversions(userId: string): Promise<number> {
  await ensureSchema();
  const result = await db.query<{ c: string }>(
    `SELECT COUNT(*)::text AS c FROM jobs WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  return row ? Number.parseInt(row.c, 10) || 0 : 0;
}
