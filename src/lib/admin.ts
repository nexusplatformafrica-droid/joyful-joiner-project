import { fdb, nowIso, uuid } from "./fdb";
import { getFbAuth } from "./firebase";
import { getSetting as loadSetting, saveSetting as persistSetting } from "./app-settings";
import { uploadFile } from "./storage";

export type Plan = {
  id: string;
  name: string;
  price: number;
  days: number;
  note: string;
  /** Simultaneous device allowance for the plan. */
  devices: number;
};
export type PlansSetting = { vip: Plan[]; svip: Plan[] };
export type EndpointsSetting = {
  payment_backend_url: string;
  upload_backend_url: string;
  upload_token?: string;
  save_api_content: boolean;
};

export const DEFAULT_PLANS: PlansSetting = {
  vip: [
    { id: "daily", name: "Daily pass", price: 1000, days: 1, note: "HD 720p · 1 device", devices: 1 },
    { id: "weekly", name: "Weekly", price: 5000, days: 7, note: "Full HD · 2 devices", devices: 2 },
    { id: "monthly", name: "Monthly", price: 15000, days: 30, note: "Full HD · 4 devices", devices: 4 },
  ],
  svip: [
    { id: "s-monthly", name: "Monthly Premium", price: 25000, days: 30, note: "4K · 4 devices", devices: 4 },
    { id: "s-quarterly", name: "Quarterly Premium", price: 60000, days: 90, note: "4K · downloads", devices: 4 },
    { id: "s-yearly", name: "Yearly Premium", price: 180000, days: 365, note: "4K · TV app · no ads", devices: 5 },
  ],
};

export const money = (n: number, currency = "UGX") =>
  `${currency} ${Math.round(Number(n) || 0).toLocaleString()}`;

export const shortDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—";

export const fullDate = (v?: string | null) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "—";

export function timeAgo(v?: string | null) {
  if (!v) return "never";
  const diff = Date.now() - new Date(v).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : shortDate(v);
}

/** Fire-and-forget activity log for the signed-in viewer. */
export async function logActivity(action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    const user = getFbAuth().currentUser;
    if (!user) return;
    await fdb.from("luo_activities").insert({
      id: uuid(),
      user_id: user.uid,
      action,
      detail: target ?? null,
      target: target ?? null,
      meta: meta ?? null,
      created_at: nowIso(),
    });
  } catch {
    /* logging is best-effort */
  }
}

export const getSetting = loadSetting;
export const saveSetting = persistSetting;

export async function getPlans() {
  return getSetting<PlansSetting>("plans", DEFAULT_PLANS);
}

/** Buckets a list of rows with a created_at into the last `days` days. */
export function seriesByDay<T extends { created_at: string }>(
  rows: T[],
  days: number,
  value: (r: T) => number = () => 1,
) {
  const out: { day: string; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const total = rows
      .filter((r) => {
        const t = new Date(r.created_at).getTime();
        return t >= d.getTime() && t < next.getTime();
      })
      .reduce((s, r) => s + value(r), 0);
    out.push({ day: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }), value: total });
  }
  return out;
}

/**
 * Uploads straight from the browser to Cloudflare R2 (or Firebase Storage when
 * no signer backend is configured) — no site server is involved.
 */
export async function uploadMedia(
  file: File,
  onProgress: (pct: number) => void,
): Promise<{ path: string; url: string }> {
  const url = await uploadFile("admin", file, (p) => onProgress(p.percent));
  return { path: url, url };
}
