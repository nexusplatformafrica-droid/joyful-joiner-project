import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MediaCard } from "./MediaCard";
import type { CatalogItem } from "@/lib/moviebox";

export function Rail({
  title,
  items,
  ranked = false,
}: {
  title?: string;
  items: CatalogItem[];
  ranked?: boolean;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  if (!items.length) return null;

  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.8, 320), behavior: "smooth" });
  };

  return (
    <section className="mt-8">
      {title && <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>}
      <div className="group/rail relative">
        <div
          ref={scroller}
          className="scrollbar-none flex gap-3 overflow-x-auto scroll-smooth pb-1 pr-2 sm:pr-4"
        >
          {items.map((item, i) => (
            <MediaCard key={item.id} item={item} {...(ranked ? { rank: i + 1 } : {})} />
          ))}
        </div>
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className="absolute left-0 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground opacity-0 shadow-lg ring-1 ring-border backdrop-blur-md transition-opacity group-hover/rail:opacity-100 sm:size-10"
        >
          <ChevronLeft className="size-4 sm:size-5" />
        </button>
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-background/80 text-foreground opacity-0 shadow-lg ring-1 ring-border backdrop-blur-md transition-opacity group-hover/rail:opacity-100 sm:right-4 sm:size-10"
        >
          <ChevronRight className="size-4 sm:size-5" />
        </button>
      </div>
    </section>
  );
}
