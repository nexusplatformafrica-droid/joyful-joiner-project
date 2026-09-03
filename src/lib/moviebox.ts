import { base64ToBytes, bytesToBase64, hmacMd5, md5Hex } from "./md5";

const SECRET = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";

const HOSTS = [
  "https://api7.aoneroom.com",
  "https://api8.aoneroom.com",
  "https://api6.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api6sg.aoneroom.com",
  "https://api.inmoviebox.com",
];

/** API prefix required on every catalog/resource/download path. */
export const API_PREFIX = "/wefeed-mobile-bff";

const RETRY_STATUS = new Set([403, 406, 407, 429, 500, 502, 503, 504]);

const encoder = new TextEncoder();
const isBrowser = typeof window !== "undefined" && typeof document !== "undefined";

const md5 = (data: string | Uint8Array) => md5Hex(data);

/**
 * Canonical query per APK 4.0.02.0831.02: pairs are URL-decoded, duplicate
 * names overwrite (the client uses a map), then sorted by decoded name.
 */
function sortedQuery(url: URL) {
  const decode = (value: string) => {
    try {
      return decodeURIComponent(value.replace(/\+/g, " "));
    } catch {
      return value;
    }
  };
  const values = new Map<string, string>();
  for (const part of url.search.slice(1).split("&")) {
    if (!part) continue;
    const eq = part.indexOf("=");
    values.set(decode(eq < 0 ? part : part.slice(0, eq)), decode(eq < 0 ? "" : part.slice(eq + 1)));
  }
  return [...values.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function canonicalString(method: string, url: string, body: string | null, ts: number) {
  const parsed = new URL(url);
  const query = sortedQuery(parsed);
  const canonicalUrl = query ? `${parsed.pathname}?${query}` : parsed.pathname;
  // UTF-16 string length (Java/Kotlin semantics) and a 102,400-character —
  // not byte — body prefix for the hash.
  const bodyHash = body ? md5(encoder.encode(body.slice(0, 102_400))) : "";
  const bodyLength = body ? String(body.length) : "";
  return [
    method.toUpperCase(),
    "application/json",
    "application/json",
    bodyLength,
    String(ts),
    bodyHash,
    canonicalUrl,
  ].join("\n");
}


function signature(method: string, url: string, body: string | null, ts: number) {
  const padded = SECRET + "=".repeat((4 - (SECRET.length % 4)) % 4);
  const key = base64ToBytes(padded);
  const digest = bytesToBase64(hmacMd5(key, encoder.encode(canonicalString(method, url, body, ts))));
  return `${ts}|2|${digest}`;
}


function randomHex(len: number) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function pick<T>(list: readonly T[]) {
  return list[Math.floor(Math.random() * list.length)]!;
}

type Identity = { userAgent: string; clientInfo: string; ip: string };

let identity: Identity | null = null;
let runtimeToken: string | null = null;
let activeHost = 0;

function getIdentity(): Identity {
  if (identity) return identity;
  const android = pick([
    ["11", "RP1A.200720.011"],
    ["12", "S1B.220414.015"],
    ["13", "TQ2A.230405.003"],
  ] as const);
  const model = pick(["23078RKD5C", "2201117TY", "22101316G", "M2012K11AG"] as const);
  // APK 4.0.02.0831.02
  const versionCode = 50020126;
  identity = {
    userAgent: `com.community.oneroom/${versionCode} (Linux; U; Android ${android[0]}; en_US; ${model}; Build/${android[1]}; Cronet/135.0.7012.3)`,
    clientInfo: JSON.stringify({
      package_name: "com.community.oneroom",
      version_name: "4.0.02.0831.02",
      version_code: versionCode,

      os: "android",
      os_version: android[0],
      install_ch: "ps",
      device_id: randomHex(32),
      install_store: "ps",
      gaid: `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`,
      brand: "Redmi",
      model,
      system_language: "en",
      net: "NETWORK_WIFI",
      region: "US",
      timezone: "America/New_York",
      sp_code: "40401",
      "X-Play-Mode": "2",
    }),
    // US egress ranges: the catalog serves its US home layout for these.
    ip: `${pick(["24.60", "66.176", "72.229", "98.115", "173.68"] as const)}.${
      1 + Math.floor(Math.random() * 253)
    }.${1 + Math.floor(Math.random() * 253)}`,
  };
  return identity;
}

let initPromise: Promise<void> | null = null;

async function ensureToken() {
  if (runtimeToken) return;
  if (!initPromise) {
    initPromise = rawRequest("GET", "/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=")
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        initPromise = null;
      });
  }
  await initPromise;
}

