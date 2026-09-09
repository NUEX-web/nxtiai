/**
 * Single source of truth for NXTIAI's plan catalog: pricing, quotas, and
 * marketing copy all read from here — the pricing UI, the Mollie
 * checkout/subscription code, and every quota check in the API routes
 * import this file rather than hardcoding a number anywhere else.
 *
 * Internal plan ids are stable and never shown to users directly (see
 * `name` for the display label): "free" | "student" | "pro" | "team".
 * These are also the exact values written to profiles.plan_tier and
 * user_subscriptions.plan_id.
 */

export type PlanId = "free" | "student" | "pro" | "team";

export const PLAN_IDS: PlanId[] = ["free", "student", "pro", "team"];

/** Plans a customer can actually buy through checkout today. "team" is
 * excluded on purpose — there is no seat/org billing implementation yet
 * (see TEAM_VOLUME_TIERS below), so it is sold via a "talk to us" contact
 * flow instead, exactly like the old Business plan was. */
export type PayablePlanId = "student" | "pro";

export const PAYABLE_PLAN_IDS: PayablePlanId[] = ["student", "pro"];

export function isPayablePlanId(value: string): value is PayablePlanId {
  return (PAYABLE_PLAN_IDS as string[]).includes(value);
}

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as string[]).includes(value);
}

export type BillingCycle = "monthly" | "annual";

export interface PlanPrice {
  /** EUR, as a string with 2 decimals — the exact value sent to Mollie's
   * Payments/Subscriptions API (which expects amount.value as a string). */
  monthlyValue: string;
  /** EUR, as a string with 2 decimals — charged once per year when
   * billingCycle is "annual". */
  annualValue: string;
}

/**
 * Usage limits actually enforced by the API routes (see
 * app/api/rewrite/route.ts, app/api/detect/route.ts, app/api/voices/route.ts,
 * app/api/history/route.ts, app/account/page.tsx). `null` means
 * unlimited/uncapped. These are real, checked limits — not marketing
 * copy — so every number here must stay in sync with what those routes
 * actually enforce.
 */
export interface PlanLimits {
  /** Combined cap across every writing mode (rewrite, humanize, grammar
   * check, etc. all draw from the same monthly budget) for signed-in
   * users, counted from rewrites_history. Anonymous (signed-out) use of
   * the workspace is not persistently metered — it is bounded only by
   * the general per-IP burst rate limiter (lib/server/rate-limiter.ts)
   * and by maxCharsPerRequest below. */
  monthlyRewriteQuota: number | null;
  /** Applies to both /api/rewrite and /api/detect input text, signed-in
   * or not. */
  maxCharsPerRequest: number;
  /** AI Detector checks per month, signed-in users only, counted from
   * detector_history. */
  monthlyDetectorQuota: number | null;
  /** Saved custom voice profiles (custom_voices table), signed-in users
   * only. */
  voiceProfileLimit: number | null;
  /** How many past rewrites the account page / history API return.
   * `null` means no application-level cap. */
  historyLimit: number | null;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  tagline: string;
  description: string;
  price: PlanPrice | null;
  limits: PlanLimits;
  /** Short, factual bullets shown on the pricing card. Every line here
   * must describe something the product actually does today — no
   * "priority processing," no "best AI ever," nothing unverifiable. */
  features: string[];
  ctaLabel: string;
  highlighted?: boolean;
}

