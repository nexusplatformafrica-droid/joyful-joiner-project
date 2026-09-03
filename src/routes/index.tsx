import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQueries, useQuery } from "@tanstack/react-query";
import { Play } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { Rail } from "@/components/youku/Rail";
import { RowSkeleton } from "@/components/youku/Skeletons";
import { VjRail } from "@/components/youku/VjRail";
import { isAdultItem } from "@/lib/categories";
import { getHome } from "@/lib/catalog.functions";
import { HOME_SECTIONS, fetchSection } from "@/lib/home-sections";

const homeQuery = queryOptions({
  queryKey: ["home"],
  queryFn: () => getHome(),
  // Keep the front page live: the catalog's trending / coming-soon rails move
  // every few minutes, so refresh in the background rather than caching for long.
  staleTime: 30 * 1000,
  refetchInterval: 2 * 60 * 1000,
  refetchIntervalInBackground: true,
  refetchOnWindowFocus: true,
  refetchOnMount: "always",
});





export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title:
          "LUOFILM.SITE — Watch and Download Free Movies, Series, Animations, Episodes with Multiple Subtitles, Luo Translated Movies and Lugandan Translated Movies",
      },
      {
        name: "description",
        content:
          "LUOFILM.SITE — watch and download free movies, series, animations and episodes with multiple subtitles, plus Luo translated movies and Lugandan translated movies in HD.",
      },
      {
        property: "og:title",
        content:
          "LUOFILM.SITE — Watch and Download Free Movies, Series, Animations, Episodes with Multiple Subtitles, Luo & Lugandan Translated Movies",
      },
      {
        property: "og:description",
        content:
          "Free movies, series, animations and episodes with multiple subtitles, plus Luo and Lugandan translated movies — watch or download in HD.",
      },
      { property: "og:url", content: "/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  // No blocking loader: the shell + skeletons render instantly and the catalog
  // fills in from the browser — this keeps first paint fast on every host.
  component: HomePage,
});

