/**
 * Outbound alert emails to the site owner (never to customers -- this is
 * an internal ops signal, not transactional customer email).
 *
 * Sends via Resend's HTTP API directly (no SDK dependency, same pattern
 * as lib/server/payments/mollie.ts's hand-rolled fetch client). Resend's
 * shared onboarding@resend.dev sender works immediately without any
 * domain verification, so this works the moment RESEND_API_KEY is set --
 * no DNS setup required to start receiving alerts.
 *
 * Best-effort by design: every call site fires this without awaiting
 * failure paths mattering -- a broken/missing email config must never
 * break webhook processing, checkout, or any other real request. If
 * RESEND_API_KEY isn't set yet, this logs and returns instead of
 * throwing, exactly like MOLLIE_API_KEY's absence would be a hard
 * config error but a missing RESEND_API_KEY is not.
 */

interface AlertEmailParams {
  subject: string;
  text: string;
}

export async function sendOwnerAlertEmail({ subject, text }: AlertEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[email] RESEND_API_KEY not configured -- skipped alert: ${subject}`);
    return;
  }

  const to = process.env.ALERTS_TO_EMAIL || "shaikhsameerkadeer@gmail.com";
  const from = process.env.ALERTS_FROM_EMAIL || "NXTIAI Alerts <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(`[email] Resend API error ${response.status}:`, body);
    }
  } catch (error) {
    console.error("[email] failed to send owner alert:", error instanceof Error ? error.message : error);
  }
}
