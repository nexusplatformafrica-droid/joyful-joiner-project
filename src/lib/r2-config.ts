import { cachedSetting } from "./app-settings";

export type UploadSettings = { backend_url?: string; token?: string };

export const DEFAULT_UPLOAD_API = "https://function-bun-production-9a7c.up.railway.app";

const clean = (v: string) => v.trim().replace(/\/+$/, "");

/** Retired signer hosts — ignore them if they are still saved in settings. */
const RETIRED = ["function-bun-production-8264.up.railway.app"];

export function uploadBackend() {
  const saved = cachedSetting<UploadSettings>("upload", {});
  const url = clean(saved.backend_url || "");
  if (!url || RETIRED.some((host) => url.includes(host))) return clean(DEFAULT_UPLOAD_API);
  return url;
}

export function uploadToken() {
  const saved = cachedSetting<UploadSettings>("upload", {});
  return (saved.token || "*").trim();
}

export const r2Enabled = () => uploadBackend().length > 0;
