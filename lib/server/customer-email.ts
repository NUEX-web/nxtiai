/**
 * Customer-facing transactional email (welcome + login notice). Never
 * used for owner/admin alerts -- see lib/server/email.ts's
 * sendOwnerAlertEmail for that. Both functions here are called exactly
 * once per genuine event by lib/server/auth-notify.ts, which owns the
 * one-time-signup / once-per-session-login deduplication; nothing in
 * this file re-checks that itself.
 */

import { sendRawEmail } from "./email";
import { renderBrandedEmail } from "./email-templates";

interface CustomerEmailParams {
  to: string;
  /** Display name if we have one (full_name from signup or the OAuth
   * provider) -- null falls back to a plain, still-genuine greeting
   * rather than guessing or inventing a name. */
  name: string | null;
  /** Environment-aware app URL for the CTA link, derived by the caller
   * from the incoming request's own origin (never hardcoded), same
   * pattern as app/api/checkout/route.ts's successUrl/cancelUrl. */
  appUrl: string;
}

export async function sendCustomerWelcomeEmail({ to, name, appUrl }: CustomerEmailParams): Promise<{ ok: boolean }> {
  const greeting = name ? `Hello ${name},` : "Hello,";

  const html = renderBrandedEmail({
    heading: "Welcome to NXTIAI",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 12px 0;">Welcome to NXTIAI.</p>
      <p style="margin:0;">Your account has been created successfully. You can now use your NXTIAI workspace to write, rewrite, improve and work with your documents.</p>
    `,
    ctaLabel: "Open NXTIAI",
    ctaHref: appUrl,
  });

  const text = [
    greeting,
    "",
    "Welcome to NXTIAI.",
    "",
    "Your account has been created successfully. You can now use your NXTIAI workspace to write, rewrite, improve and work with your documents.",
    "",
    `Open NXTIAI: ${appUrl}`,
    "",
    "Regards,",
    "NXTIAI",
  ].join("\n");

  return sendRawEmail({ to, subject: "Welcome to NXTIAI", text, html });
}

export async function sendCustomerLoginEmail({ to, name, appUrl }: CustomerEmailParams): Promise<{ ok: boolean }> {
  const greeting = name ? `Hello ${name},` : "Hello,";

  const html = renderBrandedEmail({
    heading: "Welcome back to NXTIAI",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">${greeting}</p>
      <p style="margin:0 0 12px 0;">Thank you for logging in to NXTIAI.</p>
      <p style="margin:0;">Your NXTIAI workspace is ready. You can continue writing, improving your documents and using your available tools from your dashboard.</p>
      <p style="margin:20px 0 0 0;font-size:12px;color:#94a3b8;">If you did not make this login, please secure your account.</p>
    `,
    ctaLabel: "Open NXTIAI",
    ctaHref: appUrl,
  });

  const text = [
    greeting,
    "",
    "Thank you for logging in to NXTIAI.",
    "",
    "Your NXTIAI workspace is ready. You can continue writing, improving your documents and using your available tools from your dashboard.",
    "",
    `Open NXTIAI: ${appUrl}`,
    "",
    "If you did not make this login, please secure your account.",
    "",
    "Regards,",
    "NXTIAI",
  ].join("\n");

  return sendRawEmail({ to, subject: "Welcome back to NXTIAI", text, html });
}
