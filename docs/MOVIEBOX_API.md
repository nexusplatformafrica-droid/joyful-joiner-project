# MovieBox / AoneRoom API — Complete Integration Guide

Everything needed to fetch home rows, search, title details, seasons/episodes,
stream links and subtitles from the MovieBox (aoneroom / inmoviebox) mobile BFF
API — exactly as this site does it. Framework-agnostic: the code below is plain
TypeScript/Node (works in Node 18+, Bun, Deno, Cloudflare Workers with
`nodejs_compat`).

> **Server-side only.** The requests are signed and the provider blocks browser
> origins (CORS). Always call from your backend and expose your own endpoints to
> the frontend.

---

## 1. Hosts

The API is mirrored across several hosts. Iterate them and fail over.

```ts
const HOSTS = [
  "https://api6.aoneroom.com",
  "https://api5.aoneroom.com",
  "https://api4.aoneroom.com",
  "https://api4sg.aoneroom.com",
  "https://api3.aoneroom.com",
  "https://api6sg.aoneroom.com",
  "https://api.inmoviebox.com",
];

// Retry on the next host when you get any of these:
const RETRY_STATUS = new Set([403, 406, 407, 429, 500, 502, 503, 504]);
```

All endpoints live under the `/wefeed-mobile-bff/` path prefix.

---

## 2. Request signing (the hard part)

Every request must carry four generated headers. Without them you get `403`.

### 2.1 Shared secret

```ts
const SECRET = "76iRl07s0xSN9jqmEWAt79EBJZulIQIsV64FZr2O";
```

This is the app's embedded static key (extracted from the Android client). It is
not user-specific.

### 2.2 `x-client-token`

```
x-client-token: `${ts},${md5(reverse(String(ts)))}`
```

`ts` = `Date.now()` (milliseconds). `reverse` = the timestamp digits reversed as
a string. `md5` = lowercase hex.

```ts
import { createHash } from "crypto";
const md5 = (d: string | Buffer) => createHash("md5").update(d).digest("hex");

const ts = Date.now();
const reversed = [...String(ts)].reverse().join("");
const clientToken = `${ts},${md5(reversed)}`;
```

### 2.3 `x-tr-signature`

Format: `${ts}|2|${base64(hmac_md5(key, canonicalString))}`

**Key derivation:** the secret is base64-padded then base64-decoded to raw bytes:

```ts
const padded = SECRET + "=".repeat((4 - (SECRET.length % 4)) % 4);
const key = Buffer.from(padded, "base64");
```

**Canonical string** — 7 lines joined with `\n`:

```
METHOD                 // "GET" / "POST", uppercase
application/json       // Accept
application/json       // Content-Type
<bodyLength>           // byte length of the JSON body, "" when no body
<ts>                   // same ms timestamp used in the header
<bodyHash>             // md5 hex of the FIRST 102400 BYTES of the body, "" when no body
<canonicalUrl>         // "/path?sortedQuery"  (no scheme/host)
```

**Canonical URL rules:** take `pathname`, then append `?` + query params sorted
by key ascending, each repeated value kept in order, joined with `&` as
`key=value` — **not re-encoded**, use the values as they already appear in the
URL. If there is no query, use the pathname alone.

```ts
import { createHmac } from "crypto";

function sortedQuery(url: URL) {
  const keys = [...new Set([...url.searchParams.keys()])].sort();
  const parts: string[] = [];
  for (const k of keys) for (const v of url.searchParams.getAll(k)) parts.push(`${k}=${v}`);
  return parts.join("&");
}

function canonicalString(method: string, url: string, body: string | null, ts: number) {
  const parsed = new URL(url);
  const query = sortedQuery(parsed);
  const canonicalUrl = query ? `${parsed.pathname}?${query}` : parsed.pathname;
  const buf = body ? Buffer.from(body) : null;
  return [
    method.toUpperCase(),
    "application/json",
    "application/json",
    buf ? String(buf.length) : "",
    String(ts),
    buf ? md5(buf.subarray(0, 102_400)) : "",
    canonicalUrl,
  ].join("\n");
}

function signature(method: string, url: string, body: string | null, ts: number) {
  const padded = SECRET + "=".repeat((4 - (SECRET.length % 4)) % 4);
  const key = Buffer.from(padded, "base64");
  const digest = createHmac("md5", key).update(canonicalString(method, url, body, ts)).digest("base64");
  return `${ts}|2|${digest}`;
}
```

⚠️ The `ts` used in `x-client-token`, in the canonical string, and in the
signature prefix must be the **same value** for one request.

