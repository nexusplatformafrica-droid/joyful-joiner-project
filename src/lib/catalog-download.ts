/**
 * Browser-side movie download for catalog (API) titles.
 *
 * The real title is only published as a signed DASH stream (separate video and
 * audio tracks, ~1000+ segments each). Rebuilding it on the server is not an
 * option on Cloudflare Workers — a single request may only make a limited
 * number of subrequests, so a full movie always failed there and the browser
 * saved the error text as `movie.txt`.
 *
 * The CDN sends permissive CORS headers (that is how the player streams it),
 * so the browser can pull the segments itself. We mux them into one MP4 and
 * stream the result straight to disk: File System Access when available
 * (nothing buffered in memory), otherwise a blob handed to the browser's
 * download manager.
 */
import { getPlayback } from "./catalog.functions";
import { parseDash, segmentName, type DashRep } from "./dash-manifest";
import { mergeInitSegments, retrackSegment, stripSegmentHeaders } from "./mp4mux";

export type DownloadProgress = {
  /** 0..1 */
  ratio: number;
  bytes: number;
  done: number;
  total: number;
};

type Options = {
  subjectId: string;
  season?: number;
  episode?: number;
  resolution?: number;
  filename: string;
  signal?: AbortSignal;
  onProgress?: (progress: DownloadProgress) => void;
};

type Writer = {
  write: (chunk: Uint8Array) => Promise<void>;
  close: () => Promise<void>;
  abort: () => Promise<void>;
};

async function serviceWorkerWriter(filename: string): Promise<Writer | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!window.isSecureContext) return null;
  try {
    const registration = await navigator.serviceWorker.register("/download-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const worker =
      navigator.serviceWorker.controller ??
      registration.active ??
      (await new Promise<ServiceWorker | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        navigator.serviceWorker.addEventListener(
          "controllerchange",
          () => {
            clearTimeout(timer);
            resolve(navigator.serviceWorker.controller);
          },
          { once: true },
        );
      }));
    if (!worker) return null;

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    const channel = new MessageChannel();
    const port = channel.port1;

    let credits = 0;
    let waiter: (() => void) | null = null;
    let cancelled = false;

    const ready = new Promise<void>((resolve) => {
      port.onmessage = (event) => {
        const msg = event.data as { type?: string };
        if (msg?.type === "ready") resolve();
        else if (msg?.type === "pull") {
          credits++;
          waiter?.();
          waiter = null;
        } else if (msg?.type === "cancel") {
          cancelled = true;
          waiter?.();
          waiter = null;
        }
      };
    });

    port.start();
    worker.postMessage({ type: "dl-init", id, filename }, [channel.port2]);
    await Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]);

    // Kick off the download in a hidden iframe: the service worker answers it
    // with an attachment response, so the browser download manager takes over.
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.src = `/__dl/${id}`;
    document.body.appendChild(frame);

    const awaitCredit = async () => {
      if (credits > 0 || cancelled) return;
      await new Promise<void>((resolve) => {
        waiter = resolve;
        setTimeout(() => {
          if (waiter === resolve) {
            waiter = null;
            credits++;
            resolve();
          }
        }, 5000);
      });
    };

    const cleanup = () => setTimeout(() => frame.remove(), 2000);

    return {
      write: async (chunk) => {
        if (cancelled) throw new DOMException("Aborted", "AbortError");
        await awaitCredit();
        if (cancelled) throw new DOMException("Aborted", "AbortError");
        credits = Math.max(0, credits - 1);
        const copy = chunk.slice();
        port.postMessage({ type: "chunk", chunk: copy.buffer }, [copy.buffer]);
      },
      close: async () => {
        port.postMessage({ type: "end" });
        cleanup();
      },
      abort: async () => {
        port.postMessage({ type: "abort" });
        cleanup();
      },
    };
  } catch {
    return null;
  }
}

