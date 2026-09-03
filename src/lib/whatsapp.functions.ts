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
    .max(200),
});

export type SendResult = {
  phone: string;
  ok: boolean;
  status: "sent" | "no-key" | "failed";
  detail?: string;
  fallback?: string;
};

async function sendOne(phone: string, message: string): Promise<SendResult> {
  const to = normalisePhone(phone);
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
    const results: SendResult[] = [];
    // small batches keep CallMeBot happy (it rate limits bursts)
    for (let i = 0; i < data.recipients.length; i += 4) {
      const batch = data.recipients.slice(i, i + 4);
      results.push(...(await Promise.all(batch.map((r) => sendOne(r.phone, r.message)))));
      if (i + 4 < data.recipients.length) await new Promise((r) => setTimeout(r, 900));
    }
    return { results };
  });
