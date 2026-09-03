import { normalisePhone } from "./whatsapp.functions";

/**
 * Serverless (browser-only) WhatsApp blast.
 *
 * Runs entirely in the admin's browser — no server, no gateway, no API keys.
 * It drives WhatsApp Web through the official click-to-chat deep link, reusing
 * a single tab and stepping through the queue automatically. The admin's own
 * WhatsApp Web session does the delivery, so recipients activate nothing.
 */

export type BrowserTarget = { phone: string; message: string };

export type BrowserBlastEvent = {
  index: number;
  total: number;
  phone: string;
  done: boolean;
};

export type BrowserBlastHandle = {
  stop: () => void;
  promise: Promise<number>;
};

export function whatsappWebLink(phone: string, text: string) {
  const digits = normalisePhone(phone);
  const web = typeof navigator !== "undefined" && /Android|iPhone|iPad/i.test(navigator.userAgent);
  const base = web ? "https://wa.me/" : "https://web.whatsapp.com/send?phone=";
  return web
    ? `${base}${digits}?text=${encodeURIComponent(text)}`
    : `${base}${digits}&text=${encodeURIComponent(text)}&type=phone_number&app_absent=0`;
}

/**
 * Opens each chat in one reused window, waiting `delayMs` between recipients.
 * Returns a handle so the UI can stop the run at any time.
 */
export function startBrowserBlast(
  targets: BrowserTarget[],
  delayMs: number,
  onStep: (e: BrowserBlastEvent) => void,
): BrowserBlastHandle {
  let cancelled = false;
  let win: Window | null = null;

  const wait = (ms: number) =>
    new Promise<void>((resolve) => {
      const t = setTimeout(resolve, ms);
      timers.push(t);
    });
  const timers: ReturnType<typeof setTimeout>[] = [];

  const promise = (async () => {
    let opened = 0;
    for (let i = 0; i < targets.length; i++) {
      if (cancelled) break;
      const t = targets[i]!;
      const url = whatsappWebLink(t.phone, t.message);

      if (!win || win.closed) {
        win = window.open(url, "luofilm-whatsapp");
        if (!win) throw new Error("Popup blocked — allow pop-ups for this site, then start again.");
      } else {
        win.location.href = url;
        win.focus();
      }

      opened++;
      onStep({ index: i, total: targets.length, phone: normalisePhone(t.phone), done: false });
      if (i < targets.length - 1) await wait(delayMs);
    }
    onStep({ index: targets.length, total: targets.length, phone: "", done: true });
    return opened;
  })();

  return {
    stop: () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    },
    promise,
  };
}
