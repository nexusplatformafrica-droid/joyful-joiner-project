import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Icon3D } from "@/components/Icon3D";
import { listAllEpisodes, listLuoTitles, type LuoLanguage } from "@/lib/luo";

/** Floating liquid-glass bottom navigation with 3D icons, mobile only. */
export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const shell =
    "relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-semibold transition-all duration-300";
  const tone = (active: boolean) => (active ? "text-foreground" : "text-muted-foreground");

  const Glow = ({ active }: { active: boolean }) => (
    <span
      className={`pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(180deg,color-mix(in_oklab,var(--brand)_38%,transparent),transparent)] transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    />
  );

  const iconClass = (active: boolean) =>
    `size-6 transition-transform duration-300 ${active ? "-translate-y-0.5 scale-110" : "scale-95 opacity-80"}`;

  const queryClient = useQueryClient();
  // Warm the library data as soon as the tab is touched/hovered so the page
  // paints with content instead of skeletons.
  const warm = (language: LuoLanguage) => () => {
    void queryClient.prefetchQuery({
      queryKey: ["luo-titles", language],
      queryFn: () => listLuoTitles(language),
      staleTime: 30 * 1000,
    });
    void queryClient.prefetchQuery({
      queryKey: ["luo-all-episodes"],
      queryFn: listAllEpisodes,
      staleTime: 60 * 1000,
    });
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] lg:hidden">
      <nav className="pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-[26px] border border-foreground/10 bg-background/70 p-1.5 shadow-[0_10px_34px_-8px_rgba(0,0,0,0.65)] backdrop-blur-2xl">
        <Link to="/" className={`${shell} ${tone(pathname === "/")}`}>
          <Glow active={pathname === "/"} />
          <Icon3D name="home" className={`relative ${iconClass(pathname === "/")}`} />
          <span className="relative">Home</span>
        </Link>
        <Link
          to="/luo"
          data-tour="luo-tab"
          onTouchStart={warm("luo")}
          onMouseEnter={warm("luo")}
          className={`${shell} ${tone(pathname.startsWith("/luo"))}`}
        >
          <Glow active={pathname.startsWith("/luo")} />
          <Icon3D name="live-tv" className={`relative ${iconClass(pathname.startsWith("/luo"))}`} />
          <span className="relative">Luo</span>
        </Link>
        <Link
          to="/luganda"
          onTouchStart={warm("luganda")}
          onMouseEnter={warm("luganda")}
          className={`${shell} ${tone(pathname.startsWith("/luganda"))}`}
        >
          <Glow active={pathname.startsWith("/luganda")} />
          <Icon3D name="drama" className={`relative ${iconClass(pathname.startsWith("/luganda"))}`} />
          <span className="relative">Luganda</span>
        </Link>
        <Link
          to="/category/$slug"
          params={{ slug: "trending" }}
          className={`${shell} ${tone(pathname === "/category/trending")}`}
        >
          <Glow active={pathname === "/category/trending"} />
          <Icon3D
            name="trending"
            className={`relative ${iconClass(pathname === "/category/trending")}`}
          />
          <span className="relative">Trending</span>
        </Link>
        <Link to="/search" search={{ q: "" }} className={`${shell} ${tone(pathname === "/search")}`}>
          <Glow active={pathname === "/search"} />
          <Icon3D name="search" className={`relative ${iconClass(pathname === "/search")}`} />
          <span className="relative">Search</span>
        </Link>
      </nav>
    </div>
  );
}
