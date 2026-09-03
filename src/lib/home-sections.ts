/**
 * Curated home page sections, mirroring the MovieBox home layout.
 *
 * Two ways a rail gets filled:
 *  - `titles`: an explicit, ordered list of real titles. Each one is looked up
 *    in the catalog and the best-matching result is used, so the rail shows
 *    exactly those shows/movies with live posters, ratings and ids.
 *  - `keywords`: merged live searches, then filtered by the catalog's own
 *    genre / type / year metadata.
 */
import { searchCatalog, type CatalogItem } from "./moviebox";

export type HomeSection = {
  title: string;
  /** Explicit ordered titles (preferred — gives the exact real line-up). */
  titles?: string[];
  /** Search feeds merged into the rail. */
  keywords?: string[];
  /** Keep only items whose catalog genre matches. */
  genre?: RegExp;
  /** Drop items whose catalog genre matches this (e.g. animation in live-action rails). */
  avoidGenre?: RegExp;
  type?: "movie" | "series";
  /** Keep only items released on/after this year. */
  minYear?: number;
  ranked?: boolean;
};

export const HOME_SECTIONS: HomeSection[] = [
  {
    title: "Popular Series",
    titles: [
      "Reacher",
      "Lanterns",
      "Outer Banks",
      "Umthetho",
      "House of the Dragon",
      "Lioness",
      "My Life with the Walter Boys",
      "Our Sticky Love",
      "The Summer I Turned Pretty",
      "Wednesday",
    ],
    keywords: ["popular series 2026","new series 2026","top tv show","trending series"],
    type: "series",
  },
  {
    title: "Popular Movie",
    titles: [
      "Spider-Man: Brand New Day",
      "Mutiny",
      "Toy Story 5",
      "Minions & Monsters",
      "The Last House",
      "Evil Dead Burn",
      "The Devil's Mouth",
      "Supergirl",
      "Man of War",
      "Kill Trip",
    ],
    keywords: ["popular movie 2026","new movie 2026","box office","trending movie"],
    type: "movie",
  },
  {
    title: "Best Animation",
    titles: [
      "Minions & Monsters",
      "Rango",
      "The Croods",
      "The Croods: A New Age",
      "Toy Story 5",
      "Zootopia 2",
      "Despicable Me 4",
      "Inside Out 2",
      "Moana 2",
      "The Bad Guys 2",
      "Elio",
      "The Wild Robot",
      "KPop Demon Hunters",
      "Migration",
    ],
    keywords: [
      "best animation movie 2026",
      "animated movie 2025",
      "new animation movie",
      "pixar dreamworks movie",
    ],
    genre: /animation|animated|family/i,
    avoidGenre: /anime/i,
    type: "movie",
  },
  {
    title: "Most trending",
    titles: [
      "Mutiny",
      "Spider-Man: Brand New Day",
      "The Last House",
      "Man of War",
      "Evil Dead Burn",
      "Kill Trip",
      "The Devil's Mouth",
      "Supergirl",
      "Lanterns",
      "IT: Welcome to Derry",
      "Reacher",
      "Toy Story 5",
    ],
    keywords: [
      "trending now 2026",
      "new release 2026",
      "latest movie 2026",
      "top 10 this week",
    ],
    minYear: 2025,
    ranked: true,
  },
  {
    title: "Bet+",
    titles: [
      "Sistas",
      "The Oval",
      "Zatima",
      "Divorced Sistas",
      "All the Queen's Men",
      "The Family Business",
      "Ruthless",
      "Bruh",
    ],
    keywords: ["bet plus","tyler perry","black drama series","urban drama"],
  },
  {
    title: "Action & Thriller",
    titles: [
      "Reacher",
      "Lucky",
      "The Day of the Jackal",
      "Ride or Die",
      "The Agency",
      "Citadel",
      "M.I.A.",
      "Prisoner",
    ],
    keywords: ["action thriller 2026","thriller series","spy thriller","crime thriller"],
  },
  {
    title: "Gangster",
    titles: [
      "Snowfall",
      "Peaky Blinders",
      "Power",
      "Tulsa King",
      "MobLand",
      "The Sopranos",
      "The Family Business",
      "Godfather of Harlem",
    ],
    keywords: ["gangster series","mafia crime","crime family drama","drug empire"],
  },
  {
    title: "C-Drama",
    keywords: ["chinese drama", "c-drama", "wuxia", "chinese romance"],
    genre: /drama|romance|fantasy/i,
    type: "series",
  },
  {
    title: "Action Movies",
    keywords: ["action movie", "action 2026", "fight"],
    genre: /action/i,
    type: "movie",
  },
  {
    title: "Horror Movies",
    keywords: ["horror", "horror 2026", "scary"],
    genre: /horror/i,
    type: "movie",
  },
  {
    title: "Hot Short TV",
    keywords: ["short tv", "short drama", "mini series romance"],
  },
  {
    title: "Epic Fantasy",
    titles: [
      "Game of Thrones",
      "House of the Dragon",
      "The Lord of the Rings: The Rings of Power",
      "The Witcher",
      "The Wheel of Time",
      "Dune: Prophecy",
      "The Sandman",
      "Shadow and Bone",
      "His Dark Materials",
      "Rings of Power",
    ],
    keywords: ["epic fantasy series","medieval fantasy","dragons kingdom","sword sorcery"],
    type: "series",
    avoidGenre: /animation|anime/i,
  },
  {
    title: "Sitcom",
    titles: [
      "Friends",
      "The Big Bang Theory",
      "Malcolm in the Middle",
      "Modern Family",
      "Shameless",
      "Young Sheldon",
      "Seinfeld",
      "Two and a Half Men",
    ],
    keywords: ["sitcom","comedy series","family sitcom","funny series"],
  },
  {
    title: "Teen Romance",
    titles: [
      "My Life with the Walter Boys",
      "Sterling Point",
      "The Shards",
      "The Map of Longing",
      "Elle",
      "Every Year After",
      "Off Campus",
      "Euphoria",
    ],
    keywords: ["teen romance","high school romance","young love series","college romance"],
  },
  {
    title: "Superhero Series",
    titles: [
      "Lanterns",
      "The Boys",
      "Peacemaker",
      "Daredevil: Born Again",
      "The Penguin",
      "Gen V",
      "Titans",
      "Doom Patrol",
      "Superman & Lois",
      "The Flash",
    ],
    keywords: ["superhero series","comic book series","dc series","marvel series"],
    type: "series",
  },
  {
    title: "Must-watch Black Shows",
    titles: [
      "All the Queen's Men",
      "The Oval",
      "Ruthless",
      "All American",
      "Power Book III: Raising Kanan",
      "The Chi",
      "Sistas",
      "Snowfall",
      "Bel-Air",
      "Queen Sugar",
    ],
    keywords: ["black series drama","african american series","urban series","hood drama"],
    type: "series",
  },
  {
    title: "Romance",
    keywords: ["romance 2026", "romantic movie", "love story"],
    genre: /romance/i,
  },
  {
    title: "Teen Fantasy",
    titles: [
      "Avatar: The Last Airbender",
      "Stranger Things",
      "IT: Welcome to Derry",
      "Percy Jackson and the Olympians",
      "Wednesday",
      "Shadow and Bone",
      "Locke & Key",
      "The Vampire Diaries",
      "Teen Wolf",
      "Fate: The Winx Saga",
    ],
    keywords: ["teen fantasy series","supernatural teen","magic school series","young adult fantasy"],
    avoidGenre: /animation|anime/i,
  },
  {
    title: "Anime [English Dubbed]",
    titles: [
      "One Piece",
      "Mushoku Tensei: Jobless Reincarnation",
      "Tomb Raider King",
      "Black Torch",
      "Bleach: Thousand-Year Blood War",
      "That Time I Got Reincarnated as a Slime",
      "Re: Zero - Starting Life in Another World",
      "Baki-Dou",
    ],
    keywords: ["anime english dubbed","anime series 2026","shonen anime","isekai anime"],
  },
  {
    title: "K-Drama",
    keywords: ["korean drama", "k-drama 2026", "korean romance"],
    genre: /drama|romance|comedy/i,
    type: "series",
  },
  {
    title: "Comedy",
    keywords: ["comedy 2026", "comedy movie", "funny"],
    genre: /comedy/i,
  },
  {
    title: "Sci-Fi & Adventure",
    keywords: ["sci-fi", "adventure 2026", "space"],
    genre: /sci-fi|adventure/i,
  },
];

