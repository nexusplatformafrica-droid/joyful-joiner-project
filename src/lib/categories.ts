/** Sidebar / top-bar sections. Each maps to a LUOFILM search keyword. */
export type SiteCategory = {
  slug: string;
  short: string;
  label: string;
  icon: string;
  keyword: string;
  /** Optional extra search keywords merged into the category feed. */
  keywords?: string[];
  /** Age-restricted section: hidden behind an 18+ confirmation gate. */
  adult?: boolean;
  type?: "movie" | "series";
};

/** Titles we never want to surface in family-facing sections. */
const ADULT = /(the animation|anime edition|hentai|ecchi|uncensored|orgasm|boobs|nudity|erotic|sex|porn|xxx|lewd|milf|18\+)/i;

const ADULT_GENRE = /(erotic|hot|adult|18\+)/i;

export const isAdultTitle = (title: string) => ADULT.test(title);

/** True when a catalog entry is mature by title or by genre tag. */
export const isAdultItem = (item: { title: string; genre?: string | null }) =>
  ADULT.test(item.title) || (!!item.genre && ADULT_GENRE.test(item.genre));

export const CATEGORIES: SiteCategory[] = [
  { slug: "home", short: "Home", label: "Home", icon: "home", keyword: "" },
  { slug: "trending", short: "Trending", label: "Trending now", icon: "trending", keyword: "popular" },
  { slug: "latest", short: "Latest", label: "Latest releases", icon: "latest", keyword: "2026" },
  {
    slug: "recommended",
    short: "For you",
    label: "Recommended for you",
    icon: "recommended",
    keyword: "best",
  },
  { slug: "top-50", short: "Top 50", label: "Top 50", icon: "top-50", keyword: "top" },
  {
    slug: "movies",
    short: "Movies",
    label: "Movies",
    icon: "movies",
    keyword: "action",
    type: "movie",
  },
  {
    slug: "drama",
    short: "Series",
    label: "Series & drama",
    icon: "drama",
    keyword: "drama",
    type: "series",
  },
  {
    slug: "love-story",
    short: "Romance",
    label: "Love stories",
    icon: "love-story",
    keyword: "best romance movie",
    keywords: ["best romance movie", "romance 2026", "romantic comedy", "love story"],
  },
  {
    slug: "animation",
    short: "Animation",
    label: "Animation",
    icon: "animation",
    keyword: "animated movie",
    keywords: ["animated movie", "animation 2026", "cartoon", "animated series"],
  },
  {
    slug: "short-series",
    short: "Short series",
    label: "Short series",
    icon: "short-series",
    keyword: "mini series",
    type: "series",
  },
  {
    slug: "hot-18",
    short: "18+ Hot",
    label: "18+ Hot",
    icon: "love-story",
    keyword: "adult",
    keywords: ["adult animation", "erotic", "uncensored", "anime edition"],
    adult: true,
  },
  { slug: "old-skull", short: "Classics", label: "Classics", icon: "old-skull", keyword: "classic" },
  { slug: "live-tv", short: "Thriller", label: "Thriller", icon: "live-tv", keyword: "thriller" },
];

export const CONTENT_CATEGORIES = CATEGORIES.filter((c) => c.slug !== "home");

export const findCategory = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
