import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLuoTitles, type LuoLanguage, type LuoTitle } from "@/lib/luo";
import { availableVjs, matchesVj } from "@/lib/vj";

type Tile = {
  label: string;
  to: "/luo" | "/luganda";
  language: LuoLanguage;
  /** Canonical VJ key ("" for a whole library). */
  vjKey: string;
  ring: string;
  overlay: string;
  glow: string;
};

const LIBRARIES: Tile[] = [
  {
    label: "LUO MOVIES",
    to: "/luo",
    language: "luo",
    vjKey: "",
    ring: "from-amber-400 via-orange-500 to-rose-500",
    overlay: "from-amber-950/90 via-orange-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(249,115,22,0.45)]",
  },
  {
    label: "LUGANDA MOVIES",
    to: "/luganda",
    language: "luganda",
    vjKey: "",
    ring: "from-emerald-400 via-teal-500 to-cyan-500",
    overlay: "from-emerald-950/90 via-teal-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(20,184,166,0.45)]",
  },
];

/**
 * Poster-backed shortcut rail: the Luo / Luganda libraries plus every VJ that
 * actually has titles online. Tapping a VJ opens that library filtered to them.
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

  const rows = (lang: LuoLanguage) => (lang === "luo" ? luo.data : luganda.data) ?? [];

  const vjTiles: Tile[] = (["luo", "luganda"] as LuoLanguage[]).flatMap((language) =>
    availableVjs(rows(language)).map((v) => ({
      label: v.name.toUpperCase(),
      to: (language === "luo" ? "/luo" : "/luganda") as Tile["to"],
      language,
      vjKey: v.key,
      ring: v.gradient,
      overlay: v.overlay,
      glow: v.glow,
    })),
  );

  const tiles = [...LIBRARIES, ...vjTiles];

  const pick = (tile: Tile, index: number) => {
    const pool = rows(tile.language).filter(
      (t: LuoTitle) => (t.poster_url || t.backdrop_url) && matchesVj(t.vj, tile.vjKey),
    );
    const row = pool[index % Math.max(pool.length, 1)];
    return row?.backdrop_url ?? row?.poster_url ?? null;
  };

  return (
    <nav
      aria-label="Browse translated movies"
      className="scrollbar-none flex gap-2 overflow-x-auto px-0.5 pb-1 pt-1.5 pr-3 sm:gap-3"
    >
      {tiles.map((tile, i) => {
        const art = pick(tile, i);
        return (
          <div
            key={`${tile.to}-${tile.vjKey || "all"}`}
            className={`shrink-0 rounded-[14px] bg-gradient-to-br p-[1.5px] transition-shadow duration-300 sm:rounded-[18px] ${tile.ring} ${tile.glow}`}
          >
            <Link
              to={tile.to}
              search={{ vj: tile.vjKey }}
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
