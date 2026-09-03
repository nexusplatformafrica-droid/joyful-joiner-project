import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Play, ShieldCheck } from "lucide-react";
import {
  listAllEpisodes,
  listLuoTitles,
  recentEpisodeTags,
  type LuoLanguage,
  type LuoTitle,
} from "@/lib/luo";

export function LuoLibrary({ language }: { language: LuoLanguage }) {
  const q = useQuery({
    queryKey: ["luo-titles", language],
    queryFn: () => listLuoTitles(language),
    staleTime: 30 * 1000,
  });

  const epQuery = useQuery({
    queryKey: ["luo-all-episodes"],
    queryFn: listAllEpisodes,
    staleTime: 60 * 1000,
  });

  const allEpisodes = epQuery.data ?? [];
  const freshTags = recentEpisodeTags(allEpisodes, 3);

  // A series counts as "new" when its newest episode is new, even if the show
  // itself was uploaded long ago.
  const lastEpisodeAt = new Map<string, number>();
  for (const e of allEpisodes) {
    const at = Date.parse(e.created_at) || 0;
    if (at > (lastEpisodeAt.get(e.title_id) ?? 0)) lastEpisodeAt.set(e.title_id, at);
  }
  const activity = (t: LuoTitle) =>
    Math.max(Date.parse(t.created_at) || 0, lastEpisodeAt.get(t.id) ?? 0);

  const items = [...(q.data ?? [])].sort((a, b) => activity(b) - activity(a));

  // Some legacy episode docs have no timestamp at all. For a recently active
  // series we still tag its two newest episode numbers so the badge shows.
  const cutoff = Date.now() - 3 * 24 * 60 * 60 * 1000;
  for (const t of items) {
    if (t.kind !== "series" || freshTags.has(t.id)) continue;
    const eps = allEpisodes.filter((e) => e.title_id === t.id);
    if (!eps.length) continue;
    const untimed = eps.every((e) => !Number.isFinite(Date.parse(e.created_at)));
    if (!untimed || activity(t) < cutoff) continue;
    const numbers = [...new Set(eps.map((e) => e.episode))].sort((a, b) => a - b).slice(-2);
    if (numbers.length) freshTags.set(t.id, numbers);
  }

  // Series that got new episodes in the last 3 days sit on top; every other
  // title appears in exactly one section below (no duplicates across rails).
  const used = new Set<string>();
  const take = (rows: LuoTitle[]) => {
    const out: LuoTitle[] = [];
    for (const t of rows) {
      if (used.has(t.id)) continue;
      used.add(t.id);
      out.push(t);
    }
    return out;
  };

  const updated = take(
    items
      .filter((i) => i.kind === "series" && freshTags.has(i.id))
      .sort((a, b) => (freshTags.get(b.id)?.at(-1) ?? 0) - (freshTags.get(a.id)?.at(-1) ?? 0)),
  );
  const latest = take(items.slice(0, 12));
  const movies = take(items.filter((i) => i.kind !== "series"));
  const series = take(items.filter((i) => i.kind === "series"));

  return (
    <div className="space-y-8">
      {q.isLoading && (
        <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5 md:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {!q.isLoading && items.length === 0 && (
        <div className="rounded-2xl bg-foreground/5 p-10 text-center ring-1 ring-border">
          <p className="text-sm text-muted-foreground">
            No titles uploaded yet. Admins can add movies and series from the admin panel.
          </p>
        </div>
      )}

      {[
        { label: "New episodes", rows: updated },
        { label: "Latest", rows: latest },
        { label: "Movies", rows: movies },
        { label: "Series", rows: series },
      ]
        .filter((s) => s.rows.length > 0)
        .map((section) => (
          <section key={section.label}>
            <h2 className="mb-3 text-[15px] font-bold text-foreground">{section.label}</h2>
            <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4 sm:gap-x-3 sm:gap-y-5 md:grid-cols-5 xl:grid-cols-6">
              {section.rows.map((item, idx) => {
                const eps = freshTags.get(item.id);
                return (
                  <Link
                    key={item.id}
                    to={language === "luo" ? "/luo/$id" : "/luganda/$id"}
                    params={{ id: item.id }}
                    {...(idx === 0 ? { "data-tour": "first-poster" } : {})}
                    className="group block"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform group-hover:-translate-y-1 group-hover:ring-brand">
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt={item.title}
                          loading="eager"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="grid size-full place-items-center px-2 text-center text-xs text-muted-foreground">
                          {item.title}
                        </div>
                      )}
                      <span className="absolute right-1 top-1 rounded bg-brand px-1.5 py-0.5 text-[10px] font-black uppercase text-brand-foreground">
                        {item.kind === "series" ? "Series" : "Movie"}
                      </span>
                      {eps?.length ? (
                        <span className="absolute left-1 top-1 rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-black uppercase text-black">
                          EP {eps.join(", ")}
                        </span>
                      ) : null}
                      <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-6 text-[10px] font-semibold text-white/90">
                        <ShieldCheck className="size-3 text-brand" /> Uploaded by admin
                      </span>
                      <span className="pointer-events-none absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
                        <Play className="size-8 fill-white text-white drop-shadow" />
                      </span>
                    </div>
                    <p className="mt-2 truncate text-[13px] text-muted-foreground group-hover:text-foreground">
                      {item.title}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground/70">
                      {[item.vj ? `VJ ${item.vj}` : null, item.year, item.genre]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );
}
