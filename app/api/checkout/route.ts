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

    const { data: existing } = await supabase
      .from("user_subscriptions")
      .select("plan_id, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    if (existing && existing.plan_id === planId) {
      throw new ValidationError(`You already have an active ${planId} plan.`);
    }

    // Environment-aware by construction, same pattern as the Google
    // OAuth redirectTo in components/AuthModal.tsx: derived from the
    // incoming request's own origin, never hardcoded to localhost or a
    // fixed production domain.
    const { origin } = new URL(request.url);
    const provider = getPaymentProvider();
    const session = await provider.createCheckout({
      userId: user.id,
      planId,
      successUrl: `${origin}/account?checkout=${planId}`,
      cancelUrl: `${origin}/account?checkout=cancelled`,
      webhookUrl: `${origin}/api/payments/webhook`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return toErrorResponse(error);
  }
}
