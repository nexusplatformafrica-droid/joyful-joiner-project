/**
 * Keeps the Trending rail broad and premium — a Netflix-style line-up.
 *
 * The upstream catalog leans heavily on Hindi/Telugu/Tamil dubs and low-grade
 * filler, which made the rail look like one regional feed. We drop dubs and
 * junk, then rank what is left by recency + rating and alternate movies with
 * series so the row reads like a curated "Trending Now".
 */
import type { CatalogItem } from "./moviebox";

const DUB_TAG =
  /[[(]\s*(hindi|telugu|tamil|malayalam|kannada|bhojpuri|punjabi|urdu|bengali|marathi)\s*[\])]|dubbed\s+in\s+(hindi|telugu|tamil)|hindi\s+dub|bollywood/i;

const REGIONAL_GENRE = /bollywood|indian|hindi|tollywood|kollywood|punjabi|bhojpuri/i;

/** Low-grade filler the catalog mixes in: shorts, reels, mini dramas. */
const FILLER =
  /\b(hot short|short tv|mini drama|shorts?|reel|episode\s*\d+\s*only|trailer|teaser|clip|full movie in)\b/i;

export function isRegionalDub(item: CatalogItem) {
  return DUB_TAG.test(item.title) || (!!item.genre && REGIONAL_GENRE.test(item.genre));
}

/** Trending line-up: dubs and filler removed, best + newest first, deduped. */
export function balanceTrending(items: CatalogItem[], limit = 24): CatalogItem[] {
  const seen = new Set<string>();
  const seenTitle = new Set<string>();
  const clean = items.filter((i) => {
    const key = i.title.trim().toLowerCase();
    if (seen.has(i.id) || seenTitle.has(key)) return false;
    if (isRegionalDub(i) || FILLER.test(i.title)) return false;
    if (!i.poster) return false;
    // Anything rated but clearly poor never belongs in a "trending" row.
    if (i.rating && Number(i.rating) < 5.5) return false;
    seen.add(i.id);
    seenTitle.add(key);
    return true;
  });

  const year = new Date().getFullYear();
  const score = (i: CatalogItem, index: number) => {
    const y = Number(i.year) || 0;
    const r = Number(i.rating) || 0;
    let s = 0;
    if (y >= year) s += 5;
    else if (y >= year - 1) s += 4;
    else if (y >= year - 3) s += 2;
    else if (y && y < year - 8) s -= 2;
    if (r >= 8) s += 4;
    else if (r >= 7) s += 3;
    else if (r >= 6) s += 1;
    else if (!r) s -= 1;
    // Respect the upstream running order a little: earlier = hotter.
    s += Math.max(0, 3 - index / 12);
    return s;
  };

  const ranked = clean
    .map((item, index) => ({ item, index, s: score(item, index) }))
    .sort((a, b) => b.s - a.s || a.index - b.index)
    .map((e) => e.item);

  // Alternate movies and series so the rail feels mixed, like Netflix's row.
  const movies = ranked.filter((i) => i.type !== "series");
  const series = ranked.filter((i) => i.type === "series");
  const out: CatalogItem[] = [];
  for (let i = 0; out.length < limit && (i < movies.length || i < series.length); i += 1) {
    const m = movies[i];
    const s = series[i];
    if (m) out.push(m);
    if (s && out.length < limit) out.push(s);
  }
  return out.slice(0, limit);
}
