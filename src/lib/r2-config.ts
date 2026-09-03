import { cachedSetting } from "./app-settings";

export type UploadSettings = { backend_url?: string; token?: string };

export const DEFAULT_UPLOAD_API = "https://function-bun-production-8264.up.railway.app";

const clean = (v: string) => v.trim().replace(/\/+$/, "");

export function uploadBackend() {
  const saved = cachedSetting<UploadSettings>("upload", {});
  return clean(saved.backend_url || DEFAULT_UPLOAD_API || "");
}

export function uploadToken() {
  const saved = cachedSetting<UploadSettings>("upload", {});
  return (saved.token || "*").trim();
}

export const r2Enabled = () => uploadBackend().length > 0;
