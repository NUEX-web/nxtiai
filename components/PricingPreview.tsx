"use client";

import { Check } from "lucide-react";
import { useAuth } from "./AuthProvider";
import { useRevealOnScroll } from "@/lib/hooks/use-reveal-on-scroll";

interface Plan {
  name: string;
  tagline: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  note?: string;
}

const PLANS: Plan[] = [
  {
    name: "Free",
    tagline: "Good for trying NXTIAI",
    price: "€0",
    cadence: "forever",
    description: "Try the core writing workspace.",
    features: ["Standard mode", "1 voice profile", "Limited monthly rewrites"],
  },
  {
    name: "Pro",
    tagline: "Best for individuals",
    price: "€12",
    cadence: "per month",
    description: "For regular writing, all modes included.",
    features: ["All writing modes", "Unlimited rewrites", "3 voice profiles", "Priority AI model"],
    highlighted: true,
    note: "Billing isn't live yet — creating an account reserves your spot for launch.",
  },
  {
    name: "Business",
    tagline: "For teams",
    price: "€29",
    cadence: "per member / month",
    description: "Shared brand voice across a team.",
    features: ["Everything in Pro", "Shared brand voice", "Team management", "Priority support"],
  },
];

const BUSINESS_CONTACT_HREF =
  "mailto:hello@nxtiai.com?subject=NXTIAI%20Business%20plan&body=Hi%20NXTIAI%2C%0A%0AWe'd%20like%20to%20talk%20about%20the%20Business%20plan.%0A%0ATeam%20size%3A%20%0ACompany%3A%20";

export default function PricingPreview() {
  const { user, openAuthModal } = useAuth();
  const { ref, className } = useRevealOnScroll<HTMLDivElement>();

  const handlePlanClick = () => {
    if (user) {
      document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    openAuthModal("signup");
  };

  return (
    <section id="pricing" className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div ref={ref} className={className}>
        <div className="mb-12 max-w-xl text-center sm:mx-auto">
          <h2 className="font-[family-name:var(--font-display)] text-3xl text-ink md:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-3 text-ink-soft">
            Plans for early access — pricing may change as NXTIAI develops.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-start">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex h-full flex-col rounded-2xl border p-7 transition-shadow ${
                plan.highlighted
                  ? "border-accent bg-surface shadow-lg md:-my-3 md:py-10"
                  : "border-line bg-surface hover:border-line-strong"
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-sm">
                  Most popular
                </span>
              )}

              <span className="text-sm font-semibold text-ink">{plan.name}</span>
              <span className="mt-0.5 text-xs text-ink-faint">{plan.tagline}</span>

              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="font-[family-name:var(--font-display)] text-4xl text-ink">
                  {plan.price}
                </span>
                <span className="text-sm text-ink-faint">{plan.cadence}</span>
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

              {plan.name === "Business" ? (
                <a
                  href={BUSINESS_CONTACT_HREF}
                  className="mt-7 rounded-full border border-line px-5 py-2.5 text-center text-sm font-medium text-ink transition-colors hover:border-line-strong"
                >
                  Talk to us
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handlePlanClick}
                  className={`mt-7 rounded-full px-5 py-2.5 text-sm font-medium transition-colors ${
                    plan.highlighted
                      ? "bg-accent text-white shadow-sm hover:bg-accent-strong"
                      : "border border-line text-ink hover:border-line-strong"
                  }`}
                >
                  {user
                    ? "Go to workspace"
                    : plan.name === "Free"
                      ? "Start writing free"
                      : `Choose ${plan.name}`}
                </button>
              )}

              {plan.note && !user && (
                <p className="mt-2.5 text-xs text-ink-faint">{plan.note}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
