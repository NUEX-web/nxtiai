/**
 * Provider-neutral payment/subscription contract.
 *
 * NXTIAI's payment provider is Mollie — never Stripe. This file defines
 * only the *shape* every payment provider must satisfy; it contains no
 * implementation, no Mollie SDK usage, and no network calls. That's
 * intentional and matches where the project actually is right now:
 *
 *   Phase 1 (this file): schema + this contract only.
 *   Phase 2 (not yet built): a real MollieProvider implementing this
 *     interface — checkout-session creation, payment/subscription status
 *     lookups, and verified webhook handling, using the Mollie SDK and a
 *     server-only MOLLIE_API_KEY.
 *
 * Server-only by construction: nothing here is exported from a "use
 * client" file, nothing here reads a NEXT_PUBLIC_ variable, and no route
 * or component outside lib/server/payments/ should ever import a
 * provider's SDK directly — every call goes through this interface, so
 * swapping or adding a provider later never means touching the pricing
 * page, the account page, or any other UI.
 */

export type PaymentProviderId = "mollie";

/** Mirrors the plans already shown on the pricing page — see
 * components/PricingPreview.tsx. "free" never goes through checkout. */
export type SubscriptionPlanId = "free" | "pro" | "business";

export type PayablePlanId = Exclude<SubscriptionPlanId, "free">;

export interface CreateCheckoutParams {
  userId: string;
  planId: PayablePlanId;
  /** Where Mollie should send the customer back after a completed or
   * cancelled checkout. Both must be absolute, environment-aware URLs —
   * never hardcoded to localhost. */
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSession {
  /** The provider's own id for this checkout/payment. */
  id: string;
  /** The URL to redirect the customer to in order to complete payment. */
  url: string;
}

export interface PaymentStatus {
  id: string;
  /** Raw provider status string (e.g. Mollie's own payment/subscription
   * status values) — intentionally not narrowed to a fixed union yet,
   * since that mapping is Phase 2 work once the real Mollie statuses in
   * play are known and decided. */
  status: string;
  planId: SubscriptionPlanId;
}

export interface WebhookEvent {
  /** The provider's own event/payment id — what
   * payment_webhook_events.event_id stores for idempotency. */
  id: string;
  type: string;
  raw: unknown;
}

/**
 * Every payment provider (Mollie today; anything else only if NXTIAI ever
 * needs one later) implements this. No implementation of this interface
 * exists yet — see the phase note above.
 */
export interface PaymentProvider {
  readonly id: PaymentProviderId;
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession>;
  getPayment(paymentId: string): Promise<PaymentStatus>;
  /** Verifies and parses an inbound webhook request server-side against
   * the provider's own API — the frontend/browser is never treated as
   * proof of payment, and a webhook's own payload is never trusted
   * without independent server-side verification. */
  handleWebhook(request: Request): Promise<WebhookEvent>;
}
