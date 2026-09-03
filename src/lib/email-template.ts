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
  /** Deep link to the title on the site (Play). */
  link?: string | null;
  /** Deep link used for the Download button (defaults to link). */
  downloadLink?: string | null;
  language?: string | null;
  vj?: string | null;
};

export const SITE_URL = "https://luofilm.site";
export const SITE_LOGO_URL = `${SITE_URL}/favicon.png`;

const BRAND = "#e0389f";
const BRAND_DEEP = "#7a1fd0";
const BG = "#101116";
const CARD = "#1b1d24";
const GOLD = "#e7c26b";
const TEXT = "#f4f5f8";
const MUTED = "#a5a8b3";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const btn = (href: string, label: string, bg: string, icon: string) =>
  `<a href="${esc(href)}" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;font:700 14px Helvetica,Arial,sans-serif;padding:13px 26px;border-radius:999px;box-shadow:0 8px 22px -10px ${bg};">${icon}&nbsp;${esc(label)}</a>`;

const PLAY_ICON = `<span style="display:inline-block;width:0;height:0;border-top:6px solid transparent;border-bottom:6px solid transparent;border-left:9px solid #ffffff;vertical-align:middle;"></span>`;
const DL_ICON = `<span style="display:inline-block;font-weight:800;">&#8681;</span>`;

function heroCard(c: NotifyContent) {
  const link = c.link || SITE_URL;
  const dl = c.downloadLink || link;
  const meta = [c.language, c.vj ? `VJ ${c.vj}` : null, c.episode]
    .filter(Boolean)
    .map((m) => esc(String(m)))
    .join(" &middot; ");

  const poster = c.posterUrl
    ? `<a href="${esc(link)}"><img src="${esc(c.posterUrl)}" width="460" alt="${esc(c.title)}" style="display:block;width:100%;max-width:460px;height:auto;border-radius:18px;border:1px solid rgba(255,255,255,.12);box-shadow:0 24px 50px -20px rgba(0,0,0,.85);" /></a>`
    : "";

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CARD};border-radius:24px;margin:24px 0;border:1px solid rgba(255,255,255,.08);">
    <tr><td style="padding:22px;" align="center">
      ${poster}
      <div style="font:800 24px/1.25 Helvetica,Arial,sans-serif;color:${TEXT};margin-top:${poster ? "18px" : "4px"};">${esc(c.title)}</div>
      ${c.episode ? `<div style="font:700 15px/1.4 Helvetica,Arial,sans-serif;color:${GOLD};margin-top:6px;">${esc(c.episode)}</div>` : ""}
      ${meta && !c.episode ? `<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};margin-top:6px;">${meta}</div>` : ""}
      ${c.episode && (c.language || c.vj) ? `<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:${MUTED};margin-top:6px;">${[c.language, c.vj ? `VJ ${c.vj}` : null].filter(Boolean).map((m) => esc(String(m))).join(" &middot; ")}</div>` : ""}
      <div style="margin-top:20px;">
        ${btn(link, "Play now", `linear-gradient(135deg,${BRAND},${BRAND_DEEP})`, PLAY_ICON)}
        &nbsp;&nbsp;
        ${btn(dl, "Download", "#2a2d38", DL_ICON)}
      </div>
    </td></tr>
  </table>`;
}

function recRow(recs: NotifyContent[]) {
  const cells = recs
    .slice(0, 4)
    .map((r) => {
      const link = r.link || SITE_URL;
      const img = r.posterUrl
        ? `<img src="${esc(r.posterUrl)}" width="110" alt="${esc(r.title)}" style="display:block;width:110px;height:150px;object-fit:cover;border-radius:12px;border:1px solid rgba(255,255,255,.1);" />`
        : `<div style="width:110px;height:150px;border-radius:12px;background:#262933;"></div>`;
      return `<td style="padding:4px;" align="center" width="25%">
        <a href="${esc(link)}" style="text-decoration:none;">
          ${img}
          <div style="font:600 11px/1.35 Helvetica,Arial,sans-serif;color:${MUTED};margin-top:7px;max-width:110px;">${esc(r.title)}</div>
        </a>
      </td>`;
    })
    .join("");

  return `<div style="font:800 15px/1 Helvetica,Arial,sans-serif;letter-spacing:1.5px;color:${GOLD};margin:30px 0 14px;">MORE ON LUOFILM</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`;
}

export function renderNotifyEmail(opts: {
  name?: string | null;
  heading: string;
  body: string;
  content?: NotifyContent | null;
  /** Other titles to showcase at the bottom. */
  recommendations?: NotifyContent[];
  ctaLabel?: string;
}) {
  const c = opts.content;
  const bodyHtml = esc(opts.body).replace(/\n/g, "<br/>");

  const card = c
    ? heroCard(c)
    : `<p style="margin:24px 0;">${btn(c?.link || SITE_URL, opts.ctaLabel || "Watch now", `linear-gradient(135deg,${BRAND},${BRAND_DEEP})`, PLAY_ICON)}</p>`;

  const recs = (opts.recommendations ?? []).filter((r) => r.title && r.title !== c?.title);

  return `<!doctype html><html><head>
  <style>
    @keyframes lf-glow { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
    .lf-header { background: linear-gradient(120deg, #2a0f33, #5a1140, #7a1fd0, #2a0f33); background-size: 300% 300%; animation: lf-glow 9s ease infinite; }
  </style>
</head><body style="margin:0;padding:0;background:${BG};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#171921;border-radius:26px;overflow:hidden;border:1px solid rgba(255,255,255,.08);">
        <tr><td class="lf-header" style="padding:30px 28px;" align="center">
          <img src="${SITE_LOGO_URL}" width="54" alt="LUOFILM" style="display:block;width:54px;height:54px;border-radius:14px;margin:0 auto 12px;" />
          <div style="font:800 26px/1 Helvetica,Arial,sans-serif;letter-spacing:3px;color:${GOLD};">LUOFILM<span style="color:#ffffff;">.SITE</span></div>
          <div style="font:400 12px/1.5 Helvetica,Arial,sans-serif;color:rgba(255,255,255,.75);margin-top:8px;letter-spacing:1px;">FREE LUO &amp; LUGANDA TRANSLATED MOVIES</div>
        </td></tr>
        <tr><td style="padding:26px 28px 30px;">
          <h1 style="font:800 24px/1.25 Helvetica,Arial,sans-serif;color:${TEXT};margin:0 0 10px;">${esc(opts.heading)}</h1>
          <p style="font:400 15px/1.65 Helvetica,Arial,sans-serif;color:#c9ccd6;margin:0;">${opts.name ? `Hi ${esc(opts.name)},<br/>` : ""}${bodyHtml}</p>
          ${card}
          ${recs.length ? recRow(recs) : ""}
          <p style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#7d8190;margin:28px 0 0;border-top:1px solid rgba(255,255,255,.08);padding-top:18px;">
            With love,<br/><b style="color:${GOLD};">— The Luo Film Team</b><br/><br/>
            You get this because you have an account on <a href="${SITE_URL}" style="color:${GOLD};text-decoration:none;">LUOFILM.SITE</a>.
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
  lines.push("", "— The Luo Film Team");
  return lines.filter((l) => l !== null).join("\n");
}
