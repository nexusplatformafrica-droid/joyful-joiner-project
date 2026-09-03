import { useEffect, useState } from "react";
import { Phone, X, Users, Megaphone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import collageBg from "@/assets/wa-collage.jpg";
import { TOUR_STATE_EVENT } from "@/components/luo/DownloadTour";

const CHANNEL_URL = "https://whatsapp.com/channel/0029VbCdTbF6buMEQY5wzG3y";
const SUPPORT_URL = "https://wa.me/256795592662";
/** Only set once the visitor actually joins the channel — closing it does not stick. */
const JOINED_KEY = "luofilm:whatsapp-channel-joined";
const AUTO_EXIT_MS = 8000;
const TOUR_KEY = "luofilm-download-tour-v3";

export function WhatsAppPrompt() {
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let joined = false;
    try {
      joined = localStorage.getItem(JOINED_KEY) === "1";
    } catch {
      /* storage unavailable */
    }
    if (joined) return;

    const tourFinished = (() => {
      try {
        const saved = JSON.parse(localStorage.getItem(TOUR_KEY) ?? "null") as {
          done?: boolean;
        } | null;
        return saved?.done === true;
      } catch {
        return false;
      }
    })();
    if (tourFinished) setOpen(true);

    const onTourState = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      setOpen(!active);
    };
    window.addEventListener(TOUR_STATE_EVENT, onTourState);
    return () => window.removeEventListener(TOUR_STATE_EVENT, onTourState);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      setLeaving(true);
      setTimeout(() => setOpen(false), 400);
    }, AUTO_EXIT_MS);
    return () => clearTimeout(t);
  }, [open]);

  /** Closing simply hides it for this visit; it returns on the next visit. */
  const close = () => {
    setLeaving(true);
    setTimeout(() => setOpen(false), 400);
  };

  /** Joining the channel is the only action that stops the prompt for good. */
  const join = () => {
    try {
      localStorage.setItem(JOINED_KEY, "1");
    } catch {
      /* storage unavailable */
    }
    close();
  };

  if (!open) return null;

  return (
    <div
      className={`pointer-events-none fixed inset-0 z-[65] grid place-items-center px-4 transition-opacity duration-300 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      <aside
        role="dialog"
        aria-label="Follow LUOFILM on WhatsApp"
        className={`wa-prompt pointer-events-auto relative w-full max-w-sm transition-all duration-400 ${
          leaving ? "scale-95 opacity-0" : "animate-enter"
        }`}
      >
        <div className="relative overflow-hidden rounded-3xl border border-[#25D366]/40 p-5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]">
          {/* movie-collage backdrop, softened so the content stays readable */}
          <img
            src={collageBg}
            alt=""
            width={1024}
            height={1024}
            loading="lazy"
            className="pointer-events-none absolute inset-0 size-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#0b3d2e]/90 via-[#0f5132]/85 to-[#075E54]/90" />
          {/* glow accents */}
          <div className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-[#25D366]/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 size-40 rounded-full bg-[#128C7E]/30 blur-3xl" />

          <button
            type="button"
            onClick={close}
            aria-label="Dismiss WhatsApp prompt"
            className="absolute top-3 right-3 grid size-8 place-items-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="size-4" />
          </button>

          <div className="relative flex flex-col items-center text-center">
            <span className="grid size-14 place-items-center rounded-full bg-white/10 shadow-[0_10px_25px_-8px_rgba(37,211,102,0.8)] ring-4 ring-white/10">
              <WhatsAppIcon className="size-11" />
            </span>

            <h2 className="mt-3 text-xl font-extrabold tracking-tight text-white">
              Don't miss new releases!
            </h2>
            <p className="mt-1 text-sm text-white/75">
              Join LUOFILM on WhatsApp for instant movie & episode updates.
            </p>

            <div className="mt-4 flex w-full items-center justify-center gap-3">
              <a
                href={CHANNEL_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={join}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#25D366] to-[#1ebe5b] px-4 py-2.5 text-sm font-bold text-[#06301c] shadow-[0_10px_25px_-8px_rgba(37,211,102,0.9)] transition-transform hover:scale-[1.03] active:scale-95"
              >
                <Megaphone className="size-4" />
                Follow Channel
              </a>
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={close}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-all hover:scale-[1.03] hover:bg-white/20 active:scale-95"
              >
                <Phone className="size-4" />
                Call Support
              </a>
            </div>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-white/55">
              <Users className="size-3" />
              Loved by thousands of LUOFILM viewers
            </p>
          </div>

          {/* 8s auto-exit progress bar */}
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
            <div
              className="h-full bg-[#25D366]"
              style={{ animation: `wa-exit-bar ${AUTO_EXIT_MS}ms linear forwards` }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}
