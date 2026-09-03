import { createFileRoute, Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { LuoLibrary } from "@/components/luo/LuoLibrary";

export const Route = createFileRoute("/luo/")({
  head: () => {
    const title =
      "LUOFILM.SITE Watch and Download Luo Translated Movies by VJ Senior Paul (VJ Paul UG) — First Platform to Download and Watch Luo Translated Movies, Series, Animation, Comedy, Action, Romance, Horror, Thriller, Sci-Fi, Drama, Adventure, Crime, Fantasy";
    const description =
      "First platform to watch and download Luo translated movies by VJ Senior Paul (VJ Paul UG) — Luo translated movies, series, animation, comedy, action, romance, horror, thriller, sci-fi, drama, adventure, crime and fantasy, free in HD.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:url", content: "/luo" },
        { property: "og:site_name", content: "LUOFILM.SITE" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: "/luo" }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            description,
            inLanguage: "luo",
          }),
        },
      ],
    };
  },
  component: LuoPage,
});

function LuoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <Link
            to="/tutorial"
            className="mt-4 flex items-center gap-3 rounded-2xl bg-card/70 px-4 py-3 ring-1 ring-border transition hover:ring-brand"
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
              <GraduationCap className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-foreground">
                New here? See how to find translated movies
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">
                A quick 4-step tutorial — find, watch and download in Luo & Luganda.
              </span>
            </span>
          </Link>
          <div className="mt-4">
            <LuoLibrary language="luo" />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
