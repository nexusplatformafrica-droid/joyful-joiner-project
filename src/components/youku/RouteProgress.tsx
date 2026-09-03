import { useEffect, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useIsFetching } from "@tanstack/react-query";

/**
 * Thin top progress bar that appears the instant a link is clicked, so a page
 * that still has data in flight never looks frozen.
 */
export function RouteProgress() {
  const routerLoading = useRouterState({ select: (s) => s.status === "pending" });
  const fetching = useIsFetching();
  const active = routerLoading || fetching > 0;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (active) {
      setVisible(true);
      return;
    }
    // Keep it on screen briefly so quick navigations still read as feedback.
    const t = setTimeout(() => setVisible(false), 220);
    return () => clearTimeout(t);
  }, [active]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px] overflow-hidden">
      <div
        className={`h-full w-full origin-left bg-gradient-to-r from-brand via-vip to-brand transition-transform duration-300 ${
          active ? "animate-pulse" : ""
        }`}
      />
    </div>
  );
}
