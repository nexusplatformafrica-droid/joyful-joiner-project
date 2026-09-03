import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { CatalogItem } from "@/lib/moviebox";

/**
 * Posters that already finished decoding this session. Remembering them keeps
 * artwork visible (and skips the fade-in) when a card scrolls back into view
 * or its rail re-renders, instead of flashing an empty placeholder again.
 */
const loadedPosters = new Set<string>();

/**
 * Warms posters into the browser cache the moment a rail's data arrives, so the
 * artwork is already decoded before the card scrolls into view.
 */
export function preloadPosters(items: { poster?: string | null }[]) {
  if (typeof window === "undefined") return;
  for (const it of items) {
    const src = it.poster;
    if (!src || loadedPosters.has(src)) continue;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => loadedPosters.add(src);
    img.src = src;
  }
}

export function MediaCard({
  item,
  block = false,
  rank,
}: {
  item: CatalogItem;
  block?: boolean;
  rank?: number;
}) {
  const [ready, setReady] = useState(() => !item.poster || loadedPosters.has(item.poster));
  // Warm this poster immediately, even before the card is scrolled into view.
  if (item.poster && !loadedPosters.has(item.poster)) preloadPosters([item]);

  return (
    <Link
      to="/watch/$id"
      params={{ id: item.id }}
      aria-label={item.title}
      className={`group block ${block ? "w-full" : "w-[calc((100vw-3rem)/3)] shrink-0 sm:w-[168px]"}`}
    >
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-brand">
        {item.poster ? (
          <img
            ref={(el) => {
              // Cached images can finish before React attaches onLoad.
              if (el?.complete && el.naturalWidth > 0 && !ready) {
                loadedPosters.add(item.poster!);
                setReady(true);
              }
            }}
            src={item.poster}
            alt={item.title}
            loading="eager"
            fetchPriority={ready ? "auto" : "high"}
            decoding="async"
            onLoad={() => {
              loadedPosters.add(item.poster!);
              if (!ready) setReady(true);
            }}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center px-2 text-center text-sm text-muted-foreground">
            {item.title}
          </div>
        )}
        {typeof rank === "number" && (
          <span className="absolute left-0 top-0 rounded-br-lg bg-brand px-2 py-0.5 text-[11px] font-black text-brand-foreground">
            {rank}
          </span>
        )}
        {item.appointmentDate ? (
          <span className="absolute left-0 top-0 grid w-9 place-items-center rounded-br-lg bg-[hsl(150_70%_45%)] px-1 py-1 text-[11px] font-bold leading-tight text-background">
            <span>{new Date(item.appointmentDate).toLocaleString("en-US", { month: "short" })}</span>
            <span className="text-[13px]">{new Date(item.appointmentDate).getUTCDate()}</span>
          </span>
        ) : (
          <span
            className={`absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight ${
              item.type === "series" ? "badge-hot" : "badge-vip"
            }`}
          >
            {item.type === "series" ? "Series" : "Movie"}
          </span>
        )}
        {item.appointmentDate && item.booked ? (
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-background/70 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur-md">
            {item.booked.toLocaleString()} booked
          </span>
        ) : null}
        {item.rating && !item.appointmentDate && (
          <span className="absolute bottom-1 right-1 flex items-center gap-1 rounded bg-background/80 px-1.5 py-0.5 text-[11px] font-semibold text-foreground backdrop-blur-md">
            <Star className="size-3 fill-current" />
            {item.rating}
          </span>
        )}

      </div>
      <p className="mt-2 truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
        {item.title}
      </p>
      {(item.year || item.genre) && (
        <p className="truncate text-[11px] text-muted-foreground/70">
          {[item.year, item.genre].filter(Boolean).join(" · ")}
        </p>
      )}
    </Link>
  );
}
