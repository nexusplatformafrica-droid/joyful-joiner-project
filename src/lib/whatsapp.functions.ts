import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Free WhatsApp sending through CallMeBot.
 *
 * CallMeBot issues one apikey per recipient number (the recipient must add the
 * bot once and message it). Keys are configured here in code — no env vars, no
 * dashboard setup. Add more numbers to the map as users opt in.
 */
export const CALLMEBOT_KEYS: Record<string, string> = {
  "256795592662": "1011259",
};

/** Normalises a Ugandan/international number to digits only (no +, no spaces). */
export function normalisePhone(raw: string): string {
  let d = (raw || "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `256${d.slice(1)}`;
  if (d.length === 9) d = `256${d}`;
  return d;
}

export function callmebotKeyFor(phone: string): string | null {
  return CALLMEBOT_KEYS[normalisePhone(phone)] ?? null;
}

/** wa.me fallback so an admin can still send by hand when no apikey exists. */
export function waLink(phone: string, text: string) {
  return `https://wa.me/${normalisePhone(phone)}?text=${encodeURIComponent(text)}`;
}

const payload = z.object({
  recipients: z
    .array(z.object({ phone: z.string().min(6), message: z.string().min(1).max(900) }))
    .min(1)
    .max(2000),
});

export type SendResult = {
  phone: string;
  ok: boolean;
  status: "sent" | "no-key" | "failed";
  detail?: string;
  fallback?: string;
};

type Cloud = { token: string; phoneId: string; template?: string | undefined; lang: string } | null;
type Green = { apiUrl: string; idInstance: string; apiToken: string } | null;
type Gateway = { url: string; token?: string | undefined; session: string } | null;

/**
 * Self-hosted / unofficial HTTP gateway (WAHA, wppconnect, Baileys, UltraMsg,
 * Wassenger…). Truly unlimited and free when you host it yourself; recipients
 * never activate anything. Configure WHATSAPP_GATEWAY_URL (+ optional
 * WHATSAPP_GATEWAY_TOKEN, WHATSAPP_GATEWAY_SESSION) and it becomes the primary
 * sender. The payload shape is auto-detected from the URL.
 */
async function sendGateway(gw: NonNullable<Gateway>, to: string, message: string): Promise<SendResult> {
  const url = gw.url;
  const isUltra = /ultramsg\.com/i.test(url);
  const isWassenger = /wassenger\.com/i.test(url);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown>;

  if (isUltra) {
    // UltraMsg: token goes in the body
    body = { token: gw.token ?? "", to: `+${to}`, body: message };
  } else if (isWassenger) {
    if (gw.token) headers["Token"] = gw.token;
    body = { phone: `+${to}`, message };
  } else {
    // WAHA / wppconnect / Baileys style
    if (gw.token) headers["Authorization"] = `Bearer ${gw.token}`;
    headers["X-Api-Key"] = gw.token ?? "";
    body = { session: gw.session, chatId: `${to}@c.us`, phone: to, text: message, message };
  }

  try {
    const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const text = (await res.text()).slice(0, 400);
    if (!res.ok || /"?error"?\s*:/i.test(text)) {
      return { phone: to, ok: false, status: "failed", detail: text || `HTTP ${res.status}`, fallback: waLink(to, message) };
    }
    return { phone: to, ok: true, status: "sent" };
  } catch (err) {
    return {
      phone: to,
      ok: false,
      status: "failed",
      detail: err instanceof Error ? err.message : "network error",
      fallback: waLink(to, message),
    };
  }
}

/**
 * Green-API — a free WhatsApp gateway driven by YOUR own WhatsApp number
 * (linked once by QR in their console). Recipients need to do nothing at all,
 * so this is the primary sender for ordinary customers.
 */
async function sendGreen(green: NonNullable<Green>, to: string, message: string): Promise<SendResult> {
  const url = `${green.apiUrl.replace(/\/$/, "")}/waInstance${green.idInstance}/sendMessage/${green.apiToken}`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId: `${to}@c.us`, message }),
    });
    const text = (await res.text()).slice(0, 400);
    if (!res.ok || !/idMessage/i.test(text)) {
      return { phone: to, ok: false, status: "failed", detail: text || `HTTP ${res.status}`, fallback: waLink(to, message) };
    }
    return { phone: to, ok: true, status: "sent" };
  } catch (err) {
    return {
      phone: to,
      ok: false,
      status: "failed",
      detail: err instanceof Error ? err.message : "network error",
      fallback: waLink(to, message),
    };
  }
}


