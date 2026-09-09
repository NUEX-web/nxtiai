import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePlanId, type PlanId } from "./plans";

/**
 * Plan resolution and usage counting shared by every quota-enforcing
 * route (app/api/rewrite, app/api/detect, app/api/voices,
 * app/api/history, app/account). Every count here is a real Supabase
 * query against a table the route already writes to (rewrites_history,
 * detector_history, custom_voices) -- there is no separate ledger to
 * drift out of sync with reality.
 */

/** profiles.plan_tier for a signed-in user, resolved to a known PlanId.
 * Anonymous callers (userId === null) are always "free" -- see
 * resolvePlanId in lib/server/plans.ts. */
export async function getUserPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string | null
): Promise<PlanId> {
  if (!userId) return "free";
  const { data } = await supabase.from("profiles").select("plan_tier").eq("id", userId).maybeSingle();
  return resolvePlanId(data?.plan_tier as string | null | undefined);
}

/** Start of the current calendar month in UTC, as an ISO string -- the
 * boundary every monthly quota counts from. Matches how Mollie's own
 * "1 month" subscription interval is described elsewhere in this
 * codebase: a plain calendar-month window, not a rolling 30-day one. */
function startOfCurrentMonthIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

async function countSince(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  table: string,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfCurrentMonthIso());
  if (error) {
    console.error(`Failed to count ${table} for quota check:`, error);
    // Fail open: a counting error must never block a legitimate rewrite
    // or detection -- the same philosophy as recordUsage() in
    // usage-tracker.ts being fire-and-forget.
    return 0;
  }
  return count ?? 0;
}

export function getMonthlyRewriteCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  return countSince(supabase, "rewrites_history", userId);
}

export function getMonthlyDetectorCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  return countSince(supabase, "detector_history", userId);
}

export async function getVoiceProfileCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  userId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("custom_voices")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) {
    console.error("Failed to count custom_voices for quota check:", error);
    return 0;
  }
  return count ?? 0;
}
