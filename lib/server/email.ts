/**
 * Server-only email sending for NXTIAI, backed by Resend's HTTP API (no
 * SDK dependency, same hand-rolled-fetch pattern as
 * lib/server/payments/mollie.ts). Resend's shared onboarding@resend.dev
 * sender works immediately without any domain verification, so this
 * works the moment RESEND_API_KEY is set -- no DNS setup required.
 *
 * Two kinds of mail share the low-level sendRawEmail() below:
 *  - Owner/admin alerts (sendOwnerAlertEmail, this file): internal ops
 *    signals -- new signup, new login, subscription events -- never sent
 *    to customers.
 *  - Customer-facing transactional email (lib/server/customer-email.ts):
 *    welcome/login emails, branded via lib/server/email-templates.ts.
 *
 * Best-effort by design: every call site fires these without a failure
 * path mattering to the caller -- a broken/missing email config must
 * never break auth, checkout, webhook processing, or any other real
 * request. If RESEND_API_KEY isn't set yet, sendRawEmail logs and
 * returns { ok: false } instead of throwing.
 */

interface RawEmailParams {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML body. Customer-facing email should always pass this
   * (see lib/server/email-templates.ts); owner alerts stay plain text. */
  html?: string;
  /** Defaults to ALERTS_FROM_EMAIL / the shared Resend sender. Override
   * only if a call site ever needs a distinct "from" identity. */
  from?: string;
}

/**
 * Low-level Resend send. Never throws -- callers get { ok } back and
 * decide for themselves whether/how to log; nothing here can propagate
 * a provider error (which could echo back API-key-adjacent details) to
 * a customer-facing response.
 */
export async function sendRawEmail({ to, subject, text, html, from }: RawEmailParams): Promise<{ ok: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[email] RESEND_API_KEY not configured -- skipped email: ${subject}`);
    return { ok: false };
  }

  const fromAddress = from || process.env.ALERTS_FROM_EMAIL || "NXTIAI <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to,
        subject,
        text,
        ...(html ? { html } : {}),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[email] Resend API error ${response.status}:`, body);
      return { ok: false };
    }
    return { ok: true };
  } catch (error) {
    console.error("[email] failed to send email:", error instanceof Error ? error.message : error);
    return { ok: false };
  }
}

interface AlertEmailParams {
  subject: string;
  text: string;
}

/**
 * Outbound alert email to the site owner (never to customers). Recipient
 * is a server-only env var -- ALERTS_TO_EMAIL -- never NEXT_PUBLIC_*,
 * never referenced from a client component, so it cannot be discovered
 * through the public application.
 */
export async function sendOwnerAlertEmail({ subject, text }: AlertEmailParams): Promise<{ ok: boolean }> {
  const to = process.env.ALERTS_TO_EMAIL || "shaikhsameer73377@gmail.com";
  return sendRawEmail({ to, subject, text });
}