const dedupe = (items: CatalogItem[]) => {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Look up one real title and return the closest catalog match.
 * A match must actually resemble the requested name — otherwise the rail would
 * fill with unrelated search noise, so we return null and the rail stays honest.
 */
async function lookupTitle(title: string, section: HomeSection): Promise<CatalogItem | null> {
  const results = await searchCatalog(title, 1).catch(() => [] as CatalogItem[]);
  const wanted = norm(title);
  const candidates = results.filter(
    (r) => !!r.poster && !(section.avoidGenre && section.avoidGenre.test(r.genre ?? "")),
  );
  if (!candidates.length) return null;

  const score = (item: CatalogItem) => {
    const name = norm(item.title);
    let s = 0;
    if (name === wanted) s += 100;
    else if (name.startsWith(wanted) || wanted.startsWith(name)) s += 55;
    else if (name.includes(wanted) || wanted.includes(name)) s += 20;
    else return -1000;
    // A rail that asks for series must not fall back to a movie / music clip.
    if (section.type && item.type !== section.type) return -1000;
    // Long trailing noise ("… (Official Video)") means it is a different work.
    const extra = name.length - wanted.length;
    if (extra > 14) s -= Math.min(80, extra * 2);
    s += Number(item.rating ?? 0) * 3;
    const year = Number(item.year ?? 0);
    if (year >= 2024) s += 10;
    else if (year >= 2015) s += 4;
    return s;
  };

  const best = [...candidates]
    .map((item) => ({ item, s: score(item) }))
    .sort((a, b) => b.s - a.s)[0];
  // Reject weak matches so a rail never shows something unrelated.
  return best && best.s >= 20 ? best.item : null;
}

/** Minimum items a rail should carry before we stop backfilling. */
const TARGET = 18;

/** Live search feed for a section, filtered by the catalog's own metadata. */
async function fetchFeed(section: HomeSection): Promise<CatalogItem[]> {
  const keywords = section.keywords ?? [];
  if (!keywords.length) return [];
  const batches = await Promise.all(
    keywords.flatMap((q) => [
      searchCatalog(q, 1).catch(() => [] as CatalogItem[]),
      searchCatalog(q, 2).catch(() => [] as CatalogItem[]),
    ]),
  );

  const keep = (item: CatalogItem) =>
    !!item.poster &&
    (!section.type || item.type === section.type) &&
    (!section.genre || section.genre.test(item.genre ?? "")) &&
    !(section.avoidGenre && section.avoidGenre.test(item.genre ?? "")) &&
    (!section.minYear || Number(item.year) >= section.minYear);

  const filtered = batches.map((list) => list.filter(keep));

  // Round-robin so every keyword contributes, keeping rails varied and fresh.
  const merged: CatalogItem[] = [];
  for (let i = 0; i < 20; i += 1) {
    for (const list of filtered) if (list[i]) merged.push(list[i]!);
  }
  return dedupe(merged);
}

/**
 * Fill a rail. Curated titles come first (so the well-known line-up is exact),
 * then the rail is topped up from live catalog searches — that way every
 * section is full and refreshes with whatever the catalog is pushing today
 * instead of being a short, static list.
 */
export async function fetchSection(section: HomeSection): Promise<CatalogItem[]> {
  const [curated, feed] = await Promise.all([
    section.titles?.length
      ? Promise.all(section.titles.map((t) => lookupTitle(t, section))).then((r) =>
          r.filter((i): i is CatalogItem => !!i),
        )
      : Promise.resolve([] as CatalogItem[]),
    fetchFeed(section),
  ]);

  return dedupe([...curated, ...feed]).slice(0, Math.max(TARGET, 24));
}

