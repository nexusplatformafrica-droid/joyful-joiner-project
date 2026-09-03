import { createFileRoute, Link } from "@tanstack/react-router";
import { Search, Play, Download, Megaphone, ArrowRight } from "lucide-react";
import { Sidebar } from "@/components/youku/Sidebar";
import { TopBar } from "@/components/youku/TopBar";
import { MobileNav } from "@/components/youku/MobileNav";
import { TOUR_START_EVENT } from "@/components/luo/DownloadTour";

const CHANNEL_URL = "https://whatsapp.com/channel/0029VbCdTbF6buMEQY5wzG3y";

const STEPS = [
  {
    icon: Search,
    title: "1. Open the Luo or Luganda library",
    body: "Tap Luo or Luganda in the bottom navigation bar (or the top pill on desktop). Every translated movie and series uploaded by our VJs lives there — newest first.",
  },
  {
    icon: Play,
    title: "2. Pick a title and press Play",
    body: "Tap the poster to open the movie page, then press Play. Series show a season and episode list right under the player, so you can jump to any episode.",
  },
  {
    icon: Download,
    title: "3. Watch online or download",
    body: "Use the Download button on the movie page to save the translated video and watch it later without data.",
  },
  {
    icon: Megaphone,
    title: "4. Get every new translation first",
    body: "Follow the LUOFILM WhatsApp channel — every new Luo and Luganda translation is posted there with its direct watch link.",
  },
];

export const Route = createFileRoute("/tutorial")({
  head: () => ({
    meta: [
      { title: "How to Find Luo & Luganda Translated Movies — LUOFILM.SITE" },
      {
        name: "description",
        content:
          "A quick 4-step tutorial showing exactly where to find, watch and download Luo and Luganda translated movies and series on LUOFILM.SITE.",
      },
      {
        property: "og:title",
        content: "How to Find Luo & Luganda Translated Movies — LUOFILM.SITE",
      },
      {
        property: "og:description",
        content:
          "Quick guide: where to find, watch and download Luo and Luganda translated movies on LUOFILM.SITE.",
      },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "/tutorial" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "/tutorial" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "How to find Luo and Luganda translated movies on LUOFILM.SITE",
          step: STEPS.map((s) => ({ "@type": "HowToStep", name: s.title, text: s.body })),
        }),
      },
    ],
  }),
  component: TutorialPage,
});

function TutorialPage() {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="lg:pl-[var(--sidebar-w)]">
        <div className="relative h-[56px] lg:h-14">
          <TopBar />
        </div>
        <main className="mx-auto max-w-3xl px-3 pb-28 sm:px-4 lg:px-8 lg:pb-16">
          <h1 className="mt-4 text-2xl font-black tracking-tight text-foreground lg:text-3xl">
            Where to get Luo & Luganda translated movies
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A 30-second tour of LUOFILM.SITE — follow these four steps and you will never miss a
            translation again.
          </p>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(TOUR_START_EVENT))}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition hover:brightness-110"
          >
            Show me step by step <ArrowRight className="size-4" />
          </button>

          <ol className="mt-6 space-y-3">
            {STEPS.map((s) => (
              <li
                key={s.title}
                className="flex gap-3 rounded-2xl bg-card/70 p-4 ring-1 ring-border backdrop-blur"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand/15 text-brand">
                  <s.icon className="size-5" />
                </span>
                <div>
                  <h2 className="text-sm font-bold text-foreground">{s.title}</h2>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/luo"
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition hover:brightness-110"
            >
              Browse Luo movies <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/luganda"
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition hover:opacity-90"
            >
              Browse Luganda movies <ArrowRight className="size-4" />
            </Link>
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-bold text-[#06301c] transition hover:brightness-110"
            >
              <Megaphone className="size-4" /> Follow WhatsApp channel
            </a>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