export async function request(method: "GET" | "POST", path: string, payload?: unknown): Promise<any> {
  await ensureToken();
  try {
    return await rawRequest(method, path, payload);
  } catch {
    // Every host refused — most often a stale/expired runtime token. Drop it,
    // re-handshake once and replay the call before giving up.
    runtimeToken = null;
    await ensureToken();
    return rawRequest(method, path, payload);
  }
}


async function rawRequest(method: "GET" | "POST", path: string, payload?: unknown): Promise<any> {
  const body = payload === undefined ? null : JSON.stringify(payload);
  const id = getIdentity();

  for (let i = 0; i < HOSTS.length; i += 1) {
    const idx = (activeHost + i) % HOSTS.length;
    const url = `${HOSTS[idx]}${path}`;
    const ts = Date.now();
    const reversed = [...String(ts)].reverse().join("");

    const headers: Record<string, string> = {
      accept: "application/json",
      "content-type": "application/json",
      "x-client-token": `${ts},${md5(reversed)}`,
      "x-tr-signature": signature(method, url, body, ts),
      "x-client-info": id.clientInfo,
      "x-client-status": "0",
    };
    // Browsers forbid setting these; only send them from a server runtime.
    if (!isBrowser) {
      headers["user-agent"] = id.userAgent;
      headers["x-forwarded-for"] = id.ip;
    }
    if (runtimeToken) headers["authorization"] = `Bearer ${runtimeToken}`;


    try {
      const res = await fetch(url, { method, headers, body: body ?? null });
      const xUser = res.headers.get("x-user");
      if (xUser) {
        try {
          const token = JSON.parse(xUser)?.token;
          if (typeof token === "string" && token) runtimeToken = token;
        } catch {
          /* ignore malformed header */
        }
      }
      if (res.status === 441 || res.status === 401) runtimeToken = null;
      if (RETRY_STATUS.has(res.status) || !res.ok) continue;
      activeHost = idx;
      const json = (await res.json()) as any;
      return json?.data ?? json;
    } catch {
      continue;
    }
  }
  throw new Error("Unable to reach the catalog right now. Please try again.");
}

export type CatalogItem = {
  id: string;
  title: string;
  type: "movie" | "series";
  year: string | null;
  poster: string | null;
  backdrop: string | null;
  rating: string | null;
  genre: string | null;
  /** Upcoming release date (Coming Soon rail), ISO-ish string from the catalog. */
  appointmentDate?: string | null;
  /** How many users pre-booked an upcoming title. */
  booked?: number | null;
};

/**
 * The catalog serves original artwork that can be several megabytes per file.
 * Its image CDN supports on-the-fly resizing, so request display-sized images
 * instead. The transformed URL is stable and can stay in the browser/CDN cache.
 */
function artworkUrl(value: unknown, width: number): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("aoneroom.com") && !url.searchParams.has("x-oss-process")) {
      url.searchParams.set("x-oss-process", `image/resize,w_${width}/quality,q_82`);
    }
    return url.toString();
  } catch {
    return value;
  }
}

const cleanTitle = (raw: string) =>
  raw
    .replace(/\s*\[[^\]]*\]\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

export function toItem(subject: any): CatalogItem | null {
  if (!subject?.subjectId || !subject?.title) return null;
  return {
    id: String(subject.subjectId),
    title: cleanTitle(String(subject.title)),
    type: Number(subject.subjectType) === 2 ? "series" : "movie",
    year: subject.releaseDate ? String(subject.releaseDate).slice(0, 4) : null,
    poster: artworkUrl(subject.cover?.url, 400),
    backdrop: artworkUrl(subject.stills?.url ?? subject.cover?.url, 1440),
    rating: subject.imdbRatingValue ? String(subject.imdbRatingValue) : null,
    genre: subject.genre ? String(subject.genre).split(",").slice(0, 3).join(" · ") : null,
    appointmentDate: subject.appointmentDate ? String(subject.appointmentDate) : null,
    booked: typeof subject.viewers === "number" ? subject.viewers : null,
  };
}


