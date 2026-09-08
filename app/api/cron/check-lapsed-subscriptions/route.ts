import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/server/payments/mollie";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { sendOwnerAlertEmail } from "@/lib/server/email";

export const runtime = "nodejs";

// The webhook handler (app/api/payments/webhook/route.ts) is the primary
// mechanism for renewals and failures -- Mollie's own subscription
// schedule triggers it, and it reacts the instant a charge succeeds or
// fails. This cron is a safety net only, for the case a webhook delivery
// itself never arrives (a Mollie outage, a Vercel deploy mid-delivery,
// etc.): once a day, catch any "active" subscription whose period end
// has already passed with real margin, and downgrade it rather than
// leaving a customer on Pro with no confirmed payment behind it
// indefinitely.
const GRACE_PERIOD_MS = 2 * 24 * 60 * 60 * 1000; // 2 days past current_period_end

/**
 * Vercel automatically attaches `Authorization: Bearer $CRON_SECRET` to
 * requests it sends to a scheduled function when CRON_SECRET is set in
 * the project's environment variables -- this route is unreachable
 * (401) to anyone else, including a guessed or bookmarked URL.
 */
function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const provider = getPaymentProvider();
  const cutoffIso = new Date(Date.now() - GRACE_PERIOD_MS).toISOString();

  const { data: lapsed, error } = await supabase
    .from("user_subscriptions")
    .select("user_id, provider_customer_id, provider_subscription_id, current_period_end")
    .eq("status", "active")
    .lt("current_period_end", cutoffIso);

  if (error) {
    console.error("[cron/check-lapsed-subscriptions] query failed:", error);
    return NextResponse.json({ error: "Query failed." }, { status: 500 });
  }

  if (!lapsed || lapsed.length === 0) {
    return NextResponse.json({ checked: true, lapsed: 0 });
  }

  const nowIso = new Date().toISOString();
  let downgraded = 0;

  for (const row of lapsed) {
    const { error: subError } = await supabase
      .from("user_subscriptions")
      .update({ status: "past_due", updated_at: nowIso })
      .eq("user_id", row.user_id);
    if (subError) {
      console.error(`[cron] failed to downgrade user_subscriptions for ${row.user_id}:`, subError);
      continue;
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .update({ plan_tier: "free", updated_at: nowIso })
      .eq("id", row.user_id);
    if (profileError) {
      console.error(`[cron] failed to downgrade profiles.plan_tier for ${row.user_id}:`, profileError);
    }

    if (row.provider_customer_id && row.provider_subscription_id) {
      try {
        await provider.cancelSubscription(row.provider_customer_id, row.provider_subscription_id);
      } catch (cancelError) {
        console.error(`[cron] failed to cancel Mollie subscription for ${row.user_id}:`, cancelError);
      }
    }

    downgraded += 1;
  }

  if (downgraded > 0) {
    await sendOwnerAlertEmail({
      subject: `NXTIAI: ${downgraded} subscription(s) lapsed without a renewal webhook`,
      text:
        `The daily safety-net check found ${downgraded} subscription(s) whose billing period ` +
        `ended more than 2 days ago with no renewal or failure webhook ever received. They've ` +
        `been downgraded to Free automatically.\n\n` +
        `This should be rare -- if it keeps happening, check that Mollie's webhook deliveries ` +
        `to /api/payments/webhook are succeeding.\n\n` +
        `Affected users: ${lapsed.map((r) => r.user_id).join(", ")}`,
    });
  }

  return NextResponse.json({ checked: true, lapsed: lapsed.length, downgraded });
}
