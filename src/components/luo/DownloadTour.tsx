import { useCallback, useEffect, useRef, useState } from "react";
import { Hand } from "lucide-react";

type Step = {
  title: string;
  body: string;
  /** Element to spotlight; the first visible match wins. */
  selector?: string;
  /** When set, the step only completes once the user (or "Do it for me") clicks. */
  requireClick?: boolean;
};

const STEPS: Step[] = [
  {
    title: "Step 1 — Open Luo or Luganda movies",
    body: "To download movies on LUOFILM.SITE, first tap the highlighted LUO tab. You can follow the same steps from LUGANDA.",
    selector: '[data-tour="luo-tab"]',
    requireClick: true,
  },
  {
    title: "Step 2 — Tap a movie poster",
    body: "Every translated movie our VJs upload lands in this grid, newest first. Tap the highlighted poster to open it.",
    selector: '[data-tour="first-poster"]',
    requireClick: true,
  },
  {
    title: "Step 3 — Press Play to watch",
    body: "Tap the player to start streaming the Luo/Luganda translation right here in your browser. Series show every season and episode under the player.",
    selector: '[data-tour="play"]',
    requireClick: true,
  },
  {
    title: "Step 4 — Tap Download to save it",
    body: "Tap the highlighted Download button to open the available video qualities.",
    selector: '[data-tour="download"]',
    requireClick: true,
  },
  {
    title: "Step 5 — Select the video quality",
    body: "Choose a highlighted quality such as 720P. Your browser download manager starts immediately and saves the movie to your Downloads folder.",
    selector: '[data-tour="quality"]',
    requireClick: true,
  },
];

const KEY = "luofilm-download-tour-v3";
export const TOUR_START_EVENT = "luofilm:start-download-tour";
export const TOUR_STATE_EVENT = "luofilm:download-tour-state";

type Saved = { step: number; active: boolean; done?: boolean };

function readSaved(): Saved | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function findTarget(selector?: string): HTMLElement | null {
  if (!selector || typeof document === "undefined") return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(selector));
  return (
    all.find((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    }) ?? null
  );
}

