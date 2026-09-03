import { fdb } from "./fdb";

/** Firestore-backed settings with a localStorage cache so config is instant. */
const CACHE_KEY = "luo_app_settings";
const memory = new Map<string, unknown>();

function readCache(): Record<string, unknown> {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeCache(all: Record<string, unknown>) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function primeSetting(key: string, value: unknown) {
  memory.set(key, value);
  writeCache({ ...readCache(), [key]: value });
}

/** Synchronous best-effort read (cache only) — used by upload/payment clients. */
export function cachedSetting<T>(key: string, fallback: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  const cached = readCache()[key];
  return (cached as T | undefined) ?? fallback;
}

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const { data } = await fdb.from("app_settings").select("*").eq("key", key).maybeSingle();
  const value = (data?.value as T | undefined) ?? fallback;
  primeSetting(key, value);
  return value;
}

export async function saveSetting(key: string, value: unknown) {
  const { error } = await fdb
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
  primeSetting(key, value);
}

/** Loads every setting into the cache (called before uploads/payments). */
export async function loadAppSettings() {
  const { data } = await fdb.from("app_settings").select("*");
  const all: Record<string, unknown> = {};
  for (const row of data) if (row.key) all[String(row.key)] = row.value;
  for (const [k, v] of Object.entries(all)) memory.set(k, v);
  writeCache({ ...readCache(), ...all });
  return all;
}
