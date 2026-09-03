import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Film, Tv, ListVideo, Trash2, Pencil, Plus, UploadCloud, Link2, X } from "lucide-react";
import { uploadMedia } from "@/lib/admin";
import { formatBytes } from "@/lib/storage";
import {
  deleteLuoEpisode,
  deleteLuoTitle,
  listAllLuoTitles,
  listEpisodes,
  saveLuoEpisode,
  saveLuoTitle,
  setLuoTitlePublished,
  type LuoTitle,
} from "@/lib/luo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Empty, Panel, Pill, ghostBtn, goldBtn, softField } from "./ui";

type Kind = "movie" | "series";
type Sub = "movies" | "series" | "episodes";

const emptyForm = {
  id: "",
  title: "",
  language: "luo",
  kind: "movie" as Kind,
  description: "",
  poster_url: "",
  backdrop_url: "",
  video_url: "",
  vj: "",
  genre: "",
  year: "",
  published: true,
};
type Form = typeof emptyForm;

/** Upload field with URL / direct-file modes and a soft progress bar. */
function MediaInput({
  label,
  value,
  onChange,
  accept,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  accept: string;
}) {
  const [mode, setMode] = useState<"url" | "file">("url");
  const [pct, setPct] = useState<number | null>(null);
  const [active, setActive] = useState<{ name: string; size: number } | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);


  return (
    <div className="min-w-0 overflow-hidden rounded-2xl bg-white/55 p-3">
      <div className="mb-2 flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="truncate text-[12px] font-semibold opacity-70">{label}</span>
        <div className="flex shrink-0 gap-1 rounded-full bg-white/70 p-1">

          {(["url", "file"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-bold transition ${
                mode === m ? "bg-[linear-gradient(100deg,oklch(0.96_0.05_95),oklch(0.9_0.1_80))]" : "opacity-60"
              }`}
            >
              {m === "url" ? <Link2 className="size-3" /> : <UploadCloud className="size-3" />}
              {m === "url" ? "By URL" : "Direct upload"}
            </button>
          ))}
        </div>
      </div>

      {mode === "url" ? (
        <input
          className={`${softField} block w-full min-w-0 max-w-full text-ellipsis`}
          placeholder="https://…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type="file"
          accept={accept}
          className="w-full cursor-pointer rounded-2xl bg-white/70 p-2.5 text-[12px] ring-1 ring-black/5 file:mr-3 file:rounded-full file:border-0 file:bg-[linear-gradient(100deg,oklch(0.96_0.05_95),oklch(0.9_0.1_80))] file:px-3 file:py-1.5 file:text-[12px] file:font-bold"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            setActive({ name: f.name, size: f.size });
            setPct(0);
            try {
              const { url } = await uploadMedia(f, setPct);
              onChange(url);
              setPct(100);
              toast.success(`${f.name} uploaded`);
            } catch (err) {
              setPct(null);
              setActive(null);
              toast.error(err instanceof Error ? err.message : "Upload failed");
            }
          }}
        />
      )}

      {pct !== null && (
        <div className="mt-3 rounded-2xl bg-white/70 p-3 ring-1 ring-black/5">
          <div className="mb-2 flex min-w-0 items-end justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-bold">{active?.name ?? "Uploading"}</p>
              <p className="text-[11px] opacity-60">
                {active ? `${formatBytes(Math.round((active.size * pct) / 100))} of ${formatBytes(active.size)}` : ""}
                {offline ? " · waiting for network…" : ""}
              </p>
            </div>
            <span className="shrink-0 bg-[linear-gradient(100deg,oklch(0.8_0.15_85),oklch(0.65_0.2_35))] bg-clip-text text-[22px] font-black leading-none text-transparent">
              {pct}%
            </span>
          </div>
          <div className="relative h-5 w-full overflow-hidden rounded-full bg-black/10 ring-1 ring-inset ring-black/5">
            <div
              className="relative h-full rounded-full bg-[linear-gradient(100deg,oklch(0.88_0.14_95),oklch(0.8_0.17_60)_45%,oklch(0.68_0.2_30))] shadow-[0_2px_12px_-2px_oklch(0.75_0.18_50)] transition-[width] duration-300 ease-out"
              style={{ width: `${Math.max(pct, 3)}%` }}
            >
              {pct < 100 && (
                <span className="absolute inset-0 animate-pulse rounded-full bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.65),transparent)]" />
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] font-semibold opacity-65">
            {pct === 100
              ? "Upload complete — link attached"
              : offline
                ? "Connection lost — the upload resumes by itself when data is back."
                : "Uploading… you can keep this tab open, drops resume automatically."}
          </p>
        </div>
      )}
      {value && <p className="mt-2 truncate text-[11px] opacity-55">{value}</p>}
    </div>
  );
}

export function ContentTab({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const [sub, setSub] = useState<Sub>("movies");
  const [form, setForm] = useState<Form | null>(null);

  const titles = useQuery({ queryKey: ["admin-titles"], queryFn: listAllLuoTitles });
  const movies = (titles.data ?? []).filter((t) => t.kind !== "series");
  const series = (titles.data ?? []).filter((t) => t.kind === "series");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-titles"] });
    void qc.invalidateQueries({ queryKey: ["luo-titles"] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const save = useMutation({
    mutationFn: async (f: Form) => {
      const payload = {
        title: f.title,
        language: f.language,
        kind: f.kind,
        description: f.description || null,
        poster_url: f.poster_url || null,
        backdrop_url: f.backdrop_url || null,
        video_url: f.kind === "series" ? null : f.video_url || null,
        vj: f.vj || null,
        genre: f.genre || null,
        year: f.year ? Number(f.year) : null,
        published: f.published,
      };
      await saveLuoTitle(payload, f.id || undefined, userId ?? null);
    },
    onSuccess: (_d, f) => {
      toast.success(f.id ? "Updated" : "Uploaded");
      setForm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteLuoTitle(id);
    },
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async ({ id, published }: { id: string; published: boolean }) => {
      await setLuoTitlePublished(id, published);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = (kind: Kind) => setForm({ ...emptyForm, kind });
  const openEdit = (t: LuoTitle) =>
    setForm({
      id: t.id,
      title: t.title,
      language: t.language,
      kind: (t.kind === "series" ? "series" : "movie") as Kind,
      description: t.description ?? "",
      poster_url: t.poster_url ?? "",
      backdrop_url: t.backdrop_url ?? "",
      video_url: t.video_url ?? "",
      vj: t.vj ?? "",
      genre: t.genre ?? "",
      year: t.year ? String(t.year) : "",
      published: t.published,
    });

  const list = sub === "movies" ? movies : series;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 rounded-full bg-white/60 p-1.5 ring-1 ring-black/5">
        {([
          { k: "movies" as Sub, t: "Movies", i: Film },
          { k: "series" as Sub, t: "Series", i: Tv },
          { k: "episodes" as Sub, t: "Episodes", i: ListVideo },
        ]).map((s) => (
          <button
            key={s.k}
            type="button"
            onClick={() => setSub(s.k)}
            className={`flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-bold transition ${
              sub === s.k ? "bg-[linear-gradient(100deg,oklch(0.96_0.05_95),oklch(0.9_0.1_80))] shadow" : "opacity-60 hover:opacity-90"
            }`}
          >
            <s.i className="size-4" /> {s.t}
          </button>
        ))}
      </div>

      {sub === "episodes" ? (
        <EpisodesManager series={series} />
      ) : (
        <Panel
          title={`${sub === "movies" ? "Uploaded movies" : "Uploaded series"} · ${list.length}`}
          action={
            <button
              type="button"
              onClick={() => openNew(sub === "movies" ? "movie" : "series")}
              className={`${goldBtn} inline-flex items-center gap-2`}
            >
              <Plus className="size-4" /> {sub === "movies" ? "Upload movie" : "Add series"}
            </button>
          }
        >
          {titles.isLoading ? (
            <Empty>Loading…</Empty>
          ) : list.length === 0 ? (
            <Empty>Nothing uploaded yet.</Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {list.map((t) => (
                <div key={t.id} className="flex gap-3 rounded-2xl bg-white/65 p-3">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-black/10">
                    {t.poster_url && <img src={t.poster_url} alt={t.title} className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{t.title}</p>
                    <p className="mt-0.5 truncate text-[11px] opacity-60">
                      {t.language.toUpperCase()} · {t.genre ?? "—"} · {t.year ?? "—"}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" onClick={() => togglePublish.mutate({ id: t.id, published: !t.published })}>
                        <Pill tone={t.published ? "on" : "off"}>{t.published ? "published" : "hidden"}</Pill>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold ring-1 ring-black/5"
                      >
                        <Pencil className="size-3" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Delete "${t.title}"?`)) remove.mutate(t.id);
                        }}
                        className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-[oklch(0.55_0.18_25)] ring-1 ring-black/5"
                      >
                        <Trash2 className="size-3" /> Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Dialog open={!!form} onOpenChange={(v) => !v && setForm(null)}>
        {/* Fixed rectangle: the width never reacts to a long pasted link. */}
        <DialogContent className="grid max-h-[88vh] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] grid-cols-1 overflow-y-auto overflow-x-hidden rounded-2xl border-0 bg-[linear-gradient(165deg,oklch(0.98_0.02_20),oklch(0.97_0.03_320)_55%,oklch(0.98_0.03_80))] p-4 text-[oklch(0.28_0.03_320)] sm:w-[640px] sm:max-w-[640px] sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-[18px] font-bold">
              {form?.id ? "Update" : form?.kind === "series" ? "Add series" : "Upload movie"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(form);
              }}
            >
              <input className={softField} required placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <div className="grid gap-2 sm:grid-cols-3">
                <select className={softField} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="luo">Luo</option>
                  <option value="luganda">Luganda</option>
                </select>
                <input className={softField} placeholder="VJ" value={form.vj} onChange={(e) => setForm({ ...form, vj: e.target.value })} />
                <input className={softField} placeholder="Genre" value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <input className={softField} inputMode="numeric" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
                <label className="flex items-center justify-between gap-2 rounded-2xl bg-white/65 px-4 text-[13px] font-semibold">
                  Published
                  <input type="checkbox" className="size-5 accent-[oklch(0.82_0.1_65)]" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
                </label>
              </div>

              <MediaInput label="Poster image" accept="image/*" value={form.poster_url} onChange={(v) => setForm({ ...form, poster_url: v })} />
              <MediaInput label="Backdrop image" accept="image/*" value={form.backdrop_url} onChange={(v) => setForm({ ...form, backdrop_url: v })} />
              {form.kind === "movie" ? (
                <MediaInput label="Movie video" accept="video/*" value={form.video_url} onChange={(v) => setForm({ ...form, video_url: v })} />
              ) : (
                <p className="rounded-2xl bg-white/60 px-4 py-3 text-[12px] opacity-65">
                  Series only need images here — videos are added per episode in the Episodes tab.
                </p>
              )}

              <textarea
                className="min-h-24 w-full rounded-2xl bg-white/70 p-3 text-sm outline-none ring-1 ring-black/5 placeholder:opacity-50 focus:bg-white focus:ring-2 focus:ring-[oklch(0.82_0.1_65)]"
                placeholder="Description / synopsis"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <div className="flex gap-2">
                <button type="submit" disabled={save.isPending} className={`${goldBtn} flex-1`}>
                  {form.id ? "Save changes" : "Publish"}
                </button>
                <button type="button" onClick={() => setForm(null)} className={ghostBtn}>
                  <X className="size-4" />
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EpisodesManager({ series }: { series: LuoTitle[] }) {
  const qc = useQueryClient();
  const [titleId, setTitleId] = useState("");
  const active = titleId || series[0]?.id || "";
  const [ep, setEp] = useState({ id: "", season: "1", episode: "1", name: "", video_url: "" });

  const eps = useQuery({
    queryKey: ["admin-episodes", active],
    queryFn: () => listEpisodes(active),
    enabled: !!active,
  });

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["admin-episodes", active] });
    void qc.invalidateQueries({ queryKey: ["luo-episodes", active] });
    void qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("Pick a series first");
      if (!ep.video_url) throw new Error("Add the episode video");
      const payload = {
        title_id: active,
        season: Number(ep.season) || 1,
        episode: Number(ep.episode) || 1,
        name: ep.name || null,
        video_url: ep.video_url,
      };
      await saveLuoEpisode(payload, ep.id || undefined);
    },
    onSuccess: () => {
      toast.success(ep.id ? "Episode updated" : "Episode added");
      setEp({ id: "", season: ep.season, episode: String(Number(ep.episode) + (ep.id ? 0 : 1)), name: "", video_url: "" });
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      await deleteLuoEpisode(id);
    },
    onSuccess: () => {
      toast.success("Episode deleted");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <Panel title={ep.id ? "Update episode" : "Add episode"}>
        <select className={softField} value={active} onChange={(e) => setTitleId(e.target.value)}>
          {series.length === 0 && <option value="">No series yet — add one first</option>}
          {series.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} ({s.language.toUpperCase()})
            </option>
          ))}
        </select>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input className={softField} placeholder="Season" value={ep.season} onChange={(e) => setEp({ ...ep, season: e.target.value })} />
          <input className={softField} placeholder="Episode number" value={ep.episode} onChange={(e) => setEp({ ...ep, episode: e.target.value })} />
        </div>
        <input className={`${softField} mt-2`} placeholder="Episode name (optional)" value={ep.name} onChange={(e) => setEp({ ...ep, name: e.target.value })} />
        <div className="mt-2">
          <MediaInput label="Episode video" accept="video/*" value={ep.video_url} onChange={(v) => setEp({ ...ep, video_url: v })} />
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className={`${goldBtn} flex-1`}>
            {ep.id ? "Save episode" : "Add episode"}
          </button>
          {ep.id && (
            <button type="button" className={ghostBtn} onClick={() => setEp({ id: "", season: "1", episode: "1", name: "", video_url: "" })}>
              Cancel
            </button>
          )}
        </div>
      </Panel>

      <Panel title={`Episodes · ${eps.data?.length ?? 0}`}>
        {!active ? (
          <Empty>Add a series first.</Empty>
        ) : (eps.data?.length ?? 0) === 0 ? (
          <Empty>No episodes yet.</Empty>
        ) : (
          <ul className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {eps.data?.map((e) => (
              <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/65 px-3 py-2 text-[13px]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[linear-gradient(120deg,oklch(0.95_0.05_320),oklch(0.9_0.09_300))] text-[11px] font-black">
                  S{e.season}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    Episode {e.episode}
                    {e.name ? ` · ${e.name}` : ""}
                  </span>
                  <span className="block truncate text-[11px] opacity-55">{e.video_url}</span>
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setEp({
                      id: e.id,
                      season: String(e.season),
                      episode: String(e.episode),
                      name: e.name ?? "",
                      video_url: e.video_url,
                    })
                  }
                  className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold ring-1 ring-black/5"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Delete this episode?")) del.mutate(e.id);
                  }}
                  aria-label="Delete episode"
                  className="text-[oklch(0.55_0.18_25)]"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
