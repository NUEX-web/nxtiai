import type {
  CheckoutSession,
  CreateCheckoutParams,
  PaymentProvider,
  PaymentStatus,
  WebhookEvent,
} from "./provider";
import { UpstreamProviderError } from "../errors";

const MOLLIE_API_BASE = "https://api.mollie.com/v2";

// Fixed pricing today -- mirrors the Pro plan shown on the pricing page
// (components/PricingPreview.tsx). Only one payable plan exists right
// now; a real catalog (or Mollie order line items) is future work if
// Business ever moves off its "talk to us" flow.
const PLAN_PRICES: Record<string, { value: string; description: string }> = {
  pro: { value: "12.00", description: "NXTIAI Pro plan" },
};

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

  return response.json() as Promise<T>;
}

interface MolliePaymentResponse {
  id: string;
  status: string;
  metadata: { userId?: string; planId?: string } | null;
  _links: { checkout?: { href: string } };
}

/**
 * One-time payments only (see the phase note in ./provider.ts) -- no
 * Mollie Customer, no mandate, no recurring sequenceType. A successful
 * payment grants the plan once; there is no auto-renewal to manage.
 * Recurring billing, if NXTIAI needs it later, is a distinct Mollie flow
 * (a mandate-setting first payment, then the Subscriptions API) and a
 * different implementation of this same interface -- not a change to
 * any call site.
 */
class MollieProvider implements PaymentProvider {
  readonly id = "mollie" as const;

  async createCheckout(params: CreateCheckoutParams): Promise<CheckoutSession> {
    const plan = PLAN_PRICES[params.planId];
    if (!plan) {
      throw new UpstreamProviderError(`No price configured for plan "${params.planId}".`);
    }

    const payment = await mollieRequest<MolliePaymentResponse>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: { currency: "EUR", value: plan.value },
        description: plan.description,
        // Mollie's Payments API has exactly one return URL, not a
        // separate success/cancel pair -- the customer lands here
        // regardless of outcome. The account page reflects the real,
        // verified status once the webhook below has processed it, so
        // this page load is never itself treated as proof of payment.
        redirectUrl: params.successUrl,
        webhookUrl: params.webhookUrl,
        metadata: { userId: params.userId, planId: params.planId },
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