### 2.4 `x-client-info` (device identity)

A JSON string describing a fake Android device. Generate it **once per process**
and reuse it — changing it every request looks like abuse and gets throttled.

```ts
const randomHex = (n: number) =>
  Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)]!;

const [osVersion, build] = pick([
  ["11", "RP1A.200720.011"],
  ["12", "S1B.220414.015"],
  ["13", "TQ2A.230405.003"],
] as const);
const model = pick(["23078RKD5C", "2201117TY", "22101316G", "M2012K11AG"] as const);
const versionCode = pick([50020042, 50020044, 50020046] as const);

const userAgent =
  `com.community.oneroom/${versionCode} (Linux; U; Android ${osVersion}; en_US; ${model}; ` +
  `Build/${build}; Cronet/135.0.7012.3)`;

const clientInfo = JSON.stringify({
  package_name: "com.community.oneroom",
  version_name: "3.0.03.0529.03",
  version_code: versionCode,
  os: "android",
  os_version: osVersion,
  install_ch: "ps",
  device_id: randomHex(32),
  install_store: "ps",
  gaid: `${randomHex(8)}-${randomHex(4)}-${randomHex(4)}-${randomHex(4)}-${randomHex(12)}`,
  brand: "Redmi",
  model,
  system_language: "en",
  net: "NETWORK_WIFI",
  region: "US",
  timezone: "Asia/Kolkata",
  sp_code: "40401",
  "X-Play-Mode": "2",
});
```

### 2.5 Full header set

```ts
{
  "user-agent": userAgent,
  "accept": "application/json",
  "content-type": "application/json",
  "x-client-token": `${ts},${md5(reversed)}`,
  "x-tr-signature": signature(method, fullUrl, body, ts),
  "x-client-info": clientInfo,
  "x-client-status": "0",
  "x-forwarded-for": fakeIp,            // e.g. "103.241.12.44" — optional but helps
  "authorization": `Bearer ${token}`,   // only after you have a token (see below)
}
```

### 2.6 Guest token lifecycle

The API mints an anonymous session for you. On any response, read the `x-user`
header:

```ts
const xUser = res.headers.get("x-user");           // JSON string
const token = xUser ? JSON.parse(xUser)?.token : null;
if (token) runtimeToken = token;                   // cache in memory
```

Send it back as `authorization: Bearer <token>` on subsequent requests.
On HTTP `401` or `441`, drop the cached token and let the next request mint a
new one. Bootstrap by calling the home endpoint once before anything else.

---

## 3. Reference transport implementation

```ts
let runtimeToken: string | null = null;
let activeHost = 0;

async function apiRequest(method: "GET" | "POST", path: string, payload?: unknown): Promise<any> {
  const body = payload === undefined ? null : JSON.stringify(payload);

  for (let i = 0; i < HOSTS.length; i++) {
    const idx = (activeHost + i) % HOSTS.length;
    const url = `${HOSTS[idx]}${path}`;
    const ts = Date.now();
    const reversed = [...String(ts)].reverse().join("");

    const headers: Record<string, string> = {
      "user-agent": userAgent,
      accept: "application/json",
      "content-type": "application/json",
      "x-client-token": `${ts},${md5(reversed)}`,
      "x-tr-signature": signature(method, url, body, ts),
      "x-client-info": clientInfo,
      "x-client-status": "0",
      "x-forwarded-for": fakeIp,
    };
    if (runtimeToken) headers["authorization"] = `Bearer ${runtimeToken}`;

    try {
      const res = await fetch(url, { method, headers, body: body ?? null });

      const xUser = res.headers.get("x-user");
      if (xUser) {
        try {
          const t = JSON.parse(xUser)?.token;
          if (typeof t === "string" && t) runtimeToken = t;
        } catch {}
      }
      if (res.status === 401 || res.status === 441) runtimeToken = null;
      if (RETRY_STATUS.has(res.status) || !res.ok) continue;   // try next host

      activeHost = idx;                                        // stick to what works
      const json = await res.json();
      return json?.data ?? json;                               // payload lives under `data`
    } catch {
      continue;
    }
  }
  throw new Error("All MovieBox hosts failed");
}
```

Every endpoint response is shaped `{ code, message, data: {...} }` — always read
`.data`.

---

## 4. Endpoints

### 4.1 Home / browse rows

```
GET /wefeed-mobile-bff/tab-operating?page=1&tabId=0&version=
```

`data.items[]` is a list of heterogeneous blocks:

- `block.banner.banners[]` → hero carousel. Each banner has `subject` (a title
  object) and `image.url` (wide artwork).
