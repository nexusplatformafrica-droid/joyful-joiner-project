import { fdb, nowIso, type Row } from "@/lib/fdb";

/**
 * Luo/Luganda library data layer.
 * The live Firebase project stores everything in the `media` + `episodes`
 * collections (created before this app existed), so we read/write those and
 * map their fields onto the shape the screens expect.
 */
export const MEDIA_TABLE = "media";
export const EPISODES_TABLE = "episodes";

export type LuoLanguage = "luo" | "luganda";

export type LuoTitle = {
  id: string;
  title: string;
  language: string;
  kind: string;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  video_url: string | null;
  vj: string | null;
  genre: string | null;
  year: number | null;
  published: boolean;
  created_at: string;
};

export type LuoEpisode = {
  id: string;
  title_id: string;
  season: number;
  episode: number;
  name: string | null;
  video_url: string;
  created_at: string;
};

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Firestore docs written by different tools store timestamps as ISO strings,
 * `{ seconds }` Timestamps, Dates or epoch numbers. Normalise them all so the
 * library sorts newest-first regardless of which admin tool wrote the doc.
 */
function toIso(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === "string") return Number.isFinite(Date.parse(v)) ? new Date(v).toISOString() : null;
  if (typeof v === "number") return new Date(v > 1e12 ? v : v * 1000).toISOString();
  if (v instanceof Date) return v.toISOString();
  const o = v as { seconds?: number; _seconds?: number; toDate?: () => Date };
  if (typeof o.toDate === "function") return o.toDate().toISOString();
  const secs = o.seconds ?? o._seconds;
  return typeof secs === "number" ? new Date(secs * 1000).toISOString() : null;
}

/** Firestore `media` doc -> LuoTitle. Legacy docs have no `language` field. */
function toTitle(r: Row): LuoTitle {
  const published = r.published ?? r.is_published ?? true;
  return {
    id: String(r.id),
    title: str(r.title) ?? str(r.caption) ?? "Untitled",
    language: (str(r.language) ?? "luo").toLowerCase(),
    kind: str(r.kind) ?? "movie",
    description: str(r.description),
    poster_url: str(r.poster_url),
    backdrop_url: str(r.backdrop_url) ?? str(r.poster_url),
    video_url: str(r.video_url) ?? str(r.stream_url),
    vj: str(r.vj) ?? str(r.actors),
    genre: str(r.genre) ?? str(r.section),
    year: typeof r.year === "number" ? r.year : r.year ? Number(r.year) || null : null,
    published: !!published,
    created_at: toIso(r.created_at) ?? toIso(r.updated_at) ?? nowIso(),
  };
}

function toEpisode(r: Row): LuoEpisode {
  return {
    id: String(r.id),
    title_id: String(r.title_id ?? r.media_id ?? ""),
    season: Number(r.season ?? 1) || 1,
    episode: Number(r.episode ?? r.episode_number ?? 1) || 1,
    name: str(r.name) ?? str(r.title),
    video_url: str(r.video_url) ?? "",
    // Unknown timestamps sort last, so genuinely new uploads stay on top.
    created_at: toIso(r.created_at) ?? toIso(r.updated_at) ?? "",
  };
}

async function readTitles() {
  const { data, error } = await fdb.from(MEDIA_TABLE).select("*");
  if (error) throw error;
  return (data as Row[])
    .map(toTitle)
    .sort((a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0));
}

export async function listLuoTitles(language: LuoLanguage, includeUnpublished = false) {
  const rows = await readTitles();
  return rows.filter((t) => t.language === language && (includeUnpublished || t.published));
}

export async function listAllLuoTitles() {
  return readTitles();
}

export async function getLuoTitle(id: string) {
  const { data, error } = await fdb.from(MEDIA_TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toTitle(data) : null;
}

export async function listEpisodes(titleId: string) {
  const { data, error } = await fdb.from(EPISODES_TABLE).select("*");
  if (error) throw error;
  return (data as Row[])
    .map(toEpisode)
    .filter((e) => e.title_id === titleId)
    .sort((a, b) => a.season - b.season || a.episode - b.episode);
}

/** All episodes across the library (used for the "new episode" badges). */
export async function listAllEpisodes() {
  const { data, error } = await fdb.from(EPISODES_TABLE).select("*");
  if (error) throw error;
  return (data as Row[]).map(toEpisode);
}

/** titleId -> episode numbers added within the last `days` days. */
export function recentEpisodeTags(episodes: LuoEpisode[], days = 3) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const map = new Map<string, number[]>();
  for (const e of episodes) {
    const at = Date.parse(e.created_at);
    if (!Number.isFinite(at) || at < cutoff) continue;
    const list = map.get(e.title_id) ?? [];
    list.push(e.episode);
    map.set(e.title_id, list);
  }
  for (const [k, v] of map) map.set(k, [...new Set(v)].sort((a, b) => a - b).slice(-3));
  return map;
}

/* ---------- admin writes (kept field-compatible with the legacy docs) ---------- */

export type TitleInput = {
  title: string;
  language: string;
  kind: string;
  description: string | null;
  poster_url: string | null;
  backdrop_url: string | null;
  video_url: string | null;
  vj: string | null;
  genre: string | null;
  year: number | null;
  published: boolean;
};

const titlePayload = (f: TitleInput) => ({
  ...f,
  caption: f.title,
  is_published: f.published,
});

export async function saveLuoTitle(f: TitleInput, id?: string, createdBy?: string | null) {
  if (id) {
    const { error } = await fdb
      .from(MEDIA_TABLE)
      .update({ ...titlePayload(f), updated_at: nowIso() })
      .eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await fdb.from(MEDIA_TABLE).insert({ ...titlePayload(f), created_by: createdBy ?? null });
  if (error) throw error;
}

export async function deleteLuoTitle(id: string) {
  const { error } = await fdb.from(MEDIA_TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function setLuoTitlePublished(id: string, published: boolean) {
  const { error } = await fdb.from(MEDIA_TABLE).update({ published, is_published: published }).eq("id", id);
  if (error) throw error;
}

export type EpisodeInput = { title_id: string; season: number; episode: number; name: string | null; video_url: string };

const episodePayload = (e: EpisodeInput) => ({
  ...e,
  media_id: e.title_id,
  episode_number: e.episode,
  title: e.name,
});

export async function saveLuoEpisode(e: EpisodeInput, id?: string) {
  if (id) {
    const { error } = await fdb.from(EPISODES_TABLE).update(episodePayload(e)).eq("id", id);
    if (error) throw error;
    return;
  }
  const { error } = await fdb.from(EPISODES_TABLE).insert(episodePayload(e));
  if (error) throw error;
}

export async function deleteLuoEpisode(id: string) {
  const { error } = await fdb.from(EPISODES_TABLE).delete().eq("id", id);
  if (error) throw error;
}

export const LANG_LABEL: Record<LuoLanguage, string> = {
  luo: "LUO",
  luganda: "LUGANDA",
};
