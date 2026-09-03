import { Link } from "@tanstack/react-router";
import { Play } from "lucide-react";

/**
 * Featured VJ button — a clean glass pill (no artwork behind it) that sits
 * low in the hero so it slightly overlaps the "Trending now" rail.
 */
export function VjRail() {
  return (
    <nav aria-label="Featured VJ" className="flex items-center">
      <Link
        to="/luo"
        className="group inline-flex items-center gap-2 rounded-2xl border border-brand/60 bg-brand/25 px-3.5 py-2 text-[12px] font-bold text-foreground shadow-[0_10px_28px_rgba(0,0,0,0.55)] backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:border-brand hover:bg-brand/40 sm:px-4 sm:py-2.5 sm:text-[13px]"
      >
        <span className="grid size-6 place-items-center rounded-full bg-brand text-brand-foreground">
          <Play className="size-3.5 fill-current" />
        </span>
        VJ Senior Paul
      </Link>
    </nav>
  );
}
