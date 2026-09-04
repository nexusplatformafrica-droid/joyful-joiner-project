/**
 * VJ identity helpers.
 *
 * VJ names are typed by hand in the admin panel, so the same person shows up as
 * "vj junior", "Junior", "VJ  JUNIOR" and so on. We normalise every spelling
 * onto one key, one display name and one colour so posters and rails agree.
 */

export type VjInfo = {
  /** Canonical lowercase key used for filtering. */
  key: string;
  /** Display label, always prefixed with "VJ". */
  name: string;
  /** Tailwind gradient stops for the poster tag / rail tile. */
  gradient: string;
  /** Soft overlay used on the rail tile. */
  overlay: string;
  /** Hover glow used on the rail tile. */
  glow: string;
};

const PALETTE = [
  {
    gradient: "from-fuchsia-500 via-purple-500 to-indigo-500",
    overlay: "from-purple-950/90 via-fuchsia-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(168,85,247,0.45)]",
  },
  {
    gradient: "from-sky-400 via-blue-500 to-violet-500",
    overlay: "from-blue-950/90 via-sky-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(59,130,246,0.45)]",
  },
  {
    gradient: "from-amber-400 via-orange-500 to-rose-500",
    overlay: "from-amber-950/90 via-orange-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(249,115,22,0.45)]",
  },
  {
    gradient: "from-emerald-400 via-teal-500 to-cyan-500",
    overlay: "from-emerald-950/90 via-teal-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(20,184,166,0.45)]",
  },
  {
    gradient: "from-rose-500 via-pink-500 to-fuchsia-500",
    overlay: "from-rose-950/90 via-pink-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(244,63,94,0.45)]",
  },
  {
    gradient: "from-lime-400 via-green-500 to-emerald-500",
    overlay: "from-green-950/90 via-lime-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(132,204,22,0.45)]",
  },
  {
    gradient: "from-yellow-400 via-amber-500 to-orange-600",
    overlay: "from-amber-950/90 via-yellow-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(234,179,8,0.45)]",
  },
  {
    gradient: "from-cyan-400 via-sky-500 to-blue-600",
    overlay: "from-sky-950/90 via-cyan-950/50 to-transparent",
    glow: "group-hover:shadow-[0_8px_30px_-6px_rgba(6,182,212,0.45)]",
  },
];

/** Fixed colours for the VJs the site is built around. */
const PINNED: Record<string, number> = {
  "senior paul": 0,
  junior: 1,
};

/** Strips the "vj" prefix, punctuation and duplicate spaces. */
export function vjKey(raw?: string | null) {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\bvj\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

const titleCase = (s: string) => s.replace(/\b[a-z]/g, (c) => c.toUpperCase());

export function vjInfo(raw?: string | null): VjInfo | null {
  const key = vjKey(raw);
  if (!key) return null;
  const idx = PINNED[key] ?? hash(key) % PALETTE.length;
  const colors = PALETTE[idx]!;
  return { key, name: `VJ ${titleCase(key)}`, ...colors };
}

/** Distinct VJs present in a set of titles, most titles first. */
export function availableVjs<T extends { vj?: string | null }>(rows: T[]) {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = vjKey(r.vj);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ ...vjInfo(key)!, count }));
}

/** True when a title belongs to the given VJ key. */
export function matchesVj(titleVj: string | null | undefined, key: string) {
  if (!key) return true;
  return vjKey(titleVj) === key;
}
