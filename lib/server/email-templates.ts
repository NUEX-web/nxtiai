/**
 * Shared branded HTML wrapper for customer-facing transactional email
 * (lib/server/customer-email.ts). Owner/admin alerts stay plain text by
 * design -- they are internal, information-focused, and never need to
 * look like a product email.
 *
 * Inline styles throughout on purpose: Gmail, Outlook and Apple Mail all
 * strip <style> blocks and most CSS selectors in transactional mail, so
 * anything that must render has to live on the element itself. Kept to a
 * single-column table layout for the same reason (maximum client
 * compatibility, no flex/grid).
 */

const INK = "#0f172a";
const INK_SOFT = "#475569";
const INK_FAINT = "#a1a1aa";
const ACCENT = "#16a34a";
const BORDER = "#e4e4e7";

interface BrandedEmailParams {
  heading: string;
  /** Raw HTML for the body -- caller-controlled, trusted content only
   * (never interpolate raw customer input here without escaping). */
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
}

export function renderBrandedEmail({ heading, bodyHtml, ctaLabel, ctaHref }: BrandedEmailParams): string {
  const footerDomain = ctaHref.replace(/^https?:\/\//, "").replace(/\/$/, "");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${BORDER};">
            <tr>
              <td style="padding:28px 32px 0 32px;">
                <span style="font-size:20px;font-weight:600;letter-spacing:-0.02em;color:${INK};">NXTIAI</span>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 0 32px;">
                <h1 style="margin:0;font-size:22px;line-height:1.3;color:${INK};font-weight:600;">${heading}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 8px 32px;font-size:14px;line-height:1.6;color:${INK_SOFT};">
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 32px 32px;">
                <a href="${ctaHref}" style="display:inline-block;background:${ACCENT};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:999px;">${ctaLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px 32px;border-top:1px solid #f0f0f1;">
                <span style="font-size:12px;color:${INK_FAINT};">NXTIAI &middot; ${footerDomain}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