export async function fetchHome() {
  const data = await request("GET", "/wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=");
  const items: any[] = Array.isArray(data?.items) ? data.items : [];

  const hero: CatalogItem[] = [];
  const rows: { title: string; items: CatalogItem[] }[] = [];
  // Real upstream trending rail ("🔥Trending Now") and the appointment list.
  let trending: CatalogItem[] = [];
  let comingSoon: CatalogItem[] = [];
  const seen = new Set<string>();

  for (const block of items) {
    if (block?.banner?.banners) {
      for (const banner of block.banner.banners) {
        const item = toItem(banner.subject);
        if (item && banner.image?.url) {
          hero.push({ ...item, backdrop: artworkUrl(banner.image.url, 1440) });
        }
      }
      continue;
    }
    const subjects: CatalogItem[] = [];
    const push = (subject: any) => {
      const item = toItem(subject);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        subjects.push(item);
      }
    };
    if (Array.isArray(block?.subjects)) block.subjects.forEach(push);
    if (Array.isArray(block?.groups)) {
      for (const group of block.groups) if (Array.isArray(group?.subjects)) group.subjects.forEach(push);
    }
    const title = String(block?.title || "Popular now");
    if (block?.type === "APPOINTMENT_LIST" || /coming soon/i.test(title)) {
      if (subjects.length) comingSoon = [...comingSoon, ...subjects];
      continue;
    }
    if (/trending/i.test(title) && subjects.length >= 4 && trending.length < 18) {
      trending = [...trending, ...subjects];
    }
    if (subjects.length >= 4) {
      rows.push({ title, items: subjects.slice(0, 18) });
    }
  }

  return {
    hero: hero.slice(0, 5),
    rows: rows.slice(0, 10),
    trending: trending.slice(0, 20),
    comingSoon: comingSoon.slice(0, 20),
  };
}

/** Emoji / decoration stripped rail title. */
const railTitle = (raw: string) =>
  raw
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();

/**
 * Every real, populated rail of one upstream tab (0 = home, 2 = movies,
 * 5 = TV series). Banners, filters and empty promo blocks are skipped, so what
 * comes back is exactly the catalog's own live sections with live items.
 */
export async function fetchTabRows(tabId: number) {
  const data = await request(
    "GET",
    `/wefeed-mobile-bff/tab-operating?page=1&tabId=${tabId}&version=`,
  ).catch(() => null);
  const blocks: any[] = Array.isArray(data?.items) ? data.items : [];
  const rows: { title: string; items: CatalogItem[] }[] = [];
  const takenTitles = new Set<string>();

  for (const block of blocks) {
    if (block?.banner || block?.type === "FILTER" || block?.type === "BANNER") continue;
    const seen = new Set<string>();
    const items: CatalogItem[] = [];
    const push = (subject: any) => {
      const item = toItem(subject);
      if (item?.poster && !seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    };
    if (Array.isArray(block?.subjects)) block.subjects.forEach(push);
    if (Array.isArray(block?.groups)) {
      for (const group of block.groups)
        if (Array.isArray(group?.subjects)) group.subjects.forEach(push);
    }
    if (items.length < 4) continue;
    const title = railTitle(String(block?.title || ""));
    if (!title || /appointment|coming soon/i.test(title)) continue;
    const key = title.toLowerCase();
    if (takenTitles.has(key)) {
      // Upstream repeats some rails; merge instead of showing them twice.
      const existing = rows.find((r) => r.title.toLowerCase() === key)!;
      const ids = new Set(existing.items.map((i) => i.id));
      existing.items = [...existing.items, ...items.filter((i) => !ids.has(i.id))].slice(0, 24);
      continue;
    }
    takenTitles.add(key);
    rows.push({ title, items: items.slice(0, 24) });
  }
  return rows;
}

/**
 * The catalog's real, live "most trending" line-up: the home trending rail plus
 * the movie and TV tabs' own trending / top-this-week rails, in that order.
 */
export async function fetchMostTrending(): Promise<CatalogItem[]> {
  const [home, movies, series] = await Promise.all([
    fetchTabRows(0),
    fetchTabRows(2),
    fetchTabRows(5),
  ]);
  const pick = (rows: { title: string; items: CatalogItem[] }[], re: RegExp) =>
    rows.filter((r) => re.test(r.title)).flatMap((r) => r.items);

  const ordered = [
    ...pick(home, /trending/i),
    ...pick(series, /top series this week|trending/i),
    ...pick(movies, /trending|top movies/i),
    ...pick(home, /cinema|hot short tv/i),
  ];
  const seen = new Set<string>();
  return ordered.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true))).slice(0, 24);
}

