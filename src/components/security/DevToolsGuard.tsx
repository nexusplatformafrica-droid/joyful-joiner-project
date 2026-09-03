import { useEffect } from "react";

/**
 * Anti-inspection guard.
 *
 * When a visitor opens developer tools (or tries the usual shortcuts / right
 * click), the console and any captured logs are wiped and the page is thrown
 * away into a fresh document, so stream URLs that were already requested can no
 * longer be read out of the network panel.
 *
 * Disabled in development and inside the Lovable preview iframe so building the
 * site stays possible, and skipped on /admin.
 */
export function DevToolsGuard() {
  useEffect(() => {
    if (!import.meta.env.PROD) return;
    if (typeof window === "undefined") return;
    if (window.top !== window.self) return; // embedded preview
    if (window.location.pathname.startsWith("/admin")) return;

    let tripped = false;

    const wipeAndBounce = () => {
      if (tripped) return;
      tripped = true;
      try {
        console.clear();
        // Blank out anything a paused debugger could read off the page.
        document.documentElement.innerHTML = "";
      } catch {
        /* ignore */
      }
      // New document = the recorded network entries for this page are dropped.
      try {
        window.performance.clearResourceTimings?.();
      } catch {
        /* ignore */
      }
      const home = window.location.origin + "/";
      window.open(home, "_blank", "noopener");
      window.location.replace(home);
    };

    const sizeCheck = () => {
      const wide = window.outerWidth - window.innerWidth > 180;
      const tall = window.outerHeight - window.innerHeight > 200;
      if (wide || tall) wipeAndBounce();
    };

    const timingCheck = () => {
      const start = window.performance.now();
      // eslint-disable-next-line no-debugger
      debugger;
      if (window.performance.now() - start > 120) wipeAndBounce();
    };

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (
        e.key === "F12" ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) ||
        ((e.ctrlKey || e.metaKey) && k === "u")
      ) {
        e.preventDefault();
        wipeAndBounce();
      }
    };

    const onContext = (e: MouseEvent) => e.preventDefault();

    const id = window.setInterval(() => {
      sizeCheck();
      timingCheck();
    }, 1200);
    window.addEventListener("resize", sizeCheck);
    window.addEventListener("keydown", onKey);
    window.addEventListener("contextmenu", onContext);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("resize", sizeCheck);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("contextmenu", onContext);
    };
  }, []);

  return null;
}
