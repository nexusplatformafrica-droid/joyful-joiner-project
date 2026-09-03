import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Star } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { Player } from "@/components/youku/Player";
import { Rail } from "@/components/youku/Rail";
import { getPlayback, getRelated, getSources, getTitle } from "@/lib/catalog.functions";
import { signedDashBlobUrl } from "@/lib/dash";
import { streamUrl, subtitleUrl } from "@/lib/download";
import { TitleActions } from "@/components/youku/TitleActions";
import { SubscribeGate } from "@/components/youku/SubscribeGate";
import { useSubscription } from "@/hooks/useSubscription";

const titleQuery = (id: string) =>
  queryOptions({
    queryKey: ["title", id],
    queryFn: () => getTitle({ data: { id } }),
    staleTime: 5 * 60 * 1000,
  });

const SITE_URL = "https://luofilm.site";
type ShareSearch = { shareTitle?: string; shareDescription?: string; shareImage?: string };

function shareSearch(search: Record<string, unknown>): ShareSearch {
  const text = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : undefined;
  const result: ShareSearch = {};
  const title = text(search['shareTitle']);
  const description = text(search['shareDescription']);
  const image = text(search['shareImage']);
  if (title) result.shareTitle = title;
  if (description) result.shareDescription = description;
  if (image) result.shareImage = image;
  return result;
}

export const Route = createFileRoute("/watch/$id")({
  validateSearch: shareSearch,
  loaderDeps: ({ search }) => search,
  // Bound SSR waiting time — if the catalog is slow, ship the shell fast and
  // let the browser finish loading instead of hanging the first byte.
  loader: ({ context, params, deps }) => {
    if (deps.shareTitle) {
      return {
        title: deps.shareTitle,
        description: deps.shareDescription ?? null,
        backdrop: deps.shareImage?.startsWith("https://") ? deps.shareImage : null,
      };
    }
    return Promise.race([
      context.queryClient.ensureQueryData(titleQuery(params.id)).catch(() => undefined),
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), 8000)),
    ]);
  },

  head: ({ params, loaderData }) => {
    if (!loaderData) {
      // Loader skipped (slow upstream) — generic tags; the real tags are
      // applied client-side once the title loads.
      return {
        meta: [
          { title: "Watch — LUOFILM" },
          { name: "description", content: "Stream movies and series instantly on LUOFILM." },
        ],
      };
    }
    if ((loaderData as { unavailable?: boolean }).unavailable) {
      return { meta: [{ title: "Unavailable — LUOFILM" }, { name: "robots", content: "noindex" }] };
    }
    const description =
      loaderData.description?.slice(0, 155) ?? `Stream ${loaderData.title} on LUOFILM.`;
    const meta: { title?: string; name?: string; property?: string; content?: string }[] = [
      { title: `Watch ${loaderData.title} — LUOFILM` },
      { name: "description", content: description },
      { property: "og:title", content: `Watch ${loaderData.title} — LUOFILM` },
      { property: "og:description", content: description },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ];
    if (loaderData.backdrop?.startsWith("https://")) {
      meta.push({ property: "og:image", content: loaderData.backdrop });
      meta.push({ name: "twitter:image", content: loaderData.backdrop });
    }
    meta.push({ property: "og:url", content: `${SITE_URL}/watch/${params.id}` });
    return { meta, links: [{ rel: "canonical", href: `${SITE_URL}/watch/${params.id}` }] };
  },
  component: WatchPage,
});