/** All live catalog rails from the movie + TV tabs, for the home page. */
export async function fetchLiveRails() {
  const [movies, series] = await Promise.all([fetchTabRows(2), fetchTabRows(5)]);
  const out: { title: string; items: CatalogItem[] }[] = [];
  const seen = new Set<string>();
  // Interleave TV and movie rails so the page alternates instead of grouping.
  for (let i = 0; i < Math.max(series.length, movies.length); i += 1) {
    for (const row of [series[i], movies[i]]) {
      if (!row) continue;
      const key = row.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(row);
    }
  }
  return out;
}



export async function searchCatalog(keyword: string, page = 1) {
  const data = await request("POST", "/wefeed-mobile-bff/subject-api/search/v2", {
    keyword,
    page,
    perPage: 20,
    subjectType: "All",
    tabId: "All",
  });
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const result of data?.results ?? []) {
    for (const subject of result?.subjects ?? []) {
      const item = toItem(subject);
      if (item && !seen.has(item.id)) {
        seen.add(item.id);
        out.push(item);
      }
    }
  }
  return out;
}

export type CastMember = { name: string; character: string | null; avatar: string | null };

export type TitleDetails = CatalogItem & {
  description: string | null;
  duration: string | null;
  country: string | null;
  language: string | null;
  cast: CastMember[];
  seasons: { season: number; episodes: number }[];
};

export async function fetchDetails(subjectId: string): Promise<TitleDetails> {
  const data = await request("GET", `/wefeed-mobile-bff/subject-api/get?subjectId=${subjectId}`);
  const base = toItem(data);
  if (!base) throw new Error("Title not found");

  let seasons: { season: number; episodes: number }[] = [];
  if (base.type === "series") {
    try {
      const info = await request(
        "GET",
        `/wefeed-mobile-bff/subject-api/season-info?subjectId=${subjectId}`,
      );
      const list: any[] = Array.isArray(info?.seasons) ? info.seasons : Array.isArray(info) ? info : [];
      seasons = list
        .map((s) => ({
          season: Number(s?.se ?? s?.season ?? 0),
          episodes: Number(
            s?.maxEp ??
              s?.allEp ??
              s?.episodes ??
              (Array.isArray(s?.resolutions)
                ? Math.max(0, ...s.resolutions.map((r: any) => Number(r?.epNum) || 0))
                : 0),
          ),
        }))
        .filter((s) => s.season > 0 && s.episodes > 0);
    } catch {
      seasons = [];
    }
    if (!seasons.length && Number(data?.seNum) > 0) {
      seasons = [{ season: 1, episodes: Number(data?.epNum) || 1 }];
    }
  }

  return {
    ...base,
    description: data?.description ? String(data.description) : null,
    duration: data?.duration ? String(data.duration) : null,
    country: data?.countryName ? String(data.countryName) : null,
    language: data?.language ? String(data.language) : null,
    cast: (data?.staffList ?? [])
      .filter((s: any) => typeof s?.name === "string" && s.name)
      .map((s: any) => ({
        name: String(s.name),
        character: s.character ? String(s.character) : null,
        avatar: s.avatarUrl ? String(s.avatarUrl) : null,
      }))
      .slice(0, 16),
    seasons,
  };
}

export type StreamSource = {
  id: string;
  url: string;
  resolution: number;
  codec: string | null;
  bytes: number;
  size: string | null;
  captions: { label: string; url: string }[];
};

/** Human file size — MB under 1 GB, GB above. */
const fmtBytes = (bytes: number) => {
  if (!bytes) return null;
  const mb = bytes / 1_048_576;
  return mb < 1024 ? `${mb.toFixed(mb < 10 ? 1 : 0)} MB` : `${(mb / 1024).toFixed(2)} GB`;
};