- `block.subjects[]` → a normal row. `block.title` is the row heading.
- `block.groups[].subjects[]` → grouped rows (flatten them).

Paginate with `page=2,3,...`. `tabId=0` is "For You"; other tab ids exist per
region.

### 4.2 Search

```
POST /wefeed-mobile-bff/subject-api/search/v2
Content-Type: application/json

{ "keyword": "dune", "page": 1, "perPage": 20, "subjectType": "All", "tabId": "All" }
```

- `perPage` **max is 20** — sending more returns
  `400 {"code":400,"reason":"LIMIT_EXCEED","message":"Up to 20"}`.
- `subjectType`: `"All"` | `"Movie"` | `"TV"`.
- Response: `data.results[].subjects[]` — de-duplicate by `subjectId`.

### 4.3 Title details

```
GET /wefeed-mobile-bff/subject-api/get?subjectId=<ID>
```

`data` is a subject object plus: `description`, `duration`, `countryName`,
`language`, `staffList[].name` (cast/crew), `seNum` (season count), `epNum`
(episode count).

### 4.4 Seasons & episodes

```
GET /wefeed-mobile-bff/subject-api/season-info?subjectId=<ID>
```

Returns `data.seasons[]` (sometimes a bare array). Each entry:

| field | meaning |
| --- | --- |
| `se` / `season` | season number |
| `maxEp` / `allEp` / `episodes` | episode count in that season |

Fallback: if this call fails or returns nothing but `seNum > 0`, assume
`[{ season: 1, episodes: epNum || 1 }]`.

### 4.5 Stream sources

```
GET /wefeed-mobile-bff/subject-api/resource?subjectId=<ID>&page=1&perPage=20
GET /wefeed-mobile-bff/subject-api/resource?subjectId=<ID>&se=<S>&ep=<E>&page=1&perPage=20
```

Omit `se`/`ep` for movies; pass them (1-based) for series episodes.

`data.list[]` entries:

| field | meaning |
| --- | --- |
| `resourceLink` | direct media URL (`.mp4`, sometimes `.m3u8`) on `*.hakunaymatata.com` |
| `resourceId` | id used for the captions endpoint |
| `resolution` | `2160`, `1080`, `720`, `480`… |
| `codecName` | `h264` / `hevc` — **important**, see §6 |
| `size` | bytes |
| `extCaptions[]` | `{ lanName, url }` inline subtitles (often empty) |

Links are time-limited signed URLs — fetch them fresh, don't cache for long.

### 4.6 Subtitles

When `extCaptions` is empty, ask explicitly:

```
GET /wefeed-mobile-bff/subject-api/get-ext-captions?subjectId=<ID>&resourceId=<RESOURCE_ID>
```

Returns `data.extCaptions[] = { lanName, url, ... }`. Files are usually `.srt`
(sometimes `.vtt`), served without CORS headers.

---

## 5. Normalizing a "subject"

Every list/detail endpoint returns the same subject shape. Normalize it once:

```ts
export type CatalogItem = {
  id: string; title: string; type: "movie" | "series";
  year: string | null; poster: string | null; backdrop: string | null;
  rating: string | null; genre: string | null;
};

const cleanTitle = (raw: string) =>
  raw.replace(/\s*\[[^\]]*\]\s*$/g, "").replace(/\s{2,}/g, " ").trim();

export function toItem(s: any): CatalogItem | null {
  if (!s?.subjectId || !s?.title) return null;
  return {
    id: String(s.subjectId),
    title: cleanTitle(String(s.title)),
    type: Number(s.subjectType) === 2 ? "series" : "movie", // 1 = movie, 2 = series
    year: s.releaseDate ? String(s.releaseDate).slice(0, 4) : null,
    poster: s.cover?.url ?? null,
    backdrop: s.stills?.url ?? s.cover?.url ?? null,
    rating: s.imdbRatingValue ? String(s.imdbRatingValue) : null,
    genre: s.genre ? String(s.genre).split(",").slice(0, 3).join(" · ") : null,
  };
}
```

Sort sources so the most compatible + highest quality wins (H.264 before HEVC):

```ts
sources.sort((a, b) => {
  const rank = (c: string | null) => (c && /hevc|h265/i.test(c) ? 1 : 0);
  return rank(a.codec) - rank(b.codec) || b.resolution - a.resolution;
});
```

---

## 6. Playback in the browser

- **Media URLs need proxying.** The CDN (`*.hakunaymatata.com`) does not send
  permissive CORS headers and often rejects browser `Referer`s. Proxy through
  your own server and forward the `Range` header so seeking works.
