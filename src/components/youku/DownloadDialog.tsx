import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  catalogDownloadUrl,
  formatBytes,
  mediaDownloadUrl,
  mediaProbeUrl,
  startBrowserDownload,
  subtitleDownloadUrl,
} from "@/lib/download";
import { useSubscription } from "@/hooks/useSubscription";

type StreamSource = {
  id: string;
  url: string;
  resolution: number;
  codec: string | null;
  bytes?: number;
  size: string | null;
  captions: { label: string; url: string }[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  sources: StreamSource[];
  baseName: string;
  /** Luo/Luganda titles start in the browser download manager immediately. */
  blobDownload?: boolean | undefined;
  /** Catalog subject id — downloads are rebuilt from the real movie stream. */
  catalogId?: string | undefined;
  season?: number | undefined;
  episode?: number | undefined;
};

export function DownloadDialog({
  open,
  onClose,
  sources,
  baseName,
  blobDownload,
  catalogId,
  season = 0,
  episode = 0,
}: Props) {
  const { subscribed, requireSubscription } = useSubscription();
  const [probed, setProbed] = useState<Record<string, number | null>>({});

  // Real sizes come from our relay (the CDNs block cross-origin HEAD), and the
  // probe also exposes provider files that are only a short promo clip rather
  // than the full movie — those are never offered as a download.
  useEffect(() => {
    if (!open) return;
    for (const source of sources) {
      if (probed[source.id] !== undefined) continue;
      setProbed((prev) => ({ ...prev, [source.id]: null }));
      fetch(mediaProbeUrl(source.url))
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const size = Number(d?.size) || null;
          setProbed((prev) => ({ ...prev, [source.id]: size }));
        })
        .catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sources]);




  const startManagedDownload = (source: StreamSource, filename: string) => {
    if (!requireSubscription()) {
      onClose();
      return;
    }
    startBrowserDownload(source.url, filename);
    onClose();
  };

  const guard = (e: React.MouseEvent) => {
    if (subscribed) return;
    e.preventDefault();
    onClose();
    requireSubscription();
  };

  if (!open) return null;

  // Keep every real media file (alternate codecs included), but never offer a
  // streaming manifest — those save as a tiny text file, not the movie.
  const seenRes = new Set<number>();
  const videos = [...sources]
    .filter((s) => !/\.(mpd|m3u8)(\?|$)/i.test(s.url))
    .filter((s) => !catalogId || (seenRes.has(s.resolution) ? false : (seenRes.add(s.resolution), true)))
    .sort((a, b) => a.resolution - b.resolution || String(a.codec).localeCompare(String(b.codec)));


  const seenCaption = new Set<string>();
  const captions = sources
    .flatMap((s) => s.captions)
    .filter((c) => (seenCaption.has(c.label) ? false : (seenCaption.add(c.label), true)));

  const tile =
    "flex flex-col items-center justify-center gap-0.5 rounded-lg bg-muted/60 px-2 py-3 text-center transition hover:bg-muted";

  return (
    <div className="fixed inset-0 z-[70] grid place-items-end sm:place-items-center bg-black/70 p-0 sm:p-4">
      <button aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between px-5 pb-2 pt-4">
          <div>
            <h3 className="text-base font-bold text-foreground">Download options</h3>
            {!subscribed && (
              <p className="mt-0.5 text-[11px] text-vip">Membership required to download</p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close download options"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto px-5 pb-5">
          <p className="text-sm font-semibold text-foreground">Video file</p>
          {videos.length ? (
            <div className="mt-2 grid grid-cols-3 gap-3">
              {videos.map((source) => {
                const label = `${baseName}.${source.resolution || "auto"}p`;
                if (catalogId) {
                  // Server rebuilds the signed stream into one MP4 and answers
                  // with an attachment, so the browser's own download manager
                  // saves the file — nothing is buffered in the page.
                  return (
                    <a
                      key={source.id}
                      data-tour="quality"
                      href={catalogDownloadUrl(catalogId, season, episode, source.resolution, label)}
                      download
                      onClick={guard}
                      className={tile}
                    >
                      <span className="text-sm font-bold text-foreground">
                        {source.resolution ? `${source.resolution}P` : "AUTO"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatBytes(source.bytes ?? null) ?? source.size ?? "Full movie"}
                      </span>
                    </a>
                  );
                }
                return blobDownload ? (
                  <button
                    key={source.id}
                    type="button"
                    data-tour="quality"
                    onClick={() => startManagedDownload(source, label)}
                    className={tile}
                  >
                    <span className="text-sm font-bold text-foreground">
                      {source.resolution ? `${source.resolution}P` : "AUTO"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatBytes(probed[source.id]) ?? source.size ?? "…"}
                    </span>
                  </button>
                ) : (
                  <a
                    key={source.id}
                    data-tour="quality"
                    href={mediaDownloadUrl(source.url, label)}
                    download
                    onClick={guard}
                    className={tile}
                  >
                    <span className="text-sm font-bold text-foreground">
                      {source.resolution ? `${source.resolution}P` : "AUTO"}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatBytes(probed[source.id]) ?? source.size ?? "…"}
                    </span>
                  </a>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No downloadable file available.</p>
          )}

          <p className="mt-5 text-sm font-semibold text-foreground">Subtitle file</p>
          {captions.length ? (
            <div className="mt-2 grid grid-cols-3 gap-3">
              {captions.map((caption) => (
                <a
                  key={caption.label + caption.url}
                  href={subtitleDownloadUrl(caption.url, `${baseName}.${caption.label}`)}
                  download
                  onClick={guard}
                  className={`${tile} text-sm font-semibold text-foreground`}
                >
                  <span className="truncate">{caption.label}</span>
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">No subtitles for this title.</p>
          )}
        </div>
      </div>
    </div>
  );
}
