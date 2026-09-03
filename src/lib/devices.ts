/**
 * Real per-account device registry (Firestore only).
 * Each browser gets a stable id kept in localStorage, and every signed-in
 * session writes a heartbeat row. A plan's device allowance is enforced from
 * these rows, and revoking a row really signs that other browser out because
 * every session polls its own row.
 */
import { fdb, nowIso } from "./fdb";

const KEY = "luo_device_id";
const COLLECTION = "luo_devices";

/** Rows older than this are treated as gone, so a lost phone frees a slot. */
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

export type DeviceRow = {
  id: string;
  user_id: string;
  device_id: string;
  label: string;
  platform?: string | null;
  revoked?: boolean;
  last_seen?: string;
  created_at?: string;
};

export function deviceId() {
  if (typeof localStorage === "undefined") return "server";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* private mode — the id just won't persist */
    }
  }
  return id;
}

/** Friendly name shown in the "too many devices" list. */
export function deviceLabel() {
  if (typeof navigator === "undefined") return "Unknown device";
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iPhone / iPad"
    : /Android/i.test(ua)
      ? "Android phone"
      : /Windows/i.test(ua)
        ? "Windows PC"
        : /Mac OS X/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Device";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\//i.test(ua)
      ? "Opera"
      : /Chrome\//i.test(ua)
        ? "Chrome"
        : /Firefox\//i.test(ua)
          ? "Firefox"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Browser";
  return `${os} · ${browser}`;
}

const rowId = (userId: string, dev: string) => `${userId}__${dev}`;

export const isActiveDevice = (d: DeviceRow) =>
  d.revoked !== true && (!d.last_seen || Date.now() - new Date(d.last_seen).getTime() < STALE_MS);

/** Heartbeat for this browser. Never throws — playback must not depend on it. */
export async function touchDevice(userId: string) {
  const dev = deviceId();
  const id = rowId(userId, dev);
  const payload = {
    id,
    user_id: userId,
    device_id: dev,
    label: deviceLabel(),
    platform: typeof navigator === "undefined" ? null : navigator.platform || null,
    revoked: false,
    last_seen: nowIso(),
  };
  const { data: existing } = await fdb.from(COLLECTION).select("*").eq("id", id).maybeSingle();
  if (existing) await fdb.from(COLLECTION).update(payload).eq("id", id);
  else await fdb.from(COLLECTION).insert({ ...payload, created_at: nowIso() });
  return id;
}

/** Marks this browser as seen without clearing a revoke flag set elsewhere. */
export async function pingDevice(userId: string) {
  const id = rowId(userId, deviceId());
  await fdb.from(COLLECTION).update({ last_seen: nowIso() }).eq("id", id);
}

export async function listDevices(userId: string): Promise<DeviceRow[]> {
  const { data } = await fdb.from(COLLECTION).select("*").eq("user_id", userId);
  return (data as DeviceRow[]).filter(isActiveDevice).sort((a, b) =>
    String(b.last_seen ?? "").localeCompare(String(a.last_seen ?? "")),
  );
}

export async function revokeDevice(id: string) {
  await fdb.from(COLLECTION).update({ revoked: true, revoked_at: nowIso() }).eq("id", id);
}

/** Clears a revoke flag on this browser so the user can sign back in here. */
export async function clearThisDeviceRevoke(userId: string) {
  await fdb
    .from(COLLECTION)
    .update({ revoked: false, revoked_at: null, last_seen: nowIso() })
    .eq("id", rowId(userId, deviceId()));
}

/**
 * True only when another session kicked this browser out *during this session*.
 * An older revoke (for example the user signing this device out themselves) is
 * cleared instead, otherwise they could never sign in on this device again.
 */
export async function thisDeviceRevoked(userId: string, since = 0) {
  const { data } = await fdb
    .from(COLLECTION)
    .select("*")
    .eq("id", rowId(userId, deviceId()))
    .maybeSingle();
  if (!data || data.revoked !== true) return false;
  const at = data.revoked_at ? new Date(String(data.revoked_at)).getTime() : 0;
  if (at >= since) return true;
  await clearThisDeviceRevoke(userId).catch(() => {});
  return false;
}

export const isThisDevice = (d: DeviceRow) => d.device_id === deviceId();

