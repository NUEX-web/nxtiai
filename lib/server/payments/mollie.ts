import type {
  BillingCycle,
  CheckoutSession,
  CreateCheckoutParams,
  CreateCustomerParams,
  CreateSubscriptionParams,
  PaymentProvider,
  PaymentStatus,
  ProviderCustomer,
  ProviderSubscription,
  WebhookEvent,
} from "./provider";
import { UpstreamProviderError } from "../errors";
import { PLAN_CONFIG, type PayablePlanId } from "../plans";

const MOLLIE_API_BASE = "https://api.mollie.com/v2";

/** Resolves the exact EUR amount + description Mollie is charged for a
 * given plan/billing-cycle combination. Reads prices from
 * lib/server/plans.ts -- the single source of truth also driving the
 * pricing page -- so a price change there is automatically reflected in
 * every checkout and renewal charge, never a second place to update. */
function resolvePlanPrice(
  planId: PayablePlanId,
  billingCycle: BillingCycle
): { value: string; description: string } {
  const plan = PLAN_CONFIG[planId];
  if (!plan.price) {
    throw new UpstreamProviderError(`No price configured for plan "${planId}".`);
  }
  const value = billingCycle === "annual" ? plan.price.annualValue : plan.price.monthlyValue;
  const cadence = billingCycle === "annual" ? "annual" : "monthly";
  return { value, description: `NXTIAI ${plan.name} plan (${cadence})` };
}

function getApiKey(): string {
  const key = process.env.MOLLIE_API_KEY;
  if (!key) {
    throw new Error(
      "MOLLIE_API_KEY is not configured -- add it in your hosting provider's environment variables."
    );
  }
  return key;
}

async function mollieRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${MOLLIE_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Mollie API error ${response.status} on ${path}:`, body);
    throw new UpstreamProviderError("The payment provider returned an unexpected response.");
  }

  // DELETE requests (cancelSubscription) return 204 No Content -- nothing
  // to parse as JSON.
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

interface MolliePaymentResponse {
  id: string;
  status: string;
  metadata: { userId?: string; planId?: string; billingCycle?: string } | null;
  customerId?: string | null;
  subscriptionId?: string | null;
  sequenceType?: string | null;
  _links: { checkout?: { href: string } };
}

interface MollieCustomerResponse {
  id: string;
}

interface MollieSubscriptionResponse {
  id: string;
}

/**
 * Recurring billing via Mollie's mandate flow:
 *
 *   1. createCustomer() -- once per user, reused across checkouts.
 *   2. createCheckout() -- a sequenceType:"first" payment tied to that
 *      customer. A successful payment establishes a mandate.
 *   3. createSubscription() -- called by the webhook handler once the
 *      first payment is confirmed paid, not by this class on its own.
 *      From then on Mollie auto-charges on the given interval and posts
 *      every resulting payment (sequenceType:"recurring") to the same
 *      webhookUrl -- this class never has to poll or schedule anything
 *      itself.
 *   4. cancelSubscription() -- called the instant a recurring charge
 *      fails, so no further silent charge attempts can happen.
 */
class MollieProvider implements PaymentProvider {
  readonly id = "mollie" as const;

  async createCustomer(params: CreateCustomerParams): Promise<ProviderCustomer> {
    const customer = await mollieRequest<MollieCustomerResponse>("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        email: params.email,
        metadata: { userId: params.userId },
      }),
    });
    return { id: customer.id };
  }

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const plan = resolvePlanPrice(params.planId, params.billingCycle);

    const payment = await mollieRequest<MolliePaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: plan.value },
        description: plan.description,
        // customerId + sequenceType:"first" is what turns this payment
        // into a mandate-creating payment -- once Mollie confirms it
        // paid, the customer has authorized future automatic charges,
        // and the webhook handler creates the actual subscription.
        customerId: params.customerId,
        sequenceType: "first",
        // Mollie's Payments API has exactly one return URL, not a
        // separate success/cancel pair -- the customer lands here
        // regardless of outcome. The account page reflects the real,
        // verified status once the webhook below has processed it, so
        // this page load is never itself treated as proof of payment.
        redirectUrl: params.successUrl,
        webhookUrl: params.webhookUrl,
        // billingCycle is forwarded here (mirroring userId/planId) so
        // the webhook handler knows the correct renewal interval --
        // Mollie carries this metadata onto every payment/subscription
        // it creates from this one, including recurring charges that
        // never go through this route again.
        metadata: { userId: params.userId, planId: params.planId, billingCycle: params.billingCycle },
      }),
    });

    const checkoutUrl = payment._links.checkout?.href;
    if (!checkoutUrl) {
      throw new UpstreamProviderError("The payment provider did not return a checkout URL.");
    }

    return { id: payment.id, url: checkoutUrl };
  }

  async getPayment(paymentId: string): Promise<PaymentStatus> {
    const payment = await mollieRequest<MolliePaymentResponse>(`/payments/${paymentId}`);
    return {
      id: payment.id,
      status: payment.status,
      planId: (payment.metadata?.planId as PaymentStatus["planId"]) || "free",
    };
  }

  async createSubscription(params: CreateSubscriptionParams): Promise<ProviderSubscription> {
    const plan = resolvePlanPrice(params.planId, params.billingCycle);
    const interval = params.billingCycle === "annual" ? "12 months" : "1 month";

    const subscription = await mollieRequest<MollieSubscriptionResponse>(
      `/customers/${params.customerId}/subscriptions`,
      {
        method: "POST",
        body: JSON.stringify({
          amount: { currency: "EUR", value: plan.value },
          interval,
          description: `${plan.description} -- renews every ${interval}`,
          webhookUrl: params.webhookUrl,
          // Mollie forwards subscription metadata onto every payment it
          // generates -- this is what lets the webhook handler identify
          // *which user*, *which plan*, and *which billing cycle* a
          // recurring payment (which carries no metadata of its own
          // otherwise) belongs to, the same way the original
          // mandate-creating payment's metadata does.
          metadata: { userId: params.userId, planId: params.planId, billingCycle: params.billingCycle },
        }),
      }
    );

    return { id: subscription.id };
  }

  async cancelSubscription(customerId: string, subscriptionId: string): Promise<void> {
    await mollieRequest<void>(`/customers/${customerId}/subscriptions/${subscriptionId}`, {
      method: "DELETE",
    });
  }

  async handleWebhook(request: Request): Promise<WebhookEvent> {
    // Mollie's webhook body is application/x-www-form-urlencoded with a
    // single field: id. The payload itself is never trusted as proof of
    // anything -- this re-fetches the payment from Mollie's own API,
    // exactly like every other verified call in this file, rather than
    // trusting whatever the POST body claims.
    const form = await request.formData();
    const paymentId = form.get("id");
    if (typeof paymentId !== "string" || !paymentId) {
      throw new UpstreamProviderError("Webhook request did not include a payment id.");
    }

    const payment = await mollieRequest<MolliePaymentResponse>(`/payments/${paymentId}`);
    return { id: payment.id, type: "payment", raw: payment };
  }
}

let instance: MollieProvider | null = null;

/** The only payment provider today (see ./provider.ts) -- a factory,
 * not a bare export, so a future second provider is a call-site switch
 * on PaymentProviderId here, never a change to every import site. */
export function getPaymentProvider(): PaymentProvider {
  if (!instance) instance = new MollieProvider();
  return instance;
}
