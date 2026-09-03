/**
 * ArtPlayer-based video player.
 *
 * Supports progressive MP4, HLS (hls.js) and signed DASH (dash.js) — the last
 * one is what the catalog's real movie files use. Media bytes always come
 * straight from the provider CDN, never through our own origin.
 */
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import watermark from "@/assets/luofilm-watermark.png.asset.json";
import { isHlsUrl } from "@/lib/download";

export type Subtitle = { label: string; src: string };

const iconAttrs =
  'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="22" height="22"';
/** Solid filled control glyphs (no text labels in the control bar). */
const ICONS = {
  captions: `<svg ${iconAttrs}><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2z"/></svg>`,
  dualSub: `<svg ${iconAttrs}><path d="M2 5h20v5H2z"/><path d="M2 14h14v5H2z"/></svg>`,
  quality: `<svg ${iconAttrs}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 16c-3.31 0-6-2.69-6-6 0-1.66.67-3.16 1.76-4.24l1.41 1.41C8.56 9.78 8 10.84 8 12c0 2.21 1.79 4 4 4s4-1.79 4-4c0-1.16-.56-2.22-1.41-2.83l1.41-1.41C17.33 8.84 18 10.34 18 12c0 3.31-2.69 6-6 6z"/></svg>`,
  next: `<svg ${iconAttrs}><path d="M7 6l8 6-8 6V6zm9 0h2v12h-2V6z"/></svg>`,
  theater: `<svg ${iconAttrs}><rect x="2" y="6" width="20" height="12" rx="2"/></svg>`,
};

/**
 * Second ("DualSub") subtitle line. A hidden <track> feeds cue text into an
 * overlay element so both languages can be shown at once.
 */
function setSecondary(art: any, src: string | null) {
  const video: HTMLVideoElement = art?.video;
  if (!video) return;
  const container: HTMLElement = art.template?.$player ?? video.parentElement;
  let overlay = container?.querySelector<HTMLElement>(".art-dualsub");
  if (!overlay && container) {
    overlay = document.createElement("div");
    overlay.className = "art-dualsub";
    container.appendChild(overlay);
  }
  const existing: HTMLTrackElement | null = (video as any).__dualTrack ?? null;
  if (existing) {
    existing.remove();
    (video as any).__dualTrack = null;
  }
  if (!overlay) return;
  overlay.textContent = "";
  if (!src) {
    overlay.style.display = "none";
    return;
  }
  overlay.style.display = "block";
  const track = document.createElement("track");
  track.kind = "subtitles";
  track.src = src;
  track.default = true;
  video.appendChild(track);
  (video as any).__dualTrack = track;
  const apply = () => {
    const textTrack = track.track;
    textTrack.mode = "hidden";
    textTrack.oncuechange = () => {
      const cue: any = textTrack.activeCues?.[0];
      overlay!.textContent = cue ? String(cue.text).replace(/<[^>]+>/g, "") : "";
    };
  };
  track.addEventListener("load", apply);
  apply();
}


