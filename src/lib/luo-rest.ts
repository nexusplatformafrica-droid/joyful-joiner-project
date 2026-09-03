/**
 * Runtime-agnostic reads of the Luo/Luganda `media` collection over the
 * Firestore REST API. The Firebase JS SDK needs a browser-ish environment, so
 * SSR / server routes (link-preview metadata, sitemap) use this instead.
 * Every failure resolves to an empty result — metadata must never break a page.
 */
import { firebaseConfig } from "./firebase";

const BASE = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

export type LuoPublicTitle = {
  id: string;
  title: string;
  description: string | null;
  poster: string | null;
  language: "luo" | "luganda";
  updatedAt: string | null;
};

type RestValue = Record<string, unknown>;

function val(v: RestValue | undefined): unknown {
  if (!v) return null;
  if ("stringValue" in v) return v['stringValue'];
  if ("integerValue" in v) return Number(v['integerValue']);
  if ("doubleValue" in v) return Number(v['doubleValue']);
  if ("booleanValue" in v) return v['booleanValue'];
  if ("timestampValue" in v) return v['timestampValue'];
  if ("nullValue" in v) return null;
  return null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function imageUrl(v: unknown): string | null {
  const value = str(v);
  if (!value) return null;
  if (value.startsWith("https://")) return value;
  if (value.startsWith("http://")) return `https://${value.slice(7)}`;
  return null;
}

function mapDoc(doc: { name?: string; fields?: Record<string, RestValue>; updateTime?: string }) {
  const f = doc.fields ?? {};
  const id = (doc.name ?? "").split("/").pop() ?? "";
  const published = val(f['published']) ?? val(f['is_published']) ?? true;
  const lang = (str(val(f['language'])) ?? "luo").toLowerCase();
  const item: LuoPublicTitle = {
    id,
    title: str(val(f['title'])) ?? "Untitled",
    description: str(val(f['description'])),
    poster:
      imageUrl(val(f['poster_url'])) ??
      imageUrl(val(f['poster'])) ??
      imageUrl(val(f['thumbnail'])) ??
      imageUrl(val(f['backdrop_url'])),
    language: lang.startsWith("lug") ? "luganda" : "luo",
    updatedAt: str(doc.updateTime),
  };
  return { item, published: published !== false };
}

/** All published Luo/Luganda titles (paged through the REST cursor). */
export async function restListTitles(): Promise<LuoPublicTitle[]> {
  const out: LuoPublicTitle[] = [];
  let pageToken = "";
  try {
    for (let page = 0; page < 20; page++) {
      const url = `${BASE}/media?key=${firebaseConfig.apiKey}&pageSize=300${
        pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) break;
      const json = (await res.json()) as {
        documents?: Parameters<typeof mapDoc>[0][];
        nextPageToken?: string;
      };
      for (const doc of json.documents ?? []) {
        const { item, published } = mapDoc(doc);
        if (published && item.id) out.push(item);
      }
      if (!json.nextPageToken) break;
      pageToken = json.nextPageToken;
    }
  } catch {
    /* metadata is best-effort */
  }
  return out;
}

/** A single title, for link-preview metadata. */
export async function restGetTitle(id: string): Promise<LuoPublicTitle | null> {
  try {
    const res = await fetch(`${BASE}/media/${encodeURIComponent(id)}?key=${firebaseConfig.apiKey}`);
    if (!res.ok) return null;
    const doc = (await res.json()) as Parameters<typeof mapDoc>[0];
    const { item } = mapDoc(doc);
    return item.id ? item : null;
  } catch {
    return null;
  }
}