export const PLAN_CONFIG: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "Free",
    tagline: "For students, casual writers and anyone getting started.",
    description: "Try the core writing workspace, no card required.",
    price: null,
    limits: {
      monthlyRewriteQuota: 20,
      maxCharsPerRequest: 600,
      monthlyDetectorQuota: 3,
      voiceProfileLimit: 1,
      historyLimit: 5,
    },
    features: [
      "20 rewrites / month (every writing mode)",
      "Up to 600 characters per rewrite",
      "3 AI Detector checks / month",
      "1 saved voice profile",
      "Last 5 rewrites saved to history",
    ],
    ctaLabel: "Start Free",
  },
  student: {
    id: "student",
    name: "Student",
    tagline: "Built for students",
    description: "Everything students need to write better — without the expensive subscription.",
    price: { monthlyValue: "8.99", annualValue: "84.00" },
    limits: {
      monthlyRewriteQuota: 300,
      maxCharsPerRequest: 3000,
      monthlyDetectorQuota: 40,
      voiceProfileLimit: 5,
      historyLimit: 100,
    },
    features: [
      "300 rewrites / month (every writing mode)",
      "Up to 3,000 characters per rewrite",
      "40 AI Detector checks / month",
      "5 saved voice profiles",
      "Last 100 rewrites saved to history",
    ],
    ctaLabel: "Get Student",
    highlighted: true,
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For people who write every day.",
    description: "Our highest limits, for professionals, freelancers and researchers who write every day.",
    price: { monthlyValue: "14.99", annualValue: "119.00" },
    limits: {
      monthlyRewriteQuota: 2000,
      maxCharsPerRequest: 5000,
      monthlyDetectorQuota: 300,
      voiceProfileLimit: 25,
      historyLimit: null,
    },
    features: [
      "2,000 rewrites / month — our highest limit",
      "Up to 5,000 characters per rewrite",
      "300 AI Detector checks / month",
      "25 saved voice profiles",
      "Full rewrite history",
    ],
    ctaLabel: "Go Pro",
  },
  team: {
    id: "team",
    name: "Team",
    tagline: "Coming to NXTIAI Teams",
    description: "Shared billing and workspace tools for organizations — not sold self-serve yet.",
    price: null,
    limits: {
      monthlyRewriteQuota: null,
      maxCharsPerRequest: 5000,
      monthlyDetectorQuota: null,
      voiceProfileLimit: null,
      historyLimit: null,
    },
    features: [
      "Everything in Pro, per seat",
      "Centralized billing",
      "Team usage dashboard (coming soon)",
      "Admin controls (coming soon)",
    ],
    ctaLabel: "Talk to us",
  },
};

/** Reference volume pricing shown on the Team card. Informational only —
 * there is no seat/org billing system yet, so none of this is wired to
 * checkout. Shown to set expectations and let interested teams reach out. */
export interface TeamVolumeTier {
  seats: string;
  monthlyPerSeat: string;
  annualPerSeat: string;
}

export const TEAM_VOLUME_TIERS: TeamVolumeTier[] = [
  { seats: "2–10 seats", monthlyPerSeat: "9.99", annualPerSeat: "7.99" },
  { seats: "11–50 seats", monthlyPerSeat: "8.49", annualPerSeat: "6.99" },
  { seats: "51+ seats", monthlyPerSeat: "6.99", annualPerSeat: "5.99" },
];

export const TEAM_MINIMUM_SEATS = 2;

/** Monthly-equivalent price when billed annually, e.g. Student:
 * 84.00 / 12 = 7.00, Pro: 119.00 / 12 = 9.92 (rounded). */
export function getAnnualMonthlyEquivalent(planId: PayablePlanId): number {
  const price = PLAN_CONFIG[planId].price;
  if (!price) throw new Error(`Plan "${planId}" has no price configured.`);
  return Math.round((parseFloat(price.annualValue) / 12) * 100) / 100;
}

/** How much a customer saves per year paying annually vs. 12x monthly,
 * e.g. Student: 8.99 * 12 - 84.00 = 23.88. */
export function getAnnualSavings(planId: PayablePlanId): number {
  const price = PLAN_CONFIG[planId].price;
  if (!price) throw new Error(`Plan "${planId}" has no price configured.`);
  const monthlyTotal = parseFloat(price.monthlyValue) * 12;
  return Math.round((monthlyTotal - parseFloat(price.annualValue)) * 100) / 100;
}

export function getPlanLimits(planId: PlanId): PlanLimits {
  return PLAN_CONFIG[planId].limits;
}

/** Resolves a raw, possibly-unrecognized plan_tier value (from
 * profiles.plan_tier, which is an unconstrained text column) to a known
 * PlanId, defaulting to "free" for null/unknown/legacy values (e.g. the
 * old "business" tier name). Anonymous (signed-out) users are also
 * treated as "free" by every call site. */
export function resolvePlanId(rawPlanTier: string | null | undefined): PlanId {
  if (rawPlanTier && isPlanId(rawPlanTier)) return rawPlanTier;
  return "free";
}
