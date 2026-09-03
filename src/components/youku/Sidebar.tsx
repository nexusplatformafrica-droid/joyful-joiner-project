import { Link, useRouterState } from "@tanstack/react-router";
import { Icon3D } from "@/components/Icon3D";
import { CATEGORIES } from "@/lib/categories";
import markAsset from "@/assets/luofilm-mark.png";

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const itemClass = (active: boolean) =>
    `relative flex items-center gap-3 px-3 py-2.5 text-[12px] font-bold uppercase tracking-wide transition-colors ${
      active
        ? "text-sidebar-accent-foreground"
        : "text-sidebar-foreground hover:text-sidebar-accent-foreground"
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[var(--sidebar-w)] flex-col bg-sidebar lg:flex">
      <Link
        to="/"
        className="flex w-full shrink-0 items-center gap-1 border-b border-white/5 bg-black py-2.5 pl-0 pr-2"
      >
        <img src={markAsset} alt="" className="h-8 w-auto shrink-0" loading="eager" />
        <span className="whitespace-nowrap font-[Bebas_Neue,system-ui,sans-serif] text-[17px] leading-none tracking-normal">
          <span className="bg-gradient-to-r from-[#00EAFF] to-[#5CFF00] bg-clip-text text-transparent">
            LUOFILM
          </span>
          <span className="text-[#C822FF]">.SITE</span>
        </span>
      </Link>
      <nav className="scrollbar-none flex-1 overflow-y-auto pb-4">
        {CATEGORIES.map(({ slug, short, icon }) => {
          const active = slug === "home" ? pathname === "/" : pathname === `/category/${slug}`;
          const inner = (
            <>
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-sidebar-primary" />
              )}
              <Icon3D name={icon} className="size-8 shrink-0" />
              <span className="truncate">{short}</span>
            </>
          );
          return slug === "home" ? (
            <Link key={slug} to="/" className={itemClass(active)}>
              {inner}
            </Link>
          ) : (
            <Link key={slug} to="/category/$slug" params={{ slug }} className={itemClass(active)}>
              {inner}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
