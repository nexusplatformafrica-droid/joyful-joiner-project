import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFbAuth, getFbStorage } from "./firebase";
import { loadAppSettings } from "./app-settings";
import { r2Enabled } from "./r2-config";
import { uploadToR2, type UploadProgress } from "./r2-upload";

export type { UploadProgress };

export function formatBytes(n: number) {
  if (!n) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Keeps long uploads alive when the screen dims or the tab is switched. */
async function keepAwake() {
  const guard = (e: BeforeUnloadEvent) => {
    e.preventDefault();
  };
  window.addEventListener("beforeunload", guard);

  type WakeLock = { release: () => Promise<void> };
  let lock: WakeLock | null = null;
  const request = async () => {
    try {
      const nav = navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<WakeLock> } };
      lock = (await nav.wakeLock?.request("screen")) ?? null;
    } catch {
      /* wake lock is optional */
    }
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") void request();
  };
  await request();
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    window.removeEventListener("beforeunload", guard);
    document.removeEventListener("visibilitychange", onVisible);
    void lock?.release().catch(() => {});
  };
}

async function firebaseUpload(folder: string, file: File, onProgress?: (p: UploadProgress) => void) {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
  const path = `media/${folder}/${crypto.randomUUID()}-${safe}`;
  const task = uploadBytesResumable(ref(getFbStorage(), path), file, {
    contentType: file.type || "application/octet-stream",
  });
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (s) =>
        onProgress?.({
          loaded: s.bytesTransferred,
          total: s.totalBytes,
          percent: Math.round((s.bytesTransferred / Math.max(1, s.totalBytes)) * 100),
        }),
      reject,
      () => resolve(),
    );
  });
  return getDownloadURL(task.snapshot.ref);
}

/** Uploads to R2 through the signer service, falling back to Firebase Storage. */
export async function uploadFile(
  folder: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  if (!getFbAuth().currentUser) throw new Error("You must be signed in to upload.");
  await loadAppSettings().catch(() => ({}));
  const release = await keepAwake();
  try {
    if (r2Enabled()) return await uploadToR2(`media/${folder}`, file, onProgress);
    // Firebase resumable uploads restart from the last committed byte, so retry
    // a few times when the connection drops instead of failing the upload.
    for (let attempt = 1; ; attempt++) {
      try {
        return await firebaseUpload(folder, file, onProgress);
      } catch (err) {
        if (attempt >= 6) throw err;
        await new Promise((r) => setTimeout(r, Math.min(10000, 1500 * attempt)));
      }
    }
  } finally {
    release();
  }
}

/** Both backends return complete public URLs, so they are stored as-is. */
export const fileUrl = (path: string) => path;