function WatchPage() {
  const { id } = Route.useParams();
  const { data: title, refetch: refetchTitle } = useQuery(titleQuery(id));

  // Placeholder returned when the host couldn't reach the catalog — retry client-side.
  const unavailable = !!title && (title as { unavailable?: boolean }).unavailable === true;
  useEffect(() => {
    if (!unavailable) return;
    const t = setTimeout(() => void refetchTitle(), 300);
    return () => clearTimeout(t);
  }, [unavailable, refetchTitle]);

  const ready = !!title && !unavailable;

  const [season, setSeason] = useState(0);
  const [episode, setEpisode] = useState(0);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [playbackResolution, setPlaybackResolution] = useState<number | null>(null);
  const failedDirectSources = useRef(new Set<string>());
  const [theater, setTheater] = useState(false);
  const { canPlay } = useSubscription();

  // Initialise season/episode once the real title arrives.
  useEffect(() => {
    if (!ready || !title) return;
    setSeason(title.seasons[0]?.season ?? 0);
    setEpisode(title.seasons[0] ? 1 : 0);
    setSourceIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, id]);

  const sources = useQuery({
    queryKey: ["sources", id, season, episode],
    queryFn: () => getSources({ data: { id, season, episode } }),
    staleTime: 60 * 1000,
    retry: 2,
    enabled: ready,
  });

  const related = useQuery({
    queryKey: ["related", id],
    queryFn: () =>
      getRelated({
        data: {
          id,
          title: title?.title ?? "",
          genre: title?.genre ?? null,
          type: title?.type ?? "movie",
        },
      }),
    staleTime: 5 * 60 * 1000,
    enabled: ready,
  });


  useEffect(() => {
    const list = sources.data ?? [];
    if (!list.length) return;
    failedDirectSources.current.clear();
    // Start on the closest thing to 720p for a fast, reliable first play.
    let best = 0;
    list.forEach((source, index) => {
      if (Math.abs(source.resolution - 720) < Math.abs((list[best]?.resolution ?? 0) - 720)) {
        best = index;
      }
    });
    setSourceIndex(best);
  }, [sources.data]);

  const tryAnotherDirectSource = useCallback(() => {
    const list = sources.data ?? [];
    const current = list[sourceIndex];
    if (current) failedDirectSources.current.add(current.id);
    const next = list.findIndex((source) => !failedDirectSources.current.has(source.id));
    if (next < 0) return false;
    setSourceIndex(next);
    return true;
  }, [sourceIndex, sources.data]);


  const active = sources.data?.[sourceIndex];

  // The provider's `resourceLink` is a short promo clip for most titles; the
  // real movie is a signed DASH stream served straight from its CDN.
  const playback = useQuery({
    queryKey: ["playback", id, season, episode, active?.id],
    queryFn: () => getPlayback({ data: { id, season, episode, resourceId: active?.id } }),
    staleTime: 60 * 1000,
    enabled: ready && !!active,
  });

  useEffect(() => {
    const available = playback.data?.resolutions ?? [];
    if (!available.length) return;
    setPlaybackResolution(
      available.reduce((closest, resolution) =>
        Math.abs(resolution - 720) < Math.abs(closest - 720) ? resolution : closest,
      available[0] ?? 720),
    );
  }, [playback.data?.manifest, playback.data?.resolutions]);

  const [dashSrc, setDashSrc] = useState<string | null>(null);
  useEffect(() => {
    const manifest = playback.data?.manifest;
    setDashSrc(null);
    if (!manifest || typeof window === "undefined") return;
    let created: string | null = null;
    let cancelled = false;
    signedDashBlobUrl(manifest)
      .then((prepared) => {
        if (cancelled) {
          URL.revokeObjectURL(prepared.url);
          return;
        }
        created = prepared.url;
        setDashSrc(prepared.url);
      })
      .catch(() => setDashSrc(null));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [playback.data?.manifest]);

  const episodeCount = useMemo(
    () => title?.seasons.find((s) => s.season === season)?.episodes ?? 0,
    [title?.seasons, season],
  );

  const subtitles = (active?.captions ?? []).map((c) => ({
    label: c.label,
    src: subtitleUrl(c.url),
  }));

  if (!title) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-[1200px] space-y-4 p-4">
          <div className="aspect-video w-full animate-pulse rounded-2xl bg-muted" />
          <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
          <div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>

        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <Link
            to="/"
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Back home
          </Link>

          <div className={`mt-3 flex flex-col gap-6 ${theater ? "" : "lg:flex-row"}`}>
            <div className="min-w-0 flex-1">
              {sources.isPending ? (
                <div className="aspect-video w-full animate-pulse rounded-[1.25rem] bg-muted" />
              ) : active ? (
                <div className="relative overflow-hidden border border-border bg-black">
                  {!canPlay && <SubscribeGate title={title.title} />}
                  <Player
                  src={canPlay ? (dashSrc ?? streamUrl(active.url)) : ""}
                  kind={dashSrc ? "dash" : undefined}
                  poster={title.backdrop ?? undefined}
                  title={title.title}
                  subtitles={subtitles}
                  fileQualities={(playback.data?.resolutions?.length
                    ? playback.data.resolutions.map((resolution) => ({
                        id: `dash-${resolution}`,
                        label: `${resolution}p`,
                        resolution,
                        note: playback.data?.codec?.toUpperCase() ?? null,
                      }))
                    : (sources.data ?? []).map((source) => ({
                        id: source.id,
                        label: source.resolution ? `${source.resolution}p` : "Auto",
                        resolution: source.resolution,
                        note: source.size,
                      }))
                  ).sort((a, b) => b.resolution - a.resolution)}
                  activeQuality={playbackResolution ? `dash-${playbackResolution}` : active.id}
                  onQualityChange={(id) => {
                    if (id.startsWith("dash-")) {
                      setPlaybackResolution(Number(id.slice(5)));
                      return;
                    }
                    const index = (sources.data ?? []).findIndex((s) => s.id === id);
                    if (index >= 0) setSourceIndex(index);
                  }}
                    onDirectError={tryAnotherDirectSource}
                    theater={theater}
                    onTheater={() => setTheater((v) => !v)}
                  />
                </div>
              ) : (
                <div className="grid aspect-video w-full place-items-center rounded-[1.25rem] bg-card px-6 text-center text-sm text-muted-foreground">
                  No playable stream is available for this title right now.
                </div>
              )}

              <h1 className="mt-4 text-xl font-black tracking-tight text-foreground sm:text-2xl">
                {title.title}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-muted-foreground">
                {title.rating && (
                  <span className="flex items-center gap-1 text-foreground">
                    <Star className="size-3.5 fill-current text-vip" />
                    {title.rating}
                  </span>
                )}
                {[title.year, title.genre, title.duration, title.country, title.language]
                  .filter(Boolean)
                  .map((bit) => (
                    <span key={String(bit)}>· {bit}</span>
                  ))}
              </div>

              <TitleActions
                titleId={id}
                titleName={title.title}
                description={title.description}
                cast={title.cast}
                sources={sources.data ?? []}
                downloadName={
                  season > 0 ? `${title.title} S${season}E${episode}` : title.title
                }
                shareImage={title.backdrop}
                catalogId={id}
                season={season}
                episode={episode}
              />



              {!!related.data?.length && (
                <div className="hidden lg:block">
                  <Rail
                    title="You may also like"
                    items={related.data.filter((item) => item.id !== id).slice(0, 18)}
                  />
                </div>
              )}
            </div>

            {!!title.seasons.length && (
              <aside className="w-full shrink-0 lg:w-[320px]">
                <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
                  Episodes
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {title.seasons.map((s) => (
                    <button
                      key={s.season}
                      onClick={() => {
                        setSeason(s.season);
                        setEpisode(1);
                      }}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition ${
                        s.season === season
                          ? "bg-brand text-brand-foreground ring-brand"
                          : "bg-card text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      Season {s.season}
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
                  {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => (
                    <button
                      key={ep}
                      onClick={() => setEpisode(ep)}
                      className={`h-9 rounded text-xs font-semibold ring-1 transition ${
                        ep === episode
                          ? "bg-brand text-brand-foreground ring-brand"
                          : "bg-card text-muted-foreground ring-border hover:text-foreground"
                      }`}
                    >
                      {ep}
                    </button>
                  ))}
                </div>
              </aside>
            )}

            {/* On mobile the related rail sits under the episodes, not above them. */}
            {!!related.data?.length && (
              <div className="w-full lg:hidden">
                <Rail
                  title="You may also like"
                  items={related.data.filter((item) => item.id !== id).slice(0, 18)}
                />
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
