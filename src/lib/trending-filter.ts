/**
 * Keeps the Trending rail broad.
 *
 * The upstream catalog leans heavily on Hindi/Telugu/Tamil dubs, which made the
 * rail look like one regional feed. We drop obvious dub entries (language tag in
 * the title) and cap how many titles of the same regional genre can appear.
 */
import type { CatalogItem } from "./moviebox";

const DUB_TAG =
  /[[(]\s*(hindi|telugu|tamil|malayalam|kannada|bhojpuri|punjabi|urdu|bengali|marathi)\s*[\])]|dubbed\s+in\s+(hindi|telugu|tamil)|hindi\s+dub|bollywood/i;

const REGIONAL_GENRE = /bollywood|indian|hindi|tollywood|kollywood/i;

export function isRegionalDub(item: CatalogItem) {
  return DUB_TAG.test(item.title) || (!!item.genre && REGIONAL_GENRE.test(item.genre));
}

/** Trending line-up: dubs removed, newest/best first, deduped. */
export function balanceTrending(items: CatalogItem[], limit = 24): CatalogItem[] {
  const seen = new Set<string>();
  const clean = items.filter((i) => {
    if (seen.has(i.id) || isRegionalDub(i)) return false;
    seen.add(i.id);
    return !!i.poster;
  });
  // Keep the upstream running order but float recent, well-rated titles up a bit.
  const score = (i: CatalogItem) =>
    (Number(i.year) >= new Date().getFullYear() - 1 ? 2 : 0) + (Number(i.rating) >= 7 ? 1 : 0);
  return clean
    .map((item, index) => ({ item, index }))
    .sort((a, b) => score(b.item) - score(a.item) || a.index - b.index)
    .map((e) => e.item)
    .slice(0, limit);
}
