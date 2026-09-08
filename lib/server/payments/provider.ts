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
  /** The provider-side customer this payment (and the mandate it
   * creates) belongs to. Required: every payable plan is a recurring
   * subscription now, and Mollie's mandate/sequenceType flow is always
   * scoped to a customer -- see createCustomer() below and
   * app/api/checkout/route.ts, which creates or reuses this before ever
   * calling createCheckout(). */
  customerId: string;
  /** Where Mollie should send the customer back after a completed or
   * cancelled checkout. Both must be absolute, environment-aware URLs —
   * never hardcoded to localhost. */
  successUrl: string;
  cancelUrl: string;
  /** Where the provider should POST payment status updates
   * server-to-server (see app/api/payments/webhook/route.ts). Built by
   * the caller from the incoming request's own origin -- see
   * app/api/checkout/route.ts -- the same environment-aware pattern
   * already used for Supabase OAuth's redirectTo, never hardcoded. */
  webhookUrl: string;
}

export interface CreateCustomerParams {
  userId: string;
  email: string;
  name?: string;
}

export interface ProviderCustomer {
  /** The provider's own id for this customer (Mollie: "cst_..."). */
  id: string;
}

export interface CreateSubscriptionParams {
  customerId: string;
  userId: string;
  planId: PayablePlanId;
  /** Same webhookUrl pattern as CreateCheckoutParams -- every recurring
   * charge this subscription generates is delivered to this endpoint,
   * exactly like the payment that created the mandate. */
  webhookUrl: string;
}

export interface ProviderSubscription {
  /** The provider's own id for this subscription (Mollie: "sub_..."). */
  id: string;
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
  /** Creates (or the caller may reuse an existing) provider-side
   * customer record -- required before any mandate or subscription can
   * exist. Idempotent from the caller's side: app/api/checkout/route.ts
   * reuses user_subscriptions.provider_customer_id when one is already
   * on file for this user instead of calling this again. */
  createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer>;
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession>;
  getPayment(paymentId: string): Promise<PaymentStatus>;
  /** Creates the actual recurring subscription once a mandate exists --
   * i.e. after a sequenceType:"first" payment for this customer has
   * been confirmed paid. Mollie then auto-charges on the given interval
   * and calls webhookUrl on every resulting payment status change,
   * exactly like the mandate-creating payment did. */
  createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription>;
  /** Cancels a subscription immediately -- called the instant a renewal
   * charge fails, so no further silent charge attempts can happen
   * without the customer going through checkout again. Best-effort by
   * design: callers wrap this so a cancellation failure never blocks
   * the plan downgrade that already happened in the database. */
  cancelSubscription(customerId: string, subscriptionId: string): Promise<void>;
  /** Verifies and parses an inbound webhook request server-side against
   * the provider's own API — the frontend/browser is never treated as
   * proof of payment, and a webhook's own payload is never trusted
   * without independent server-side verification. */
  handleWebhook(request: Request): Promise<WebhookEvent>;
}
