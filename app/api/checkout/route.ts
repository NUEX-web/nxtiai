import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getPaymentProvider } from "@/lib/server/payments/mollie";
import type { PayablePlanId } from "@/lib/server/payments/provider";
import { UnauthorizedError, ValidationError, toErrorResponse } from "@/lib/server/errors";

export const runtime = "nodejs";

const checkoutRequestSchema = z.object({
  // Business is sold through the "Talk to us" mailto flow on the pricing
  // page, not checkout -- "pro" is the only payable plan this route
  // accepts today. See components/PricingPreview.tsx.
  planId: z.literal("pro"),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rawBody: unknown = await request.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON.");
    });
    const parsed = checkoutRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError('planId must be "pro".');
    }
    const planId = parsed.data.planId as PayablePlanId;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new UnauthorizedError("Sign in before starting checkout.");
    }

    // Only SELECT is available here -- this route runs with the user's
    // own session, and user_subscriptions has no insert/update policy
    // for the authenticated role (see supabase/schema.sql). Any write
    // (saving a new provider_customer_id, activating a plan) happens in
    // the webhook handler via the service-role client, once Mollie has
    // independently confirmed the relevant state -- never here.
    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("plan_id, status, provider_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing?.status === "active" && existing.plan_id === planId) {
      throw new ValidationError(`You already have an active ${planId} plan.`);
    }

    const provider = getPaymentProvider();

    // Reuse the customer already on file for this user if one exists;
    // otherwise create a fresh one. Not persisted from this route (see
    // the RLS note above) -- the webhook handler saves it from Mollie's
    // own payment response once the mandate-creating payment is
    // confirmed paid, which is also the only value ever trusted for it.
    const customerId =
      existing?.provider_customer_id ||
      (
        await provider.createCustomer({
          userId: user.id,
          email: user.email ?? "",
          name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : undefined,
        })
      ).id;

    // Environment-aware by construction, same pattern as the Google
    // OAuth redirectTo in components/AuthModal.tsx: derived from the
    // incoming request's own origin, never hardcoded to localhost or a
    // fixed production domain.
    const { origin } = new URL(request.url);
    const session = await provider.createCheckout({
      userId: user.id,
      planId,
      customerId,
      successUrl: `${origin}/account?checkout=${planId}`,
      cancelUrl: `${origin}/account?checkout=cancelled`,
      webhookUrl: `${origin}/api/payments/webhook`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toErrorResponse(error);
  }
}