const toSource = (entry: any): StreamSource => ({
  id: String(entry.resourceId ?? entry.resourceLink),
  url: String(entry.resourceLink),
  resolution: Number(entry.resolution) || 0,
  codec: entry.codecName ? String(entry.codecName) : null,
  bytes: Number(entry.size) || 0,
  size: fmtBytes(Number(entry.size) || 0),
  captions: (entry.extCaptions ?? [])
    .filter((c: any) => typeof c?.url === "string" && c.url)
    .map((c: any) => ({ label: String(c.lanName ?? "Subtitle"), url: String(c.url) })),
});


export async function fetchSources(subjectId: string, season = 0, episode = 0) {
  const isEpisode = season > 0 && episode > 0;
  // APK 4.0.02.0831.02 exposes resource/v2 with se/epFrom/epTo (the old `ep`
  // name is kept only as a legacy fallback below).
  const V2 = `${API_PREFIX}/subject-api/resource/v2`;
  const V1 = `${API_PREFIX}/subject-api/resource`;
  const range = isEpisode ? `&se=${season}&epFrom=${episode}&epTo=${episode}` : "";
  const page = isEpisode ? Math.max(1, Math.ceil(episode / 20)) : 1;
  const base = `${V2}?subjectId=${subjectId}${range}&perPage=20`;

  const data = await request("GET", `${base}&page=${page}`).catch(() => null as any);


  // The API answers with one resolution at a time; ask for each advertised one.
  const offered: number[] = Array.isArray(data?.collectionResolutions)
    ? data.collectionResolutions.map((r: any) => Number(r?.resolution)).filter((r: number) => r > 0)
    : [];
  const baseResolution = Number(data?.resolution) || 0;
  const extra = [...new Set(offered)].filter((r) => r !== baseResolution);

  const lists: any[][] = [Array.isArray(data?.list) ? data.list : []];
  const others = await Promise.all(
    extra.map((resolution) =>
      request("GET", `${base}&page=${page}&resolution=${resolution}`)
        .then((res: any) => (Array.isArray(res?.list) ? res.list : []))
        .catch(() => [] as any[]),
    ),
  );
  lists.push(...others);

  // Some titles only answer on page 1 without the season/episode filter, so keep
  // widening the query until something playable comes back.
  if (!lists.some((l) => l.length)) {
    const fallbacks = isEpisode
      ? [
          `${base}&page=1`,
          `${V1}?subjectId=${subjectId}&se=${season}&ep=${episode}&page=1&perPage=20`,
          `${V2}?subjectId=${subjectId}&page=1&perPage=20`,
          `${V1}?subjectId=${subjectId}&page=1&perPage=20`,
        ]
      : [
          `${V1}?subjectId=${subjectId}&page=1&perPage=20`,
          `${V2}?subjectId=${subjectId}&se=1&epFrom=1&epTo=1&page=1&perPage=20`,
          `${V2}?subjectId=${subjectId}&page=2&perPage=20`,
        ];

    for (const path of fallbacks) {
      const res = await request("GET", path).catch(() => null as any);
      const list = Array.isArray(res?.list) ? res.list : [];
      if (list.length) {
        lists.push(list);
        break;
      }
    }
  }

  const strict = (entry: any) =>
    !isEpisode || (Number(entry?.se) === season && Number(entry?.ep) === episode);
  // Prefer exact episode matches; if none exist, accept whatever the API returned.
  const anyStrict = lists.some((list) => list.some((e) => e?.resourceLink && strict(e)));
  const matchesEpisode = (entry: any) => (anyStrict ? strict(entry) : true);

  // Keep every real resource the API exposes. Some titles publish multiple
  // encodes at the same resolution (different codecs/files), and the download
  // sheet must not hide those alternatives.
  const found = new Map<string, StreamSource>();
  for (const list of lists) {
    for (const entry of list) {
      if (typeof entry?.resourceLink !== "string" || !entry.resourceLink) continue;
      if (!matchesEpisode(entry)) continue;
      const source = toSource(entry);
      found.set(source.id, source);
    }
  }

  const codecRank = (source: StreamSource) =>
    source.codec && /hevc|h265/i.test(source.codec) ? 1 : 0;
  const sources = [...found.values()].sort(
    (a, b) => codecRank(a) - codecRank(b) || b.resolution - a.resolution || b.bytes - a.bytes,
  );



  if (sources.length && !sources[0]!.captions.length) {
    try {
      const captions = await request(
        "GET",
        `/wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=${subjectId}&resourceId=${sources[0]!.id}`,
      );
      const parsed = (captions?.extCaptions ?? [])
        .filter((c: any) => typeof c?.url === "string" && c.url)
        .map((c: any) => ({ label: String(c.lanName ?? "Subtitle"), url: String(c.url) }));
      for (const source of sources) if (!source.captions.length) source.captions = parsed;
    } catch {
      /* subtitles are optional */
    }
  }

  return sources;
}

