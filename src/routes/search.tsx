import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SearchX } from "lucide-react";
import { z } from "zod";
import { Icon3D } from "@/components/Icon3D";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { MediaCard } from "@/components/youku/MediaCard";
import { GridSkeleton } from "@/components/youku/Skeletons";
import { searchTitles } from "@/lib/catalog.functions";


export const Route = createFileRoute("/search")({
  validateSearch: z.object({ q: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Browse & Search Titles — LUOFILM" },
      {
        name: "description",
        content:
          "Search the LUOFILM catalog for any movie or TV series and start streaming in seconds.",
      },
      { property: "og:title", content: "Browse & Search Titles — LUOFILM" },
      {
        property: "og:description",
        content: "Search the LUOFILM catalog and start streaming in seconds.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate();
  const [term, setTerm] = useState(q ?? "");

  useEffect(() => {
    setTerm(q ?? "");
  }, [q]);

  const query = useQuery({
    queryKey: ["search", q],
    queryFn: () => searchTitles({ data: { q: q! } }),
    enabled: Boolean(q),
    staleTime: 60 * 1000,
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const next = term.trim();
    if (next) navigate({ to: "/search", search: { q: next } });
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>

        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <form
            onSubmit={submit}
            className="mt-4 flex h-14 items-center gap-3 rounded-2xl bg-foreground/10 px-4 ring-1 ring-border backdrop-blur-md lg:hidden"
          >
            <Icon3D name="search" className="size-6 shrink-0" />
            <input
              aria-label="Search movies and series"
              placeholder="Search movies and series"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-foreground/50"
            />
          </form>

          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground">
            {q ? `Results for "${q}"` : "Search the catalog"}
          </h1>

          <div className="mt-6">

            {!q ? (
              <p className="text-sm text-muted-foreground">
                Type a movie or series name in the search bar above to get started.
              </p>
            ) : query.isPending ? (
              <GridSkeleton />
            ) : query.data?.length ? (
              <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                {query.data.map((item) => (
                  <MediaCard key={item.id} item={item} block />
                ))}
              </div>
            ) : (
              <div className="card-soft flex flex-col items-center gap-3 p-10 text-muted-foreground">
                <SearchX className="size-8" />
                <p className="text-sm">No titles matched that search.</p>
              </div>
            )}
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
