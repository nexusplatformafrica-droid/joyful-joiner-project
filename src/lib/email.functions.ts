/**
 * Email blast sender (Resend HTTP API).
 *
 * Configure once in EMAIL_CONFIG below (or via RESEND_API_KEY / EMAIL_FROM
 * env vars). Unlike WhatsApp, email needs nothing from the recipient — one
 * click in the admin dashboard delivers to every user with an address.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const EMAIL_CONFIG = {
  /** Resend API key — https://resend.com (free tier: 3,000 emails/month). */
  apiKey: "",
  /** Verified sender, e.g. "LUOFILM <notify@luofilm.site>". */
  from: "LUOFILM <notify@luofilm.site>",
};

const payload = z.object({
  subject: z.string().min(1).max(200),
  recipients: z
    .array(z.object({ email: z.string().email(), html: z.string().min(1), text: z.string().min(1) }))
    .min(1)
    .max(2000),
});

export type EmailResult = { email: string; ok: boolean; detail?: string };

export const sendEmailBlast = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => payload.parse(data))
  .handler(async ({ data }): Promise<{ results: EmailResult[]; configured: boolean }> => {
    const apiKey = EMAIL_CONFIG.apiKey || process.env["RESEND_API_KEY"] || "";
    const from = EMAIL_CONFIG.from || process.env["EMAIL_FROM"] || "";
    if (!apiKey || !from) {
      return {
        configured: false,
        results: data.recipients.map((r) => ({
          email: r.email,
          ok: false,
          detail: "Email sender not configured yet",
        })),
      };
    }

    const results: EmailResult[] = [];
    const size = 8;
    for (let i = 0; i < data.recipients.length; i += size) {
      const batch = data.recipients.slice(i, i + size);
      results.push(
        ...(await Promise.all(
          batch.map(async (r): Promise<EmailResult> => {
            try {
              const res = await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${apiKey}`,
                  "content-type": "application/json",
                },
                body: JSON.stringify({
                  from,
                  to: [r.email],
                  subject: data.subject,
                  html: r.html,
                  text: r.text,
                }),
              });
              if (!res.ok) {
                const detail = (await res.text()).slice(0, 180);
                return { email: r.email, ok: false, detail };
              }
              return { email: r.email, ok: true };
            } catch (err) {
              return {
                email: r.email,
                ok: false,
                detail: err instanceof Error ? err.message : "network error",
              };
            }
          }),
        )),
      );
      if (i + size < data.recipients.length) await new Promise((r) => setTimeout(r, 350));
    }
    return { results, configured: true };
  });