export function Player({
  src,
  kind,
  poster,
  title,
  subtitles = [],
  fileQualities = [],
  activeQuality,
  onQualityChange,
  onDirectError,
  onNext,
  onTheater,
  theater,
  className,
}: {
  src: string;
  /** Explicit stream kind; inferred from the URL when omitted. */
  kind?: "mp4" | "m3u8" | "dash" | undefined;
  poster?: string | undefined;
  title?: string | undefined;
  subtitles?: Subtitle[];
  fileQualities?: { id: string; label: string; resolution: number; note?: string | null }[];
  activeQuality?: string | undefined;
  onQualityChange?: ((id: string) => void) | undefined;
  /** Return true when the parent switched to another source. */
  onDirectError?: (() => boolean) | undefined;
  onNext?: (() => void) | undefined;
  onTheater?: (() => void) | undefined;
  theater?: boolean | undefined;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<any>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  // Latest callbacks, so recreating the player is only driven by the source.
  const handlers = useRef({ onQualityChange, onDirectError, onNext, onTheater });
  handlers.current = { onQualityChange, onDirectError, onNext, onTheater };

  useEffect(() => {
    if (!src || !containerRef.current) return;
    setPlaybackError(null);
    let art: any;
    let disposed = false;

    (async () => {
      const [{ default: Artplayer }] = await Promise.all([import("artplayer")]);
      if (disposed || !containerRef.current) return;

      const type = kind ?? (isHlsUrl(src) ? "m3u8" : /\.mpd(\?|$)/i.test(src) ? "dash" : "mp4");
      const theme = getComputedStyle(document.documentElement).getPropertyValue("--hot").trim();

      const settings: any[] = [];

      // Bottom-bar controls, laid out like the reference player:
      // [ play · volume · time ] ............ [ language · DualSub · quality · gear · pip · fullscreen ]
      const controls: any[] = [];

      if (subtitles.length) {
        const defaultSub = subtitles[0]!;
        controls.push({
          position: "right",
          index: 10,
          name: "subtitle-lang",
          html: defaultSub.label,
          style: { padding: "0 8px", fontSize: "13px" },
          selector: [
            { html: "Off", url: "" },
            ...subtitles.map((s, i) => ({ default: i === 0, html: s.label, url: s.src })),
          ],
          onSelect(item: any) {
            if (!item.url) {
              art.subtitle.show = false;
            } else {
              art.subtitle.switch(item.url, { name: item.html, type: "vtt" });
              art.subtitle.show = true;
            }
            return item.html;
          },
        });
      }

      if (subtitles.length > 1) {
        controls.push({
          position: "right",
          index: 20,
          name: "dual-sub",
          html: "DualSub",
          style: { padding: "0 8px", fontSize: "13px", opacity: "0.85" },
          selector: [
            { html: "Off", src: "", default: true },
            ...subtitles.map((s) => ({ html: s.label, src: s.src })),
          ],
          onSelect(item: any) {
            setSecondary(art, item.src || null);
            return "DualSub";
          },
        });
      }

      if (fileQualities.length > 1) {
        const current = fileQualities.find((q) => q.id === activeQuality) ?? fileQualities[0]!;
        controls.push({
          position: "right",
          index: 30,
          name: "quality",
          html: current.label.toUpperCase(),
          style: { padding: "0 8px", fontSize: "13px" },
          selector: fileQualities.map((q) => ({
            default: q.id === activeQuality,
            html: q.label,
            quality: q.id,
            resolution: q.resolution,
            label: q.label,
          })),
          onSelect(item: any) {
            const dash = (art.video as any)?.__dash;
            if (dash) {
              const qualities = dash.getRepresentationsByType?.("video") ?? [];
              const target = qualities.reduce((best: any, quality: any) =>
                Math.abs(Number(quality.height) - Number(item.resolution)) <
                Math.abs(Number(best?.height ?? 0) - Number(item.resolution))
                  ? quality
                  : best, qualities[0]);
              if (target) {
                dash.updateSettings?.({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
                dash.setRepresentationForTypeById?.("video", target.id, true);
              }
            }
            handlers.current.onQualityChange?.(item.quality);
            return String(item.label).toUpperCase();
          },
        });
      }

      if (onNext) {
        controls.push({
          position: "right",
          html: ICONS.next,
          index: 5,
          click: () => handlers.current.onNext?.(),
        });
      }
      if (onTheater) {
        controls.push({
          position: "right",
          html: ICONS.theater,
          index: 6,
          click: () => handlers.current.onTheater?.(),
        });
      }


      art = new Artplayer({
        container: containerRef.current,
        url: src,
        type,
        ...(poster ? { poster } : {}),
        volume: 0.8,
        isLive: false,
        muted: false,
        autoplay: false,
        pip: true,
        autoMini: true,
        screenshot: true,
        setting: true,
        flip: true,
        playbackRate: true,
        aspectRatio: true,
        fullscreen: true,
        fullscreenWeb: true,
        subtitleOffset: subtitles.length > 0,
        miniProgressBar: true,
        mutex: true,
        backdrop: true,
        playsInline: true,
        autoPlayback: true,
        airplay: true,
        theme,
        lang: typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "en",
        moreVideoAttr: { playsInline: true, preload: "auto" },
        settings,
        controls,
        layers: [
          {
            html: `<img src="${watermark.url}" alt="LUOFILM" style="width:38px;height:38px;opacity:.75" />`,
            style: { position: "absolute", top: "14px", right: "14px", pointerEvents: "none" },
          },
        ],
        ...(subtitles.length
          ? { subtitle: { url: subtitles[0]!.src, type: "vtt", style: { fontSize: "20px" } } }
          : {}),
        customType: {
          dash: async (video: HTMLVideoElement, url: string) => {
            const dashjs = await import("dashjs");
            const player = (dashjs as any).MediaPlayer().create();
            player.updateSettings({
              streaming: {
                abr: { autoSwitchBitrate: { video: true } },
                capabilities: { useMediaCapabilitiesApi: true },
                buffer: { fastSwitchEnabled: true },
              },
            });
            player.on((dashjs as any).MediaPlayer.events.ERROR, (event: any) => {
              if (event?.error) {
                setPlaybackError("This browser cannot decode this video's format. Try Safari, Edge, or an HEVC-enabled device.");
                handlers.current.onDirectError?.();
              }
            });
            player.on((dashjs as any).MediaPlayer.events.STREAM_INITIALIZED, () => {
              const qualities = player.getRepresentationsByType?.("video") ?? [];
              const hasVideoTrack = (player.getTracksFor?.("video") ?? []).length > 0;
              if (!qualities.length || !hasVideoTrack) {
                video.pause();
                const switched = handlers.current.onDirectError?.();
                if (!switched)
                  setPlaybackError(
                    "This browser cannot decode this video's picture format. Try Chrome, Edge or Safari on another device.",
                  );
                return;
              }
              const selected = fileQualities.find((quality) => quality.id === activeQuality);
              if (!selected) return;
              const target = qualities.reduce((best: any, quality: any) =>
                Math.abs(Number(quality.height) - selected.resolution) <
                Math.abs(Number(best?.height ?? 0) - selected.resolution)
                  ? quality
                  : best, qualities[0]);
              if (target) {
                player.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } });
                player.setRepresentationForTypeById?.("video", target.id, true);
              }
            });
            player.initialize(video, url, false);
            (video as any).__dash = player;
          },
          m3u8: async (video: HTMLVideoElement, url: string) => {
            if (video.canPlayType("application/vnd.apple.mpegurl")) {
              video.src = url;
              return;
            }
            const Hls = (await import("hls.js")).default;
            if (!Hls.isSupported()) {
              video.src = url;
              return;
            }
            const hls = new Hls();
            hls.loadSource(url);
            hls.attachMedia(video);
            (video as any).__hls = hls;
          },
        },
      });

      art.on("error", (error: unknown) => {
        const switched = handlers.current.onDirectError?.();
        if (!switched) setPlaybackError(error instanceof Error ? error.message : "This source could not be played.");
      });

      artRef.current = art;
    })();

    return () => {
      disposed = true;
      const player = artRef.current;
      artRef.current = null;
      if (player) {
        const video = player.video as any;
        video?.__dash?.reset?.();
        video?.__hls?.destroy?.();
        player.destroy(false);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, kind]);

  // Keep subtitle/quality menus in sync without rebuilding the player.
  useEffect(() => {
    const art = artRef.current;
    if (!art || !src) return;
    try {
      art.title = title ?? "";
    } catch {
      /* ignore */
    }
  }, [title, src]);

  if (!src) {
    return (
      <div
        className={`grid aspect-video w-full place-items-center rounded-[1.25rem] bg-card text-sm text-muted-foreground ${className ?? ""}`}
      >
        Preparing stream…
      </div>
    );
  }

  return (
    <div
      data-tour="play"
      className={`moviebox-player relative aspect-video w-full overflow-hidden bg-black ${className ?? ""}`}
    >
      <div
        ref={containerRef}
        aria-label={title ? `Player for ${title}` : "Video player"}
        className="size-full"
      />
      {playbackError && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/90 px-6 text-center">
          <div className="max-w-md">
            <AlertTriangle className="mx-auto size-8 text-vip" />
            <p className="mt-3 text-sm font-semibold text-foreground">Video format not supported</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{playbackError}</p>
          </div>
        </div>
      )}
    </div>
  );
}
