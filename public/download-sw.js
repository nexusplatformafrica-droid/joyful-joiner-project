/* Streaming download service worker.
 * The page muxes an MP4 in memory and pushes chunks through a MessagePort.
 * We expose them as a real HTTP response with Content-Disposition: attachment,
 * so the browser's own download manager handles the file (no "Save as" dialog).
 */
const streams = new Map();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "dl-init") return;
  const port = event.ports[0];
  if (!port) return;

  let controller = null;
  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    pull() {
      port.postMessage({ type: "pull" });
    },
    cancel() {
      streams.delete(data.id);
      port.postMessage({ type: "cancel" });
    },
  });

  port.onmessage = (ev) => {
    const msg = ev.data;
    if (!msg || !controller) return;
    if (msg.type === "chunk") {
      try {
        controller.enqueue(new Uint8Array(msg.chunk));
      } catch {
        /* stream already closed */
      }
    } else if (msg.type === "end") {
      try {
        controller.close();
      } catch {
        /* already closed */
      }
    } else if (msg.type === "abort") {
      try {
        controller.error(new Error("aborted"));
      } catch {
        /* already closed */
      }
      streams.delete(data.id);
    }
  };

  streams.set(data.id, { stream, filename: data.filename || "video.mp4" });
  port.postMessage({ type: "ready" });
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith("/__dl/")) return;
  const id = decodeURIComponent(url.pathname.slice("/__dl/".length));
  const entry = streams.get(id);
  if (!entry) return;
  streams.delete(id);
  const name = entry.filename.replace(/["\\\r\n]/g, "");
  event.respondWith(
    new Response(entry.stream, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(entry.filename)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    }),
  );
});
