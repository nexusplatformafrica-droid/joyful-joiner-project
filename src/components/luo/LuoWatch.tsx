import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { Player } from "@/components/youku/Player";
import { getLuoTitle, listEpisodes, listLuoTitles, type LuoLanguage } from "@/lib/luo";
import { SubscribeGate } from "@/components/youku/SubscribeGate";
import { useSubscription } from "@/hooks/useSubscription";
import { TitleActions } from "@/components/youku/TitleActions";
import { vjInfo } from "@/lib/vj";

import { WatchSkeleton } from "@/components/youku/Skeletons";

export function LuoWatch({ id, language }: { id: string; language: LuoLanguage }) {
  const title = useQuery({ queryKey: ["luo-title", id], queryFn: () => getLuoTitle(id) });
  const isSeries = title.data?.kind === "series";
  const episodes = useQuery({
    queryKey: ["luo-episodes", id],
    queryFn: () => listEpisodes(id),
    enabled: !!isSeries,
  });
  const siblings = useQuery({
    queryKey: ["luo-library", language],
    queryFn: () => listLuoTitles(language),
    staleTime: 5 * 60 * 1000,
  });

  const [episodeId, setEpisodeId] = useState<string | null>(null);
  const [season, setSeason] = useState<number | null>(null);
  const [theater, setTheater] = useState(false);
  const { canPlay } = useSubscription();

  const eps = episodes.data ?? [];
  const seasons = useMemo(
    () => Array.from(new Set(eps.map((e) => e.season))).sort((a, b) => a - b),
    [eps],
  );

  useEffect(() => {
    if (season == null && seasons.length) setSeason(seasons[0]!);
  }, [season, seasons]);

  const seasonEps = useMemo(
    () => eps.filter((e) => (season == null ? true : e.season === season)).sort((a, b) => a.episode - b.episode),
    [eps, season],
  );

  const current = useMemo(
    () => seasonEps.find((e) => e.id === episodeId) ?? seasonEps[0] ?? null,
    [seasonEps, episodeId],
  );

  const data = title.data;
  const rawSrc = isSeries ? (current?.video_url ?? "") : (data?.video_url ?? "");

  const related = useMemo(
    () =>
      (() => {
        const all = (siblings.data ?? []).filter((t) => t.id !== id);
        const g = (data?.genre ?? "").toLowerCase();
        const sameGenre = g
          ? all.filter((t) => (t.genre ?? "").toLowerCase() === g && t.kind === data?.kind)
          : [];
        const sameKind = all.filter((t) => t.kind === data?.kind && !sameGenre.includes(t));
        const pool = [...sameGenre, ...sameKind, ...all.filter((t) => t.kind !== data?.kind)];
        // Stable per-title rotation so each page shows a different mix.
        let seed = 0;
        for (const ch of id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
        const offset = pool.length > 18 ? seed % pool.length : 0;
        return [...pool.slice(offset), ...pool.slice(0, offset)];
      })()
        .slice(0, 18)
        .map((t) => ({
          id: t.id,
          title: t.title,
          poster: t.poster_url ?? "",
          type: (t.kind === "series" ? "series" : "movie") as "series" | "movie",
          year: t.year ? String(t.year) : null,
          genre: t.genre,
          rating: null,
          vj: t.vj ?? null,
        })),
    [siblings.data, id, data?.genre, data?.kind],
  );

  const nextEpisode = () => {
    if (!current) return;
    const i = seasonEps.findIndex((e) => e.id === current.id);
    const next = seasonEps[i + 1];
    if (next) setEpisodeId(next.id);
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <Link
            to={language === "luo" ? "/luo" : "/luganda"}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Back to {language === "luo" ? "Luo" : "Luganda"}
          </Link>

          {title.isLoading ? (
            <div className="mt-4">
              <WatchSkeleton />
            </div>
          ) : !data ? (
            <p className="mt-10 text-sm text-muted-foreground">This title is not available.</p>
          ) : (
            <div className={`mt-3 flex flex-col gap-6 ${theater ? "" : "lg:flex-row"}`}>
              <div className="min-w-0 flex-1">
                {rawSrc ? (
                  <div className="relative overflow-hidden rounded-[1.25rem] bg-black">
                    {!canPlay && <SubscribeGate title={data.title} />}
                    <Player
                      src={canPlay ? rawSrc : ""}
                      poster={data.backdrop_url ?? data.poster_url ?? undefined}
                      title={data.title}
                      theater={theater}
                      onTheater={() => setTheater((v) => !v)}
                      {...(isSeries ? { onNext: nextEpisode } : {})}
                    />
                  </div>
                ) : (
                  <div className="grid aspect-video w-full place-items-center rounded-[1.25rem] bg-card px-6 text-center text-sm text-muted-foreground">
                    No video link added for this title yet.
                  </div>
                )}

                <h1 className="mt-4 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                  {data.title}
                  {isSeries && current ? ` · S${current.season} E${current.episode}` : ""}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/15 px-2 py-0.5 font-semibold text-brand">
                    <ShieldCheck className="size-3" /> Uploaded by admin
                  </span>
                  <span className="flex items-center gap-1 text-foreground">
                    <Star className="size-3.5 fill-current text-vip" />
                    {language === "luo" ? "Luo" : "Luganda"}
                  </span>
                  {[data.vj ? `VJ ${data.vj}` : null, data.year, data.genre]
                    .filter(Boolean)
                    .map((bit) => (
                      <span key={String(bit)}>· {bit}</span>
                    ))}
                </div>

                <TitleActions
                  titleId={id}
                  titleName={data.title}
                  description={data.description}
                  cast={[]}
                  sources={
                    rawSrc
                      ? [
                          {
                            id: current?.id ?? id,
                            url: rawSrc,
                            resolution: 720,
                            codec: null,
                            size: null,
                            captions: [],
                          },
                        ]
                      : []
                  }
                  downloadName={
                    isSeries && current
                      ? `${data.title} S${current.season}E${current.episode}`
                      : data.title
                  }
                  shareImage={data.poster_url ?? data.backdrop_url}
                  blobDownload
                />

                {!!related.length && (
                  <section className="mt-8 hidden lg:block">
                    <h2 className="mb-3 text-lg font-bold text-foreground">You may also like</h2>
                    <RelatedGrid items={related} language={language} />
                  </section>
                )}
              </div>

              {isSeries && eps.length > 0 && (
                <aside className="w-full shrink-0 lg:w-[320px]">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                    Episodes
                  </h2>
                  {seasons.length > 1 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {seasons.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setSeason(s);
                            setEpisodeId(null);
                          }}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                            s === season
                              ? "bg-brand text-brand-foreground ring-brand"
                              : "bg-card text-muted-foreground ring-border hover:text-foreground"
                          }`}
                        >
                          Season {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                    {seasonEps.map((e) => {
                      const active = current?.id === e.id;
                      return (
                        <button
                          key={e.id}
                          type="button"
                          title={e.name ?? `Episode ${e.episode}`}
                          onClick={() => setEpisodeId(e.id)}
                          className={`h-9 rounded text-xs font-semibold ring-1 transition ${
                            active
                              ? "bg-brand text-brand-foreground ring-brand"
                              : "bg-card text-muted-foreground ring-border hover:text-foreground"
                          }`}
                        >
                          {e.episode}
                        </button>
                      );
                    })}
                  </div>
                </aside>
              )}

              {/* Mobile order: player → actions → episodes → you may also like */}
              {!!related.length && (
                <section className="lg:hidden">
                  <h2 className="mb-3 text-lg font-bold text-foreground">You may also like</h2>
                  <RelatedGrid items={related} language={language} />
                </section>
              )}
            </div>
          )}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}

type RelatedItem = {
  id: string;
  title: string;
  poster: string;
  type: "series" | "movie";
  year: string | null;
  genre: string | null;
  vj?: string | null;
};

/** Grid of related posters, reused for the mobile and desktop placements. */
function RelatedGrid({ items, language }: { items: RelatedItem[]; language: LuoLanguage }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5 md:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <Link
          key={item.id}
          to={language === "luo" ? "/luo/$id" : "/luganda/$id"}
          params={{ id: item.id }}
          className="block"
        >
          <MediaCardShell
            poster={item.poster}
            label={item.title}
            badge={item.type === "series" ? "Series" : "Movie"}
            vj={item.vj ?? null}
            meta={[item.year, item.genre].filter(Boolean).join(" · ")}
          />
        </Link>
      ))}
    </div>
  );
}

/** Poster tile that matches the catalogue cards but links inside the Luo pages. */
function MediaCardShell({
  poster,
  label,
  badge,
  meta,
  vj,
}: {
  poster: string;
  label: string;
  badge: string;
  meta: string;
  vj?: string | null;
}) {
  const tag = vjInfo(vj);
  return (
    <div className="group">
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform duration-200 group-hover:-translate-y-1 group-hover:ring-brand">
        {poster ? (
          <img src={poster} alt={label} loading="lazy" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center px-2 text-center text-sm text-muted-foreground">
            {label}
          </div>
        )}
        {tag && (
          <span
            className={`absolute left-0 top-0 max-w-[86%] truncate rounded-br-lg bg-gradient-to-r px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.7)] sm:text-[10px] ${tag.gradient}`}
          >
            {tag.name}
          </span>
        )}
        <span
          className={`absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight ${
            badge === "Series" ? "badge-hot" : "badge-vip"
          }`}
        >
          {badge}
        </span>
      </div>
      <p className="mt-2 truncate text-[13px] text-muted-foreground transition-colors group-hover:text-foreground">
        {label}
      </p>
      {meta && <p className="truncate text-[11px] text-muted-foreground/70">{meta}</p>}
    </div>
  );
}
