import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLuoTitles, type LuoLanguage } from "@/lib/luo";

type Tile = {
  label: string;
  to: "/luo" | "/luganda";
  language: LuoLanguage;
  /** Prefer a poster whose VJ field matches this needle, when present. */
  vj?: string;
  /** Per-tile gradient: [border, overlay]. */
  ring: string;
  overlay: string;
  glow: string;
};

const TILES: Tile[] = [
  {
    label: "LUO MOVIES",
    to: "/luo",
    language: "luo",
    ring: "from-amber-400 via-orange-500 to-rose-500",
    overlay: "from-amber-950/90 via-orange-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(249,115,22,0.45)]",
  },
  {
    label: "LUGANDA MOVIES",
    to: "/luganda",
    language: "luganda",
    ring: "from-emerald-400 via-teal-500 to-cyan-500",
    overlay: "from-emerald-950/90 via-teal-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(20,184,166,0.45)]",
  },
  {
    label: "VJ SENIOR PAUL",
    to: "/luo",
    language: "luo",
    vj: "paul",
    ring: "from-fuchsia-400 via-purple-500 to-indigo-500",
    overlay: "from-purple-950/90 via-fuchsia-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(168,85,247,0.45)]",
  },
  {
    label: "VJ JUNIOR",
    to: "/luganda",
    language: "luganda",
    vj: "junior",
    ring: "from-sky-400 via-blue-500 to-violet-500",
    overlay: "from-blue-950/90 via-sky-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(59,130,246,0.45)]",
  },
];

/**
 * Poster-backed shortcut rail: Luo / Luganda libraries and their VJs.
 * Backgrounds are pulled live from each language's own library page.
 */
export function VjRail() {
  const luo = useQuery({
    queryKey: ["luo-titles", "luo"],
    queryFn: () => listLuoTitles("luo"),
    staleTime: 5 * 60 * 1000,
  });
  const luganda = useQuery({
    queryKey: ["luo-titles", "luganda"],
    queryFn: () => listLuoTitles("luganda"),
    staleTime: 5 * 60 * 1000,
  });

  const pick = (tile: Tile, index: number) => {
    const rows = (tile.language === "luo" ? luo.data : luganda.data) ?? [];
    const withArt = rows.filter((t) => t.poster_url || t.backdrop_url);
    const matched = tile.vj
      ? withArt.filter((t) => (t.vj ?? "").toLowerCase().includes(tile.vj!))
      : [];
    const pool = matched.length ? matched : withArt;
    const row = pool[index % Math.max(pool.length, 1)];
    return row?.backdrop_url ?? row?.poster_url ?? null;
  };

  return (
    <nav
      aria-label="Browse translated movies"
      className="scrollbar-none flex gap-2 overflow-x-auto px-0.5 pb-1 pt-1.5 pr-3 sm:gap-3"
    >
      {TILES.map((tile, i) => {
        const art = pick(tile, i);
        return (
          <div
            key={tile.label}
            className={`shrink-0 rounded-[14px] bg-gradient-to-br p-[1.5px] transition-shadow duration-300 sm:rounded-[18px] ${tile.ring} ${tile.glow}`}
          >
            <Link
              to={tile.to}
              className="group relative block h-[64px] w-[132px] overflow-hidden rounded-[12.5px] sm:h-[88px] sm:w-[196px] sm:rounded-[16.5px]"
            >
              {art ? (
                <img
                  src={art}
                  alt=""
                  loading="eager"
                  decoding="async"
                  className="absolute inset-0 size-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="absolute inset-0 bg-card" />
              )}
              <div className={`absolute inset-0 bg-gradient-to-r ${tile.overlay}`} />
              <span className="absolute inset-0 flex items-center px-3 text-[11px] font-black uppercase leading-tight tracking-wide text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:px-4 sm:text-[15px]">
                {tile.label}
              </span>
            </Link>
          </div>
        );
      })}
    </nav>
  );
}
