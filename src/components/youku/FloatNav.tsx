import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Crown, LogIn, LogOut, Shield, User as UserIcon } from "lucide-react";
import { AuthModal } from "@/components/auth/AuthModal";
import { Icon3D } from "@/components/Icon3D";
import { useIsAdmin } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { db as supabase } from "@/lib/db";
import { listAllEpisodes, listLuoTitles, type LuoLanguage } from "@/lib/luo";
import markAsset from "@/assets/luofilm-mark.png";

/** Floating glass pill nav: LUO · LUGANDA · SUBSCRIBE · LOGIN */
export function FloatNav({ onSearch }: { onSearch?: () => void } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const queryClient = useQueryClient();
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
  const { isAdmin, user } = useIsAdmin();
  const { openSubscribe } = useSubscription();
  const [authOpen, setAuthOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  const pill = (active: boolean) =>
    `grid h-8 place-items-center rounded-full px-3.5 text-[12px] font-black uppercase tracking-wide transition ${
      active
        ? "bg-brand text-brand-foreground shadow-[0_4px_18px_-4px_var(--brand)]"
        : "text-foreground/80 hover:bg-foreground/10 hover:text-foreground"
    }`;

  return (
    <>
      <div className="search-glow shrink-0 rounded-full p-[1.5px]">
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-background/85 p-1 shadow-lg backdrop-blur-xl">
        {/* Brand inside the float on mobile only (desktop sidebar shows it). */}
        <Link to="/" className="flex shrink-0 items-center gap-1.5 pl-1.5 pr-1 lg:hidden">
          <img src={markAsset} alt="LUOFILM logo" className="h-5 w-auto sm:h-6" />
          <span className="whitespace-nowrap font-[Bebas_Neue,system-ui,sans-serif] text-[13px] leading-none tracking-wide sm:text-[15px]">
            <span className="bg-gradient-to-r from-[#00EAFF] to-[#5CFF00] bg-clip-text text-transparent">
              LUOFILM
            </span>
            <span className="text-[#C822FF]">.SITE</span>
          </span>
        </Link>
        <Link
          to="/"
          className={`${pill(pathname === "/" || pathname.startsWith("/watch") || pathname.startsWith("/search"))} hidden lg:grid`}
        >
          Moviebox
        </Link>
        <Link
          to="/luo"
          data-tour="luo-tab"
          onMouseEnter={warm("luo")}
          onTouchStart={warm("luo")}
          className={`${pill(pathname.startsWith("/luo"))} hidden lg:grid`}
        >
          Luo
        </Link>
        <Link
          to="/luganda"
          onMouseEnter={warm("luganda")}
          onTouchStart={warm("luganda")}
          className={`${pill(pathname.startsWith("/luganda"))} hidden lg:grid`}
        >
          Luganda
        </Link>
        {onSearch && (
          <button
            type="button"
            aria-label="Search"
            onClick={onSearch}
            className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground/12 text-foreground transition hover:bg-foreground/25 lg:hidden"
          >
            <Icon3D name="search" className="size-4" />
          </button>
        )}
        <button
          type="button"
          onClick={openSubscribe}
          className="grid h-8 place-items-center rounded-full bg-[linear-gradient(100deg,oklch(0.95_0.06_95),oklch(0.87_0.11_82))] px-3.5 text-[12px] font-bold uppercase tracking-wide text-vip-foreground shadow-[0_6px_18px_-8px_var(--vip)] transition hover:brightness-105"
        >
          <span className="flex items-center gap-1">
            <Crown className="size-3.5" />
            <span className="hidden sm:inline">Subscribe</span>
          </span>
        </button>

        {user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenu((v) => !v)}
              aria-label="Account"
              className="grid size-8 place-items-center rounded-full bg-foreground/15 text-foreground transition hover:bg-foreground/25"
            >
              <UserIcon className="size-4" />
            </button>
            {menu && (
              <div
                className="absolute right-0 top-10 z-50 w-48 overflow-hidden rounded-xl bg-card/95 p-1 shadow-2xl ring-1 ring-border backdrop-blur-xl"
                onMouseLeave={() => setMenu(false)}
              >
                <p className="truncate px-3 py-2 text-[11px] text-muted-foreground">{user.email}</p>
                {isAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setMenu(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground hover:bg-foreground/10"
                  >
                    <Shield className="size-4" /> Admin panel
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    void supabase.auth.signOut();
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-foreground hover:bg-foreground/10"
                >
                  <LogOut className="size-4" /> Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAuthOpen(true)}
            className="grid h-8 place-items-center rounded-full bg-foreground px-3.5 text-[12px] font-black uppercase tracking-wide text-background transition hover:opacity-90"
          >
            <span className="flex items-center gap-1">
              <LogIn className="size-3.5" />
              <span className="hidden sm:inline">Login</span>
            </span>
          </button>
        )}
      </div>
      </div>

      <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
    </>
  );
}
