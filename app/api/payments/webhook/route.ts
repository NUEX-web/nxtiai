import { NextResponse } from "next/server";
import { getPaymentProvider } from "@/lib/server/payments/mollie";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export const runtime = "nodejs";

interface MolliePaymentPayload {
  id: string;
  status: string;
  metadata: { userId?: string; planId?: string } | null;
}

/**
 * Mollie calls this after every payment status change. It is never
 * called by the browser and carries no Supabase session -- everything
 * here runs against the service-role client (bypasses RLS by design,
 * see lib/supabase/service-role.ts), and the payment status itself is
 * re-fetched from Mollie's own API inside handleWebhook, never trusted
 * from the POST body alone.
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const provider = getPaymentProvider();
    const event = await provider.handleWebhook(request);
    const payment = event.raw as MolliePaymentPayload;

    const userId = payment.metadata?.userId;
    const planId = payment.metadata?.planId;
    if (!userId || !planId) {
      console.error("Mollie webhook: payment has no userId/planId metadata", payment.id);
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceRoleClient();

    // Idempotency ledger: (provider, event_id) is unique (see
    // supabase/schema.sql). event_id includes the status so each status
    // transition (open -> paid, say) is recorded once, while Mollie
    // re-delivering the *same* transition -- which it can legitimately
    // do -- is a no-op the second time instead of double-processing.
    const { error: ledgerError } = await supabase.from("payment_webhook_events").insert({
      provider: "mollie",
      event_id: `${payment.id}:${payment.status}`,
      event_type: payment.status,
      processed_at: new Date().toISOString(),
    });

    if (ledgerError) {
      // Postgres unique_violation -- this exact (id, status) was already
      // processed. Acknowledge and stop; any other error, log it and
      // return non-200 so Mollie retries the delivery.
      if (ledgerError.code === "23505") {
        return NextResponse.json({ received: true });
      }
      console.error("Failed to record Mollie webhook event:", ledgerError);
      return NextResponse.json({ error: "Failed to record webhook event." }, { status: 500 });
    }

    if (payment.status === "paid") {
      const now = new Date().toISOString();

      const { error: subError } = await supabase.from("user_subscriptions").upsert(
        {
          user_id: userId,
          provider: "mollie",
          provider_subscription_id: payment.id,
          plan_id: planId,
          status: "active",
          current_period_start: now,
          updated_at: now,
        },
        { onConflict: "user_id" }
      );
      if (subError) console.error("Failed to update user_subscriptions:", subError);

      // profiles.plan_tier is what the account page and Navbar actually
      // display (see app/account/page.tsx, components/Navbar.tsx) --
      // user_subscriptions above is the detailed billing record, this
      // keeps the two in sync without changing either UI.
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ plan_tier: planId, updated_at: now })
        .eq("id", userId);
      if (profileError) console.error("Failed to update profiles.plan_tier:", profileError);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Mollie webhook handling failed:", error);
    // Non-200 so Mollie retries -- reaching this branch means we
    // couldn't even verify the payment against Mollie's API, not that
    // the payment itself failed.
    return NextResponse.json({ error: "Webhook handling failed." }, { status: 500 });
  }
}