/** Placeholder used when the upstream catalog is unreachable during render. */
export function unavailableTitle(id: string): TitleDetails & { unavailable: true } {
  return {
    id,
    title: "Loading…",
    type: "movie",
    year: null,
    poster: null,
    backdrop: null,
    rating: null,
    genre: null,
    description: null,
    duration: null,
    country: null,
    language: null,
    cast: [],
    seasons: [],
    unavailable: true,
  };
}

/**
 * Related titles for the watch page.
 *
 * Genre keyword searches alone return junk (titles literally named "Action",
 * "Drama"), so results are filtered to real titles that share a genre with the
 * current one, deduped by normalised name, and ranked by rating.
 */
export async function fetchRelated(details: {
  id: string;
  title: string;
  genre: string | null;
  type: "movie" | "series";
}): Promise<CatalogItem[]> {
  const genres = (details.genre ?? "")
    .split(/[·,/|]/)
    .map((g) => g.trim())
    .filter(Boolean);

  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/\[[^\]]*\]/g, "")
      .replace(/\bs\d+\s*-\s*s?\d+\b/g, "")
      .replace(/\bseason\s*\d+\b/g, "")
      .replace(/[^a-z0-9]+/g, "");

  const kind = details.type === "series" ? "series" : "movies";
  // Seed the query set with the title's own words so two titles that share a
  // genre don't come back with an identical "You may also like" rail.
  const titleWords = details.title
    .replace(/\[[^\]]*\]/g, " ")
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);

  const terms = new Set<string>();
  for (const g of genres.slice(0, 3)) {
    terms.add(`${g} ${kind}`);
    for (const w of titleWords) terms.add(`${w} ${g}`);
  }
  if (genres.length > 1) terms.add(`${genres.slice(0, 2).join(" ")} ${kind}`);
  for (const w of titleWords) terms.add(w);
  if (!terms.size) terms.add(details.title);

  const pages = await Promise.all(
    [...terms].map((q) => searchCatalog(q, 1).catch(() => [] as CatalogItem[])),
  );

  const generic = new Set(genres.map(norm));
  const BROAD = new Set(["drama", "action", "comedy", "family", "adventure", "kids"]);
  const specific = genres.map((g) => g.toLowerCase()).filter((g) => !BROAD.has(g));
  const seenId = new Set<string>([details.id]);
  const seenName = new Set<string>([norm(details.title)]);

  const merged: CatalogItem[] = [];
  const max = Math.max(...pages.map((p) => p.length), 0);
  for (let i = 0; i < max; i++) {
    for (const page of pages) {
      const item = page[i];
      if (!item) continue;
      const name = norm(item.title);
      if (seenId.has(item.id) || seenName.has(name)) continue;
      if (!item.poster) continue;
      if (generic.has(name) || name.length < 3) continue; // "Action", "Drama", …
      if (item.type !== details.type) continue; // movies next to movies, series next to series
      // Same franchise ("Peaky Blinders S6" next to "Peaky Blinders") is not a
      // recommendation — drop anything whose name contains the source name.
      const self = norm(details.title);
      if (name.includes(self) || self.includes(name)) continue;
      const itemGenres = (item.genre ?? "").toLowerCase();
      // Match on the most specific genre available (Crime, Romance, Horror…)
      // instead of a catch-all like Drama, so rails stay on-topic.
      const shares = specific.length
        ? specific.some((g) => itemGenres.includes(g))
        : !genres.length || genres.some((g) => itemGenres.includes(g.toLowerCase()));
      if (!shares) continue;
      seenId.add(item.id);
      seenName.add(name);
      merged.push(item);
    }
  }

  // Stable per-title rotation: same title always gets the same rail, different
  // titles in the same genre start from a different offset.
  let seed = 0;
  for (const ch of details.id) seed = (seed * 31 + ch.charCodeAt(0)) % 100000;
  const ranked = merged.sort((a, b) => Number(b.rating ?? 0) - Number(a.rating ?? 0));
  const offset = ranked.length > 24 ? seed % Math.max(1, ranked.length - 18) : 0;
  return ranked.slice(offset, offset + 18);
}

