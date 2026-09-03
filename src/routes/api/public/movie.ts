import { createFileRoute } from "@tanstack/react-router";
import { fetchPlayback } from "@/lib/moviebox";
import { parseDash, segmentName, type DashRep } from "@/lib/dash-manifest";
import { mergeInitSegments, retrackSegment, stripSegmentHeaders } from "@/lib/mp4mux";

/**
 * Real movie download.
 *
 * The provider's "download" links are a ~1 MB promo clip; the genuine title is
 * only published as a signed DASH stream. This endpoint rebuilds it into one
 * playable MP4 (video + audio) and streams it straight to the browser download
 * manager, so nothing is buffered in the page.
 */

const safeName = (value: string) =>
  (value.replace(/[^\w\s.()-]+/g, "").trim() || "luofilm").slice(0, 90);

async function getBytes(url: string, tries = 3): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`segment HTTP ${res.status}`);
      return new Uint8Array(await res.arrayBuffer());
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("segment failed");
}

function pickVideo(reps: DashRep[], wanted: number): DashRep | undefined {
  const videos = reps
    .filter((r) => r.mime.startsWith("video") && r.segments > 0)
    .sort((a, b) => a.height - b.height || a.bandwidth - b.bandwidth);
  if (!videos.length) return undefined;
  const exact = videos.filter((r) => (wanted ? r.height <= wanted : true));
  return (exact.length ? exact[exact.length - 1] : videos[0])!;
}

export const Route = createFileRoute("/api/public/movie")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const subjectId = url.searchParams.get("subjectId") ?? "";
        const se = Number(url.searchParams.get("se") ?? 0) || 0;
        const ep = Number(url.searchParams.get("ep") ?? 0) || 0;
        const wanted = Number(url.searchParams.get("res") ?? 0) || 0;
        const filename = `${safeName(url.searchParams.get("dl") ?? "movie")}.mp4`;
        if (!subjectId) return new Response("subjectId required", { status: 400 });

        const playback = await fetchPlayback(subjectId, se, ep).catch(() => null);
        if (!playback) return new Response("This title is not available for download", { status: 404 });

        const manifest = await fetch(playback.manifest);
        if (!manifest.ok) return new Response("Could not open the movie stream", { status: 502 });
        const xml = await manifest.text();
        const base = playback.manifest.split("?")[0]!.replace(/[^/]+$/, "");
        const q = playback.query;

        const reps = parseDash(xml);
        const video = pickVideo(reps, wanted);
        const audio = reps.find((r) => r.mime.startsWith("audio") && r.segments > 0);
        if (!video) return new Response("No video track in this stream", { status: 502 });

        const segUrl = (rep: DashRep, n?: number) =>
          `${base}${segmentName(n === undefined ? rep.initTemplate : rep.mediaTemplate, rep.id, n)}?${q}`;

        const videoInit = await getBytes(segUrl(video));
        const audioInit = audio ? await getBytes(segUrl(audio)) : null;

        let head = videoInit;
        let audioId = 2;
        if (audioInit) {
          try {
            const merged = mergeInitSegments(videoInit, audioInit);
            head = merged.init;
            audioId = merged.audioId;
          } catch {
            head = videoInit; // fall back to a video-only file rather than failing
          }
        }
        const withAudio = audioInit !== null && head !== videoInit;

        const total = video.segments;
        const audioTotal = withAudio && audio ? audio.segments : 0;

        // Interleave both tracks in presentation order — the audio track often
        // has a different segment count, so it is spread across the video ones.
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

        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            controller.enqueue(head);
            try {
              const load = async (i: number) => {
                const step = plan[i]!;
                const rep = step.audio ? audio! : video;
                const raw = stripSegmentHeaders(await getBytes(segUrl(rep, step.n)));
                return step.audio ? retrackSegment(raw, audioId) : raw;
              };

              const depth = 4;
              const pipeline: Promise<Uint8Array>[] = [];
              for (let i = 0; i < Math.min(depth, plan.length); i++) pipeline.push(load(i));
              for (let i = 0; i < plan.length; i++) {
                controller.enqueue(await pipeline.shift()!);
                const next = i + depth;
                if (next < plan.length) pipeline.push(load(next));
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });


        return new Response(stream, {
          headers: {
            "content-type": "video/mp4",
            "content-disposition": `attachment; filename="${filename}"`,
            "cache-control": "no-store",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