- **Codec warning.** Many titles are only available as **HEVC/H.265 in MP4**.
  Safari, Edge and HEVC-capable Chrome play these; Firefox and most Linux Chrome
  builds do not. Detect with
  `document.createElement("video").canPlayType('video/mp4; codecs="hvc1"')` and
  tell the user, or prefer `h264` sources when present.
- **Subtitles** must be **WebVTT**. Convert SRT on the proxy.

### 6.1 Media proxy (Range-aware)

```ts
// GET /api/stream?url=<encoded media url>
const ALLOWED_HOSTS = [".hakunaymatata.com", ".aoneroom.com", ".inmoviebox.com"];

export async function streamProxy(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let parsed: URL;
  try { parsed = new URL(target); } catch { return new Response("Invalid url", { status: 400 }); }
  // SSRF guard — never proxy arbitrary hosts
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.some((h) => parsed.hostname.endsWith(h)))
    return new Response("Host not allowed", { status: 403 });

  const range = request.headers.get("range");
  const upstream = await fetch(parsed.toString(), { headers: range ? { range } : {} });

  const headers = new Headers();
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "etag"]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  headers.set("cache-control", "public, max-age=3600");
  headers.set("access-control-allow-origin", "*");
  return new Response(upstream.body, { status: upstream.status, headers });
}
```

Then use `<video src={`/api/stream?url=${encodeURIComponent(source.url)}`} />`.

### 6.2 Subtitle proxy (SRT → VTT)

```ts
// GET /api/subtitle?url=<encoded caption url>
function srtToVtt(input: string) {
  if (input.trimStart().startsWith("WEBVTT")) return input;
  return `WEBVTT\n\n${input.replace(/\r/g, "").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2")}`;
}

export async function subtitleProxy(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  // ...same validation as above...
  const upstream = await fetch(target!);
  if (!upstream.ok) return new Response("Subtitle unavailable", { status: 502 });
  return new Response(srtToVtt(await upstream.text()), {
    headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
```

Use it as `<track kind="subtitles" src={`/api/subtitle?url=${encodeURIComponent(c.url)}`} srcLang="en" label={c.lanName} />`.

---

## 7. End-to-end flows

**Movie**
1. `search/v2` (or home rows) → pick `subjectId`
2. `subject-api/get?subjectId=…` → metadata
3. `subject-api/resource?subjectId=…&page=1&perPage=20` → sources
4. `get-ext-captions` if `extCaptions` empty
5. play `resourceLink` via your `/api/stream` proxy

**Series**
1. `subject-api/get` → confirms `subjectType === 2`
2. `subject-api/season-info?subjectId=…` → seasons + episode counts
3. `subject-api/resource?subjectId=…&se=1&ep=3&…` → sources for that episode
4. captions + proxy playback, same as above

---

## 8. Errors & gotchas

| Symptom | Cause / fix |
| --- | --- |
| `403` on every host | Signature wrong — most often a mismatched `ts` between header and canonical string, or the query wasn't sorted. |
| `400 LIMIT_EXCEED "Up to 20"` | `perPage > 20` on search. |
| `401` / `441` | Token expired — clear it, retry (a fresh one arrives via `x-user`). |
| `429` | Too many requests / identity churn — reuse one `x-client-info`, add backoff. |
| Empty `data.list` | No sources for that episode, or `se`/`ep` numbers out of range. |
| Video loads but black screen | HEVC in an unsupported browser. |
| Subtitles don't show | Not converted to WebVTT, or fetched cross-origin without the proxy. |
| Signed link 403s later | Media URLs expire; re-fetch `resource`. |

Recommended caching: home `5 min`, search `2 min`, details `10 min`,
sources `≤ 1 min` (signed URLs), captions `1 h`.

---

## 9. Minimal drop-in module

Copy `src/lib/moviebox.server.ts` from this project — it is a single dependency-free
file (only Node's `crypto`) exporting:

```ts
fetchHome(): Promise<{ hero: CatalogItem[]; rows: { title: string; items: CatalogItem[] }[] }>
searchCatalog(keyword: string, page?: number): Promise<CatalogItem[]>
fetchDetails(subjectId: string): Promise<TitleDetails>
fetchSources(subjectId: string, season?: number, episode?: number): Promise<StreamSource[]>
```

Add the two proxy routes from §6 and any frontend can consume it.

---

## 10. Legal

This documents an undocumented private API of a third-party app. It is provided
for interoperability/research. You are responsible for complying with the
provider's terms and with copyright law in your jurisdiction.