/**
 * Meta WhatsApp Cloud API — the only sender that reaches ordinary customers
 * without them activating anything. Free tier covers ~1000 conversations/mo.
 */
async function sendCloud(cloud: NonNullable<Cloud>, to: string, message: string): Promise<SendResult> {
  const url = `https://graph.facebook.com/v21.0/${cloud.phoneId}/messages`;
  const body = cloud.template
    ? {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: cloud.template,
          language: { code: cloud.lang },
          components: [{ type: "body", parameters: [{ type: "text", text: message.slice(0, 900) }] }],
        },
      }
    : {
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { preview_url: true, body: message },
      };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${cloud.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = (await res.text()).slice(0, 400);
    if (!res.ok) {
      return { phone: to, ok: false, status: "failed", detail: text, fallback: waLink(to, message) };
    }
    return { phone: to, ok: true, status: "sent" };
  } catch (err) {
    return {
      phone: to,
      ok: false,
      status: "failed",
      detail: err instanceof Error ? err.message : "network error",
      fallback: waLink(to, message),
    };
  }
}

async function sendOne(phone: string, message: string, cloud: Cloud, green: Green): Promise<SendResult> {
  const to = normalisePhone(phone);
  if (green) {
    const r = await sendGreen(green, to, message);
    if (r.ok) return r;
  }
  if (cloud) {
    const r = await sendCloud(cloud, to, message);
    if (r.ok) return r;
  }

  const apikey = CALLMEBOT_KEYS[to];
  if (!apikey) {
    return { phone: to, ok: false, status: "no-key", fallback: waLink(to, message) };
  }
  const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(
    to,
  )}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`;
  try {
    const res = await fetch(url, { method: "GET" });
    const body = (await res.text()).slice(0, 400);
    const failed = !res.ok || /error|invalid|not\s*found/i.test(body);
    if (failed) {
      return { phone: to, ok: false, status: "failed", detail: body || `HTTP ${res.status}`, fallback: waLink(to, message) };
    }
    return { phone: to, ok: true, status: "sent" };
  } catch (err) {
    return {
      phone: to,
      ok: false,
      status: "failed",
      detail: err instanceof Error ? err.message : "network error",
      fallback: waLink(to, message),
    };
  }
}

export const sendWhatsappBlast = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payload.parse(data))
  .handler(async ({ data }) => {
    const token = process.env["WHATSAPP_TOKEN"];
    const phoneId = process.env["WHATSAPP_PHONE_NUMBER_ID"];
    const cloud: Cloud =
      token && phoneId
        ? {
            token,
            phoneId,
            template: process.env["WHATSAPP_TEMPLATE_NAME"] || undefined,
            lang: process.env["WHATSAPP_TEMPLATE_LANG"] || "en",
          }
        : null;

    const idInstance = process.env["GREEN_API_ID_INSTANCE"];
    const apiToken = process.env["GREEN_API_TOKEN"];
    const green: Green =
      idInstance && apiToken
        ? {
            idInstance,
            apiToken,
            apiUrl: process.env["GREEN_API_URL"] || "https://api.green-api.com",
          }
        : null;

    const results: SendResult[] = [];
    const fast = !!(green || cloud);
    const size = fast ? 5 : 4;
    for (let i = 0; i < data.recipients.length; i += size) {
      const batch = data.recipients.slice(i, i + size);
      results.push(...(await Promise.all(batch.map((r) => sendOne(r.phone, r.message, cloud, green)))));
      if (i + size < data.recipients.length) await new Promise((r) => setTimeout(r, fast ? 400 : 900));
    }
    return {
      results,
      provider: green ? ("green" as const) : cloud ? ("cloud" as const) : ("callmebot" as const),
    };
  });