function HomePage() {
  const { data, refetch } = useQuery(homeQuery);
  const slides = data?.hero ?? [];
  const [index, setIndex] = useState(0);

  // If a response came back empty (upstream unreachable), retry so the page
  // still fills in.
  const degraded =
    !!data && ((data as { degraded?: boolean }).degraded === true || slides.length === 0);
  useEffect(() => {
    if (!degraded) return;
    const t = setTimeout(() => void refetch(), 300);
    return () => clearTimeout(t);
  }, [degraded, refetch]);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [slides.length]);


  const slide = slides[Math.min(index, Math.max(slides.length - 1, 0))];
  // Row titles arrive with emoji from upstream; strip them for a clean typographic look.
  const cleanTitle = (t: string) =>
    t.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "").trim();
  const clean = <T extends { title: string; genre?: string | null }>(items: T[]) =>
    items.filter((i) => !isAdultItem(i));
  // Curated sections (Popular Series, Most trending, K-Drama, …) filled live.
  const sectionQueries = useQueries({
    queries: HOME_SECTIONS.map((section) =>
      queryOptions({
        queryKey: ["home-section", section.title],
        queryFn: () => fetchSection(section),
        // Every rail refreshes itself from the live catalog instead of serving
        // whatever was cached the first time the page opened.
        staleTime: 30 * 1000,
        refetchInterval: 3 * 60 * 1000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        refetchOnMount: "always",
      }),
    ),
  });


  const sections = HOME_SECTIONS.map((section, i) => ({
    ...section,
    items: clean(sectionQueries[i]?.data ?? []),
  })).filter((s) => s.items.length >= 4);

  // Real trending straight from the catalog's own trending rail.
  const upstreamTrending = clean(data?.trending ?? []);
  const rankedSection = sections.find((s) => s.ranked);
  const trending = upstreamTrending.length >= 4 ? upstreamTrending : (rankedSection?.items ?? []);
  const comingSoon = clean(data?.comingSoon ?? []);
  const rails = sections.filter((s) => !s.ranked || s.items !== trending);
  // Any extra upstream rows we don't already cover.
  const extraRows = (data?.rows ?? [])
    .slice(1)
    .filter(
      (r) =>
        !/trending|coming soon/i.test(r.title) &&
        !HOME_SECTIONS.some((s) => cleanTitle(r.title).toLowerCase() === s.title.toLowerCase()),
    );


  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative">
          <TopBar />

          {!data && <div className="relative h-[210px] w-full animate-pulse bg-muted/40 sm:h-[360px] lg:h-[540px]" />}

          {!!data && !slide && <div className="h-16" />}

          {slide && (
            <section className="relative h-[210px] w-full overflow-hidden sm:h-[360px] lg:h-[540px]">
              {slide.backdrop ? (
                <img
                  key={slide.backdrop}
                  src={slide.backdrop}
                  alt={slide.title}
                  loading="eager"
                  fetchPriority="high"
                  decoding="async"
                  className="size-full animate-in fade-in object-cover object-[center_18%] duration-700 lg:object-[center_12%]"
                />
              ) : (
                <div className="size-full bg-card" />
              )}

              {/* Bottom fade so the carousel melts behind the Trending rail instead of cutting off. */}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-background via-background/75 to-transparent sm:h-40 lg:h-64" />

              <div className="absolute bottom-0 left-0 top-10 z-20 flex max-w-xl flex-col justify-end gap-1.5 px-3 pb-16 sm:top-28 sm:pb-28 lg:top-16 lg:justify-end lg:gap-3 lg:px-8 lg:pb-28">
                <h1 className="text-base font-black tracking-wide text-foreground drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] sm:text-lg lg:text-2xl">
                  {slide.title}
                </h1>
                <Link
                  to="/watch/$id"
                  params={{ id: slide.id }}
                  className="mt-1 flex w-[120px] items-center justify-center gap-2 rounded bg-foreground/20 py-2.5 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-foreground/30"
                >
                  <Play className="size-4 fill-current" />
                  Play
                </Link>
                <p className="max-w-md truncate text-[11px] text-foreground/85 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  {[slide.year, slide.genre, slide.rating ? `IMDb ${slide.rating}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>

              {slides.length > 1 && (
                <div className="absolute bottom-3 right-4 z-20 flex gap-2 sm:bottom-20 lg:bottom-32 lg:right-8">
                  {slides.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      aria-label={`Show slide ${i + 1}`}
                      onClick={() => setIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${
                        i === index ? "w-6 bg-brand" : "w-2 bg-foreground/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          <div className="relative z-20 -mt-4 mb-3 pl-3 sm:pl-4 lg:pl-8">
            <VjRail />
          </div>

          {!!trending.length && (
            <div className="relative z-10 pl-3 sm:pl-4 lg:pl-8">
              <Rail title="Trending now" items={trending} ranked />
            </div>
          )}

        </div>

        <main className="pb-28 pl-3 sm:pl-4 lg:pb-16 lg:pl-8">
          {!data && (
            <>
              <RowSkeleton />
              <RowSkeleton />
              <RowSkeleton />
            </>
          )}
          {rails.map((row) => (
            <div key={row.title}>
              <Rail title={row.title} items={row.items} {...(row.ranked ? { ranked: true } : {})} />
              {row.title === "Gangster" && !!comingSoon.length && (
                <Rail title="Coming Soon" items={comingSoon} />
              )}
            </div>
          ))}
          {!rails.some((r) => r.title === "Gangster") && !!comingSoon.length && (
            <Rail title="Coming Soon" items={comingSoon} />
          )}
          {extraRows.map((row) => (
            <Rail key={row.title} title={cleanTitle(row.title)} items={clean(row.items)} />
          ))}
        </main>

      </div>
      <MobileNav />
    </div>
  );
}
