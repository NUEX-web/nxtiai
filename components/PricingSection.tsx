"use client";

import { useState } from "react";
import { Check, GraduationCap, BookOpen, Laptop, NotebookPen } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";
import {
  PLAN_CONFIG,
  PLAN_IDS,
  TEAM_VOLUME_TIERS,
  TEAM_MINIMUM_SEATS,
  getAnnualMonthlyEquivalent,
  getAnnualSavings,
  type PayablePlanId,
  type BillingCycle,
} from "@/lib/server/plans";

const TEAM_CONTACT_HREF =
  "mailto:hello@nxtiai.com?subject=NXTIAI%20Team%20plan&body=Hi%20NXTIAI%2C%0A%0AWe'd%20like%20to%20talk%20about%20the%20Team%20plan.%0A%0ATeam%20size%3A%20%0ACompany%3A%20";

function formatEuro(value: number): string {
  return value % 1 === 0 ? `€${value}` : `€${value.toFixed(2)}`;
}

export default function PricingSection() {
  const { user, profile, openAuthModal } = useAuth();
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [checkingOutPlan, setCheckingOutPlan] = useState<PayablePlanId | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const goToWorkspace = () => {
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
  };

  const handleFreePlanClick = () => {
    if (user) {
      goToWorkspace();
      return;
    }
    openAuthModal("signup");
  };

  const handlePayablePlanClick = async (planId: PayablePlanId) => {
    if (!user) {
      openAuthModal("signup");
      return;
    }
    if (profile?.plan_tier === planId) {
      goToWorkspace();
      return;
    }

    setCheckoutError(null);
    setCheckingOutPlan(planId);
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billingCycle }),
      });
      const data: { url?: string; error?: { message?: string } } = await response.json();
      if (!response.ok || !data.url) {
        throw new Error(data.error?.message || "Could not start checkout. Try again.");
      }
      // Full navigation, not client-side routing -- Mollie's hosted
      // checkout is a different origin entirely. location.assign() (a
      // method call) rather than a `location.href =` property
      // assignment -- the latter trips this codebase's
      // react-hooks/immutability lint rule as a false positive.
      window.location.assign(data.url);
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Could not start checkout. Try again.");
      setCheckingOutPlan(null);
    }
  };

  const ctaLabelFor = (planId: PayablePlanId): string => {
    if (checkingOutPlan === planId) return "Redirecting…";
    if (user && profile?.plan_tier === planId) return "Current plan";
    return PLAN_CONFIG[planId].ctaLabel;
  };

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div ref={ref} className={className}>
        <div className="mb-8 max-w-xl text-center sm:mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
            Simple, honest pricing
          </h2>
          <p className="mt-3 text-ink-soft">
            Start free. Upgrade when you need more — cancel any time from your account.
          </p>
        </div>

        {/* Monthly / Yearly toggle */}
        <div className="mb-10 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-line bg-surface p-1">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBillingCycle(cycle)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  billingCycle === cycle
                    ? "bg-accent text-white shadow-sm"
                    : "text-ink-soft hover:text-ink"
                }`}
              >
                {cycle === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 md:items-start">
          {PLAN_IDS.map((planId) => {
            const plan = PLAN_CONFIG[planId];
            const isPayable = planId === "student" || planId === "pro";
            const highlighted = Boolean(plan.highlighted);

            return (
              <div
                key={planId}
                className={`relative flex h-full flex-col rounded-2xl border p-7 transition-shadow ${
                  highlighted
                    ? "border-accent bg-surface shadow-lg lg:-my-3 lg:py-10"
                    : "border-line bg-surface hover:border-line-strong"
                }`}
              >
                {highlighted && (
                  <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                    <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                    Most popular
                  </span>
                )}

                <span className="text-sm font-semibold text-ink">{plan.name}</span>
                <span className="mt-0.5 text-xs text-ink-faint">{plan.tagline}</span>

                <div className="mt-4 flex min-h-[3.25rem] flex-col justify-end">
                  {planId === "free" && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-[family-name:var(--font-display)] text-4xl text-ink">€0</span>
                      <span className="text-sm text-ink-faint">forever</span>
                    </div>
                  )}

                  {isPayable && plan.price && (
                    <>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-[family-name:var(--font-display)] text-4xl text-ink">
                          {billingCycle === "monthly"
                            ? formatEuro(parseFloat(plan.price.monthlyValue))
                            : formatEuro(getAnnualMonthlyEquivalent(planId as PayablePlanId))}
                        </span>
                        <span className="text-sm text-ink-faint">/ month</span>
                      </div>
                      {billingCycle === "annual" ? (
                        <p className="mt-1 text-xs text-ink-faint">
                          {formatEuro(parseFloat(plan.price.annualValue))} billed yearly &middot;{" "}
                          <span className="font-medium text-accent-strong">
                            Save {formatEuro(getAnnualSavings(planId as PayablePlanId))}/year
                          </span>
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-ink-faint">billed monthly</p>
                      )}
                    </>
                  )}

                  {planId === "team" && (
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-[family-name:var(--font-display)] text-3xl text-ink">Custom</span>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-sm text-ink-soft">{plan.description}</p>

                <ul className="mt-6 flex flex-1 flex-col gap-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm text-ink">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {planId === "team" ? (
                  <>
                    <div className="mt-6 space-y-1.5 rounded-xl bg-canvas p-3 text-[11px] text-ink-faint">
                      <p className="font-semibold uppercase tracking-wide text-ink-soft">
                        Reference seat pricing (min. {TEAM_MINIMUM_SEATS} seats)
                      </p>
                      {TEAM_VOLUME_TIERS.map((tier) => (
                        <div key={tier.seats} className="flex items-center justify-between">
                          <span>{tier.seats}</span>
                          <span>
                            €{tier.monthlyPerSeat}/mo &middot; €{tier.annualPerSeat}/mo yearly
                          </span>
                        </div>
                      ))}
                    </div>
                    <a
                      href={TEAM_CONTACT_HREF}
                      className="mt-5 rounded-full border border-line px-5 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-line-strong"
                    >
                      Talk to us
                    </a>
                  </>
                ) : planId === "free" ? (
                  <button
                    type="button"
                    onClick={handleFreePlanClick}
                    className="mt-7 rounded-full border border-line px-5 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-line-strong"
                  >
                    {user ? "Go to workspace" : plan.ctaLabel}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handlePayablePlanClick(planId as PayablePlanId)}
                    disabled={checkingOutPlan === planId}
                    className={`mt-7 rounded-full px-5 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                      highlighted
                        ? "bg-accent text-white shadow-sm hover:bg-accent-strong"
                        : "border border-line text-ink hover:border-line-strong"
                    }`}
                  >
                    {ctaLabelFor(planId as PayablePlanId)}
                  </button>
                )}

              </div>
            );
          })}
        </div>

        {checkoutError && (
          <p className="mt-4 text-center text-sm text-danger">{checkoutError}</p>
        )}

        {/* Built for students */}
        <div className="mt-20 rounded-2xl border border-line bg-surface p-8 md:p-12">
          <div className="mx-auto max-w-2xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-strong">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
              Built for students
            </span>
            <p className="mt-4 text-lg text-ink md:text-xl">
              From your first assignment to your final thesis, NXTIAI helps you write with more
              clarity, confidence and your own voice.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {[
              { icon: BookOpen, label: "Academic writing" },
              { icon: NotebookPen, label: "Essays & assignments" },
              { icon: Laptop, label: "Research & drafting" },
              { icon: GraduationCap, label: "Study smarter" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-medium text-ink-soft">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