/* ------------------------------------------------------------------------- *
 * Real playback streams
 *
 * The `resource` endpoint's `resourceLink` is a short promo/ad MP4 (~5 MB) for
 * most titles — that is why playback used to show "only ads". The genuine
 * movie lives on the provider's CloudFront DASH origin and is unlocked by the
 * signed policy that `play-info` returns as a cookie string. CloudFront also
 * accepts those three values as query parameters, so the browser can stream
 * the segments straight from the CDN (zero origin bandwidth).
 * ------------------------------------------------------------------------- */

export type Playback = {
  /** Signed DASH manifest URL (real movie). */
  manifest: string;
  /** Signed query string that every segment request must carry. */
  query: string;
  durationSeconds: number;
  /** Adaptive qualities carried by the real DASH movie stream. */
  resolutions: number[];
  codec: string | null;
};

const cfDecode = (value: string) =>
  atob(value.replace(/-/g, "+").replace(/_/g, "=").replace(/~/g, "/"));

export async function fetchPlayback(
  subjectId: string,
  season = 0,
  episode = 0,
  _resourceId?: string,
): Promise<Playback | null> {
  // The provider only returns the signed DASH stream when se/ep are present:
  // movies use 0/0, episodes use their real 1-based numbers. Asking by
  // resourceId alone returns an empty stream list (which is what made playback
  // fall back to the ~5 MB promo/"upgrade" clip).
  const se = season > 0 ? season : 0;
  const ep = se > 0 ? Math.max(1, episode) : 0;
  const query = `subjectId=${subjectId}&se=${se}&ep=${ep}`;
  const data = await request("GET", `/wefeed-mobile-bff/subject-api/play-info?${query}`).catch(
    () => null as any,
  );
  const stream = Array.isArray(data?.streams) ? data.streams[0] : null;

  const cookie: string = stream?.signCookie ?? "";
  if (!cookie) return null;

  const parts = Object.fromEntries(
    cookie
      .split(";")
      .filter(Boolean)
      .map((piece: string) => {
        const i = piece.indexOf("=");
        return [piece.slice(0, i).trim(), piece.slice(i + 1)] as [string, string];
      }),
  );
  const policy = parts["CloudFront-Policy"];
  const signature = parts["CloudFront-Signature"];
  const keyPairId = parts["CloudFront-Key-Pair-Id"];
  if (!policy || !signature || !keyPairId) return null;

  let resource: string;
  try {
    resource = JSON.parse(cfDecode(policy)).Statement[0].Resource as string;
  } catch {
    return null;
  }
  if (!resource.startsWith("https://")) return null;

  const signed = `Policy=${policy}&Signature=${signature}&Key-Pair-Id=${keyPairId}`;
  // `stream.url` is now a shared promo/"upgrade your app" MP4 for every title,
  // so it must never be used as the media source. The real movie is the signed
  // DASH manifest under the policy's own resource path; only trust `stream.url`
  // when it actually points at a manifest.
  const provided =
    typeof stream?.url === "string" && stream.url.startsWith("https://") && /\.mpd(\?|$)/.test(stream.url)
      ? stream.url
      : null;
  const base = provided ?? `${resource.replace(/\*$/, "")}index_web.mpd`;

  return {
    manifest: `${base.split("?")[0]}?${signed}`,
    query: signed,

    durationSeconds: Number(stream?.duration) || 0,
    resolutions: String(stream?.resolutions ?? "")
      .split(",")
      .map(Number)
      .filter((resolution) => resolution > 0),
    codec: stream?.codecName ? String(stream.codecName) : null,
  };
}