async function createWriter(filename: string): Promise<Writer> {
  const streamed = await serviceWorkerWriter(filename);
  if (streamed) return streamed;

  const parts: BlobPart[] = [];
  return {
    write: async (chunk) => {
      parts.push(chunk.slice().buffer as ArrayBuffer);
    },
    close: async () => {
      const blob = new Blob(parts, { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      parts.length = 0;
    },
    abort: async () => {
      parts.length = 0;
    },
  };
}


async function getBytes(url: string, signal?: AbortSignal, tries = 4): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url, signal ? { signal } : undefined);
      if (!res.ok) throw new Error(`segment HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      if (signal?.aborted) throw err;
      lastError = err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("segment failed");
}

function pickVideo(reps: DashRep[], wanted: number): DashRep | undefined {
  const videos = reps
    .filter((r) => r.mime.startsWith("video") && r.segments > 0)
    .sort((a, b) => a.height - b.height || a.bandwidth - b.bandwidth);
  if (!videos.length) return undefined;
  const allowed = videos.filter((r) => (wanted ? r.height <= wanted : true));
  return (allowed.length ? allowed[allowed.length - 1] : videos[0])!;
}

export async function downloadCatalogMovie({
  subjectId,
  season = 0,
  episode = 0,
  resolution = 0,
  filename,
  signal,
  onProgress,
}: Options): Promise<void> {
  const playback = await getPlayback({
    data: { id: subjectId, season: season > 0 ? season : 0, episode: season > 0 ? Math.max(1, episode) : 0 },
  });
  if (!playback) throw new Error("This title is not available for download right now.");

  const manifestRes = await fetch(playback.manifest, signal ? { signal } : undefined);
  if (!manifestRes.ok) throw new Error("Could not open the movie stream.");
  const xml = await manifestRes.text();
  const base = playback.manifest.split("?")[0]!.replace(/[^/]+$/, "");
  const query = playback.query;

  const reps = parseDash(xml);
  const video = pickVideo(reps, resolution);
  const audio = reps.find((r) => r.mime.startsWith("audio") && r.segments > 0);
  if (!video) throw new Error("No video track in this stream.");

  const segUrl = (rep: DashRep, n?: number) =>
    `${base}${segmentName(n === undefined ? rep.initTemplate : rep.mediaTemplate, rep.id, n)}?${query}`;

  const videoInit = await getBytes(segUrl(video), signal);
  const audioInit = audio ? await getBytes(segUrl(audio), signal) : null;

  let head = videoInit;
  let audioId = 2;
  if (audioInit) {
    try {
      const merged = mergeInitSegments(videoInit, audioInit);
      head = merged.init;
      audioId = merged.audioId;
    } catch {
      head = videoInit; // video-only file rather than a failed download
    }
  }
  const withAudio = audioInit !== null && head !== videoInit;

  const total = video.segments;
  const audioTotal = withAudio && audio ? audio.segments : 0;

  // Interleave both tracks in presentation order.
  const plan: { audio: boolean; n: number }[] = [];
  let placed = 0;
  for (let i = 0; i < total; i++) {
    plan.push({ audio: false, n: video.startNumber + i });
    const target = Math.round(((i + 1) / total) * audioTotal);
    while (placed < target && audio) {
      plan.push({ audio: true, n: audio.startNumber + placed });
      placed++;
    }
  }

  const writer = await createWriter(filename);
  let bytes = 0;
  try {
    await writer.write(head);
    bytes += head.byteLength;

    const load = async (i: number) => {
      const step = plan[i]!;
      const rep = step.audio ? audio! : video;
      const raw = stripSegmentHeaders(await getBytes(segUrl(rep, step.n), signal));
      return step.audio ? retrackSegment(raw, audioId) : raw;
    };

    const depth = 12;
    const pipeline: Promise<Uint8Array>[] = [];
    for (let i = 0; i < Math.min(depth, plan.length); i++) pipeline.push(load(i));
    for (let i = 0; i < plan.length; i++) {
      const chunk = await pipeline.shift()!;
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      await writer.write(chunk);
      bytes += chunk.byteLength;
      onProgress?.({ ratio: (i + 1) / plan.length, bytes, done: i + 1, total: plan.length });
      const next = i + depth;
      if (next < plan.length) pipeline.push(load(next));
    }
    await writer.close();
  } catch (err) {
    await writer.abort();
    throw err;
  }
}
