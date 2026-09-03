import { createFileRoute, notFound } from "@tanstack/react-router";
import { infiniteQueryOptions, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { MediaCard } from "@/components/youku/MediaCard";
import { GridSkeleton } from "@/components/youku/Skeletons";
import { searchTitles } from "@/lib/catalog.functions";
import { findCategory, isAdultItem, type SiteCategory } from "@/lib/categories";

const categoryQuery = (category: SiteCategory) => {
  const keywords = category.keywords?.length ? category.keywords : [category.keyword];
  return infiniteQueryOptions({
    queryKey: ["category", keywords],
    queryFn: async ({ pageParam }) => {
      const pages = await Promise.all(
        keywords.map((q) => searchTitles({ data: { q, page: pageParam } })),
      );
      // Interleave so every keyword contributes to each visible chunk.
      const merged: (typeof pages)[number] = [];
      const max = Math.max(...pages.map((p) => p.length), 0);
      for (let i = 0; i < max; i++) {
        for (const page of pages) if (page[i]) merged.push(page[i]!);
      }
      return merged;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => (lastPage.length ? allPages.length + 1 : undefined),
    staleTime: 5 * 60 * 1000,
  });
};


export const Route = createFileRoute("/category/$slug")({
  beforeLoad: ({ params }) => {
    if (!findCategory(params.slug) || params.slug === "home") throw notFound();
  },
  head: ({ params }) => {
    const category = findCategory(params.slug);
    const label = category?.label ?? "Browse";
    const description = `Stream ${label.toLowerCase()} on LUOFILM — HD movies and series with subtitles, playable right in your browser.`;
    return {
      meta: [
        { title: `${label} — LUOFILM` },
        { name: "description", content: description },
        { property: "og:title", content: `${label} — LUOFILM` },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: CategoryPage,
});

const AGE_KEY = "luofilm:age-verified";

function AgeGate({ onConfirm }: { onConfirm: () => void }) {
  return (
    <div className="card-soft mx-auto mt-10 max-w-lg p-8 text-center">
      <h2 className="text-lg font-black text-foreground">Adults only — 18+</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        This section contains mature content and is separated from the rest of the site so it is
        never shown to children. Confirm you are 18 or older to continue.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <button
          onClick={onConfirm}
          className="rounded-full bg-brand px-5 py-2 text-sm font-bold text-brand-foreground"
        >
          I am 18 or older
        </button>
        <a
          href="/"
          className="rounded-full bg-card px-5 py-2 text-sm font-bold text-muted-foreground ring-1 ring-border"
        >
          Take me back
        </a>
      </div>
    </div>
  );
}

function CategoryPage() {
  const { slug } = Route.useParams();
  const category = findCategory(slug)!;
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    setVerified(localStorage.getItem(AGE_KEY) === "1");
  }, []);
  const locked = !!category.adult && !verified;
  const results = useInfiniteQuery({
    ...categoryQuery(category),
    enabled: !category.adult || verified,
  });
  const sentinel = useRef<HTMLDivElement>(null);

  const seen = new Set<string>();
  const items = (results.data?.pages.flat() ?? [])
    .filter((item) => (category.type ? item.type === category.type : true))
    // Adult sections keep only mature titles; every other section excludes them.
    .filter((item) => (category.adult ? isAdultItem(item) : !isAdultItem(item)))
    .filter((item) => (seen.has(item.id) ? false : (seen.add(item.id), true)));

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = results;

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>

        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            {category.label}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Handpicked {category.short.toLowerCase()} streaming in HD.
          </p>

          <div className="mt-6">
            {locked ? (
              <AgeGate
                onConfirm={() => {
                  localStorage.setItem(AGE_KEY, "1");
                  setVerified(true);
                }}
              />
            ) : results.isLoading ? (
              <GridSkeleton />
            ) : !items.length ? (
              <div className="card-soft p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing to show here right now. Try another section.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                  {items.map((item) => (
                    <MediaCard key={item.id} item={item} block />
                  ))}
                </div>
                <div ref={sentinel} className="h-10" />
                {isFetchingNextPage && (
                  <div className="flex justify-center py-4 text-muted-foreground">
                    <Loader2 className="size-5 animate-spin" />
                  </div>
                )}
                {!hasNextPage && (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    That's everything in {category.label.toLowerCase()}.
                  </p>
                )}
              </>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