export function DownloadTour() {
  const [selfOpen, setSelfOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const [clicked, setClicked] = useState(false);
  const targetRef = useRef<HTMLElement | null>(null);

  const visible = selfOpen;
  const current = STEPS[step];

  // Restore an in-progress tour (it runs across pages) or start it for
  // first-time visitors, always from the home page.
  useEffect(() => {
    const saved = readSaved();
    if (saved?.done) {
      // Finished or skipped once — never show again.
    } else if (saved?.active) {
      // Resume from the first unfinished step, including after navigation.
      setStep(Math.min(saved.step, STEPS.length - 1));
      setSelfOpen(true);
    } else if (!saved) {
      window.setTimeout(() => setSelfOpen(true), 900);
    }
    const restart = () => {
      localStorage.setItem(KEY, JSON.stringify({ step: 0, active: true, done: false }));
      window.dispatchEvent(new CustomEvent(TOUR_STATE_EVENT, { detail: { active: true } }));
      setStep(0);
      setSelfOpen(true);
    };
    window.addEventListener(TOUR_START_EVENT, restart);
    return () => window.removeEventListener(TOUR_START_EVENT, restart);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !selfOpen) return;
    localStorage.setItem(KEY, JSON.stringify({ step, active: true, done: false }));
  }, [selfOpen, step]);

  // Keep the spotlight glued to the target, even while content loads in.
  useEffect(() => {
    if (!visible) return;
    setClicked(false);
    const sync = () => {
      const el = findTarget(current?.selector);
      targetRef.current = el;
      setBox(el ? el.getBoundingClientRect() : null);
    };
    sync();
    const el = targetRef.current;
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    const id = window.setInterval(sync, 400);
    window.addEventListener("resize", sync);
    window.addEventListener("scroll", sync, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", sync);
      window.removeEventListener("scroll", sync, true);
    };
  }, [visible, step, current?.selector]);

  const finish = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(KEY, JSON.stringify({ step: STEPS.length, active: false, done: true }));
      window.dispatchEvent(new CustomEvent(TOUR_STATE_EVENT, { detail: { active: false } }));
    }
    setSelfOpen(false);
  }, []);

  const next = useCallback(() => {
    setStep((s) => {
      const following = s + 1;
      if (following >= STEPS.length) {
        window.setTimeout(finish, 0);
        return s;
      }
      localStorage.setItem(KEY, JSON.stringify({ step: following, active: true, done: false }));
      return following;
    });
  }, [finish]);

  // Real clicks on the highlighted element move the tour forward.
  useEffect(() => {
    if (!visible || !current?.selector) return;
    const sel = current.selector;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(sel)) {
        setClicked(true);
        window.setTimeout(() => next(), 600);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [visible, current?.selector, next]);

  /** "Do it for me" — clicks exactly what the hand is pointing at. */
  const clickTarget = () => {
    const el = targetRef.current;
    if (!el) return next();
    setClicked(true);
    const video = el.querySelector("video");
    if (video) void (video as HTMLVideoElement).play().catch(() => {});
    el.click();
  };

  if (!visible || !current) return null;

  const targetBox = box;
  const hasTarget = targetBox !== null;
  const waiting = !!current.requireClick && hasTarget && !clicked;
  // Keep the card away from whatever is highlighted.
  const cardOnTop =
    targetBox !== null && targetBox.top + targetBox.height / 2 > window.innerHeight * 0.55;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {/* No dimming when there is nothing to highlight — the page must stay
          fully usable/clickable while the tour card is showing. */}

      {targetBox && (
        <>
          <div
            className="absolute rounded-2xl ring-4 ring-brand transition-all duration-300"
            style={{
              top: targetBox.top - 6,
              left: targetBox.left - 6,
              width: targetBox.width + 12,
              height: targetBox.height + 12,
              boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
            }}
          />
          <div
            className="absolute rounded-2xl ring-2 ring-brand/60 pulse"
            style={{
              top: targetBox.top - 14,
              left: targetBox.left - 14,
              width: targetBox.width + 28,
              height: targetBox.height + 28,
            }}
          />
          {/* Animated hand pointing at exactly what to tap. */}
          <div
            className="absolute transition-all duration-300"
            style={{
              top: targetBox.top + targetBox.height - 6,
              left: Math.min(
                Math.max(targetBox.left + targetBox.width / 2 - 18, 8),
                window.innerWidth - 60,
              ),
            }}
          >
            <span className="relative grid size-11 animate-bounce place-items-center">
              <span className="absolute inset-0 rounded-full bg-brand/30 blur-md" />
              <Hand className="relative size-9 -rotate-12 fill-brand/90 text-brand-foreground drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]" />
            </span>
          </div>
        </>
      )}

      <div
        role="dialog"
        aria-label="How to download movies on LUOFILM.SITE"
        className={`pointer-events-auto absolute inset-x-4 mx-auto max-w-md rounded-3xl border border-border bg-card p-5 shadow-2xl ${
          cardOnTop ? "top-32" : "bottom-24"
        } lg:left-1/2 lg:right-auto lg:mx-0 lg:-translate-x-1/2 ${
          cardOnTop ? "lg:top-20" : "lg:bottom-10"
        }`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-brand">
          Step {step + 1} of {STEPS.length}
        </p>
        <h2 className="mt-1 text-base font-black text-foreground">{current.title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{current.body}</p>

        <div className="mt-3 flex gap-1.5">
          {STEPS.map((s, i) => (
            <span
              key={s.title}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-brand" : "bg-foreground/15"}`}
            />
          ))}
        </div>

        {waiting && (
          <p className="mt-3 text-[12px] font-semibold text-brand">
            Tap the highlighted spot to continue.
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="rounded-full px-3 py-2 text-[13px] font-semibold text-muted-foreground transition hover:text-foreground"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-full bg-foreground/10 px-4 py-2 text-[13px] font-bold text-foreground"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (waiting) return clickTarget();
                next();
              }}
              className="rounded-full bg-brand px-5 py-2 text-[13px] font-bold text-brand-foreground transition hover:brightness-110"
            >
              {waiting ? "Tap it for me" : step === STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
