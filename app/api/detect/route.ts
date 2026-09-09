import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, getClientIdentifier } from "@/lib/server/rate-limiter";
import { detectAiText } from "@/lib/server/providers/detector";
import { PlanLimitError, RateLimitError, ValidationError, toErrorResponse } from "@/lib/server/errors";
import { createClient } from "@/lib/supabase/server";
import { getUserPlan, getMonthlyDetectorCount } from "@/lib/server/plan-usage";
import { PLAN_CONFIG } from "@/lib/server/plans";

export const runtime = "nodejs";

// Absolute ceiling regardless of plan -- matches the Pro plan's
// maxCharsPerRequest (lib/server/plans.ts). Tighter, plan-aware limits
// are enforced below once the caller's plan is resolved.
const TEXT_MAX_LENGTH = 5000;

const detectRequestSchema = z.object({
  text: z
    .string({ error: "text is required." })
    .trim()
    .min(1, "Enter some text to check.")
    .max(TEXT_MAX_LENGTH, `Text must be ${TEXT_MAX_LENGTH} characters or fewer.`),
});

export async function POST(request: Request): Promise<NextResponse> {
  try {
    // Own rate-limit bucket (namespaced identifier) so heavy AI Detector
    // use never eats into a visitor's /api/rewrite budget, or vice versa.
    const identifier = `detect:${getClientIdentifier(request)}`;
    const rate = checkRateLimit(identifier);
    if (!rate.allowed) {
      throw new RateLimitError(rate.retryAfterMs);
    }

    const rawBody: unknown = await request.json().catch(() => {
      throw new ValidationError("Request body must be valid JSON.");
    });
    const parsed = detectRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid request.");
    }

    // Plan-based limits (lib/server/plans.ts is the single source of
    // truth) -- same pattern as app/api/rewrite/route.ts. Anonymous
    // callers are always "free". The monthly quota can only be enforced
    // for signed-in users, since it's counted from detector_history.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const plan = await getUserPlan(supabase, user?.id ?? null);
    const planLimits = PLAN_CONFIG[plan].limits;

    if (parsed.data.text.length > planLimits.maxCharsPerRequest) {
      throw new PlanLimitError(
        `The ${PLAN_CONFIG[plan].name} plan is limited to ${planLimits.maxCharsPerRequest} characters per check. Upgrade for a higher limit.`
      );
    }

    if (user && planLimits.monthlyDetectorQuota !== null) {
      const usedThisMonth = await getMonthlyDetectorCount(supabase, user.id);
      if (usedThisMonth >= planLimits.monthlyDetectorQuota) {
        throw new PlanLimitError(
          `You've used all ${planLimits.monthlyDetectorQuota} AI Detector checks included in your ${PLAN_CONFIG[plan].name} plan this month. Upgrade for a higher monthly limit.`
        );
      }
    }

    const result = await detectAiText(parsed.data.text);

    // Save to history for signed-in users -- this is also what powers
    // the monthly quota count above. Fire-and-forget, same pattern as
    // rewrites_history in app/api/rewrite/route.ts: a logging failure
    // must never break the response the user is waiting on.
    if (user) {
      supabase
        .from("detector_history")
        .insert({
          user_id: user.id,
          input_length: parsed.data.text.length,
          ai_likelihood_percent: result.aiLikelihoodPercent,
          verdict: result.verdict,
        })
        .then(({ error }) => {
          if (error) console.error("Failed to insert detector history:", error);
        });
    }

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
