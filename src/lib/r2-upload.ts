import { uploadBackend, uploadToken } from "./r2-config";

export type UploadProgress = { loaded: number; total: number; percent: number };

const PART_SIZE = 8 * 1024 * 1024;
const CONCURRENCY = 8;
/** Files up to this size go up in one signed PUT — fewer round-trips is faster. */
const SINGLE_LIMIT = 8 * 1024 * 1024;
const MAX_ATTEMPTS = 60;

async function rawSigner<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${uploadBackend()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${uploadToken()}` },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { message: text };
  }
  if (!res.ok) {
    const message = (payload as { message?: string; error?: string }).message ??
      (payload as { error?: string }).error ??
      `Upload service error (${res.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function put(url: string, body: Blob, onLoaded?: (loaded: number) => void) {
  return new Promise<string | null>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onLoaded?.(e.loaded);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve(xhr.getResponseHeader("ETag")?.replace(/"/g, "") ?? null)
        : reject(new Error(xhr.responseText || `Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}

/**
 * Blocks until the browser is back online again. Data toggled off then on, a
 * flaky tunnel or a dropped Wi-Fi hop simply pauses the upload instead of
 * failing it — we keep waiting (up to 30 min) and resume the same part.
 */
async function waitForNetwork() {
  if (typeof navigator === "undefined" || navigator.onLine) return;
  await new Promise<void>((resolve) => {
    const deadline = Date.now() + 30 * 60 * 1000;
    const finish = () => {
      window.removeEventListener("online", finish);
      clearInterval(poll);
      resolve();
    };
    const poll = setInterval(() => {
      if (navigator.onLine || Date.now() > deadline) finish();
    }, 1000);
    window.addEventListener("online", finish);
  });
}

/** A permanent, non-retryable failure (bad token, rejected request). */
const fatal = (err: unknown) =>
  /unauthor|forbidden|invalid|not configured|must be signed in/i.test(
    err instanceof Error ? err.message : "",
  );

/** Retries an upload step across network drops with capped backoff. */
async function withRetry<T>(run: () => Promise<T>, onReset?: () => void): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      onReset?.();
      if (fatal(err) || attempt >= MAX_ATTEMPTS) throw err;
      await waitForNetwork();
      await new Promise((r) => setTimeout(r, Math.min(10000, 1000 * attempt)));
    }
  }
}

const signer = <T,>(path: string, body: unknown) => withRetry(() => rawSigner<T>(path, body));


export async function uploadToR2(
  folder: string,
  file: File,
  onProgress?: (p: UploadProgress) => void,
): Promise<string> {
  const emit = (loaded: number) =>
    onProgress?.({ loaded, total: file.size, percent: Math.round((loaded / Math.max(1, file.size)) * 100) });

  if (file.size <= SINGLE_LIMIT) {
    const { url, publicUrl } = await signer<{ url: string; publicUrl: string }>("/uploads/single", {
      folder,
      filename: file.name,
      contentType: file.type || "application/octet-stream",
    });
    await withRetry(() => put(url, file, emit), () => emit(0));
    emit(file.size);
    return publicUrl;
  }

  const { key, uploadId, publicUrl } = await signer<{ key: string; uploadId: string; publicUrl: string }>(
    "/uploads/create",
    { folder, filename: file.name, contentType: file.type || "application/octet-stream" },
  );

  const totalParts = Math.ceil(file.size / PART_SIZE);
  const loadedPerPart = new Array<number>(totalParts).fill(0);
  const etags = new Array<string>(totalParts);
  const report = () => emit(loadedPerPart.reduce((a, b) => a + b, 0));

  let next = 0;
  const worker = async () => {
    for (;;) {
      const index = next++;
      if (index >= totalParts) return;
      const partNumber = index + 1;
      const blob = file.slice(index * PART_SIZE, Math.min((index + 1) * PART_SIZE, file.size));

      // Each part re-signs and re-sends itself until it lands, so a dropped
      // connection only rewinds that one 8 MB chunk — never the whole upload.
      await withRetry(
        async () => {
          const { urls } = await signer<{ urls: { partNumber: number; url: string }[] }>("/uploads/sign", {
            key,
            uploadId,
            partNumbers: [partNumber],
          });
          const target = urls.find((u) => u.partNumber === partNumber)?.url;
          if (!target) throw new Error("Signer returned no URL for this part");
          const etag = await put(target, blob, (loaded) => {
            loadedPerPart[index] = loaded;
            report();
          });
          if (!etag) throw new Error("Missing ETag — check R2 CORS ExposeHeaders");
          etags[index] = etag;
          loadedPerPart[index] = blob.size;
          report();
        },
        () => {
          loadedPerPart[index] = 0;
          report();
        },
      );
    }
  };

  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalParts) }, worker));
    await signer("/uploads/complete", {
      key,
      uploadId,
      parts: etags.map((etag, i) => ({ partNumber: i + 1, etag })),
    });
    emit(file.size);
    return publicUrl;
  } catch (err) {
    void signer("/uploads/abort", { key, uploadId }).catch(() => {});
    throw err;
  }
}
