import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listLuoTitles, type LuoLanguage } from "@/lib/luo";

type Tile = {
  label: string;
  to: "/luo" | "/luganda";
  language: LuoLanguage;
  /** Prefer a poster whose VJ field matches this needle, when present. */
  vj?: string;
};

const TILES: Tile[] = [
  { label: "LUO MOVIES", to: "/luo", language: "luo" },
  { label: "LUGANDA MOVIES", to: "/luganda", language: "luganda" },
  { label: "VJ SENIOR PAUL", to: "/luo", language: "luo", vj: "paul" },
  { label: "VJ JUNIOR", to: "/luganda", language: "luganda", vj: "junior" },
];

/**
 * Poster-backed shortcut rail: Luo / Luganda libraries and their VJs.
 * Backgrounds are pulled live from each language's own library page.
 */
export function VjRail() {
  const luo = useQuery({
    queryKey: ["luo-library", "luo"],
    queryFn: () => listLuoTitles("luo"),
    staleTime: 5 * 60 * 1000,
  });
  const luganda = useQuery({
    queryKey: ["luo-library", "luganda"],
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
    <nav aria-label="Browse translated movies" className="scrollbar-none -mx-0 flex gap-2 overflow-x-auto pb-1 pr-3 sm:gap-3">
      {TILES.map((tile, i) => {
        const art = pick(tile, i);
        return (
          <Link
            key={tile.label}
            to={tile.to}
            className="group relative h-[62px] w-[128px] shrink-0 overflow-hidden rounded-xl ring-1 ring-border transition-transform duration-200 hover:-translate-y-0.5 hover:ring-brand sm:h-[84px] sm:w-[190px] sm:rounded-2xl"
          >
            {art ? (
              <img
                src={art}
                alt=""
                loading="eager"
                decoding="async"
                className="absolute inset-0 size-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-card" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/60 to-background/10" />
            <span className="absolute inset-0 flex items-center px-3 text-[11px] font-black uppercase leading-tight tracking-wide text-foreground drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:px-4 sm:text-[15px]">
              {tile.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
