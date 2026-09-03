/**
 * Branded LUOFILM notification email.
 *
 * Pure string builder so the admin dashboard can preview the exact HTML that
 * the server sends. Colours mirror the site theme (dark surface + magenta
 * brand + gold VIP accent) using hex, because email clients do not grok oklch.
 */

export type NotifyContent = {
  /** Movie / series title. */
  title: string;
  /** Optional episode line, e.g. "S1 · E4 — The Return". */
  episode?: string | null;
  posterUrl?: string | null;
  /** Deep link to the title on the site. */
  link?: string | null;
  language?: string | null;
  vj?: string | null;
};

export const SITE_URL = "https://luofilm.site";

const BRAND = "#e0389f";
const BG = "#141518";
const CARD = "#1e2026";
const GOLD = "#e7c26b";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderNotifyEmail(opts: {
  name?: string | null;
  heading: string;
  body: string;
  content?: NotifyContent | null;
  ctaLabel?: string;
}) {
  const c = opts.content;
  const link = c?.link || SITE_URL;
  const cta = opts.ctaLabel || "Watch now";
  const bodyHtml = esc(opts.body).replace(/\n/g, "<br/>");

  const poster = c?.posterUrl
    ? `<img src="${esc(c.posterUrl)}" width="120" alt="${esc(c.title)}" style="display:block;width:120px;border-radius:12px;border:0;" />`
    : "";

  const meta = [c?.language, c?.vj ? `VJ ${c.vj}` : null, c?.episode]
    .filter(Boolean)
    .map((m) => esc(String(m)))
    .join(" &middot; ");

  const card = c
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border-radius:16px;margin:22px 0;">
         <tr>
           ${poster ? `<td width="140" style="padding:16px 0 16px 16px;vertical-align:top;">${poster}</td>` : ""}
           <td style="padding:18px 18px 18px 16px;vertical-align:top;">
             <div style="font:700 18px/1.3 Helvetica,Arial,sans-serif;color:#ffffff;">${esc(c.title)}</div>
             ${meta ? `<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#a5a8b3;margin-top:6px;">${meta}</div>` : ""}
             <a href="${esc(link)}" style="display:inline-block;margin-top:14px;background:${BRAND};color:#ffffff;text-decoration:none;font:700 13px Helvetica,Arial,sans-serif;padding:11px 20px;border-radius:999px;">${esc(cta)}</a>
           </td>
         </tr>
       </table>`
    : `<p style="margin:22px 0;"><a href="${esc(link)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font:700 13px Helvetica,Arial,sans-serif;padding:11px 20px;border-radius:999px;">${esc(cta)}</a></p>`;

  return `<!doctype html><html><body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#191b20;border-radius:22px;padding:28px;">
        <tr><td>
          <div style="font:800 20px/1 Helvetica,Arial,sans-serif;letter-spacing:2px;color:${GOLD};">LUOFILM<span style="color:${BRAND};">.SITE</span></div>
          <h1 style="font:800 24px/1.25 Helvetica,Arial,sans-serif;color:#ffffff;margin:18px 0 10px;">${esc(opts.heading)}</h1>
          <p style="font:400 15px/1.65 Helvetica,Arial,sans-serif;color:#c9ccd6;margin:0;">${opts.name ? `Hi ${esc(opts.name)},<br/>` : ""}${bodyHtml}</p>
          ${card}
          <p style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#7d8190;margin:22px 0 0;border-top:1px solid rgba(255,255,255,.08);padding-top:16px;">
            You get this because you have an account on <a href="${SITE_URL}" style="color:${GOLD};text-decoration:none;">LUOFILM.SITE</a> — free Luo &amp; Luganda translated movies.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function renderNotifyText(opts: {
  name?: string | null;
  body: string;
  content?: NotifyContent | null;
}) {
  const c = opts.content;
  const lines = [opts.name ? `Hi ${opts.name},` : null, opts.body];
  if (c) lines.push("", `${c.title}${c.episode ? ` — ${c.episode}` : ""}`, c.link || SITE_URL);
  return lines.filter((l) => l !== null).join("\n");
}
