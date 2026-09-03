/**
 * Signed DASH helpers (browser only).
 *
 * The provider's web manifest (`index_web.mpd`) and its segments are served by
 * a CloudFront distribution that **does** send `access-control-allow-origin: *`,
 * so the browser can stream every byte straight from the CDN — no relay, no
 * origin bandwidth. The only work we do is rewriting the segment references
 * into absolute, signed URLs (the manifest is handed to the player as a blob,
 * which has no base URL of its own) and dropping renditions this browser
 * cannot decode.
 */

export type PreparedDash = {
  url: string;
  codecs: string[];
  videoQualities: { id: number; height: number; bandwidth: number }[];
};

/** True when this browser's media engine can actually decode the codec. */
function canDecode(mime: string, codec: string) {
  if (typeof window === "undefined") return true;
  const type = `${mime}; codecs="${codec}"`;
  const mse = (window as any).MediaSource;
  if (mse?.isTypeSupported) return !!mse.isTypeSupported(type);
  return !!document.createElement("video").canPlayType(type);
}

export async function signedDashBlobUrl(manifest: string): Promise<PreparedDash> {
  const [base, query = ""] = [manifest.slice(0, manifest.lastIndexOf("/") + 1), manifest.split("?")[1]];
  const res = await fetch(manifest, { mode: "cors", credentials: "omit" });
  if (!res.ok) throw new Error(`Manifest unavailable (${res.status})`);
  let xml = await res.text();

  const absolutize = (value: string) => {
    if (/^https?:/i.test(value)) return value;
    return `${base}${value}${query ? `?${query}` : ""}`;
  };

  xml = xml.replace(/(initialization|media|sourceURL)="([^"]+)"/g, (_m, attr, value) =>
    `${attr}="${absolutize(value)}"`,
  );
  xml = xml.replace(/<BaseURL>([^<]+)<\/BaseURL>/g, (_m, value) => `<BaseURL>${absolutize(value)}</BaseURL>`);

  // Drop video renditions this browser cannot decode (usually HEVC/h265) so the
  // player never ends up with sound and a black picture — but only when at
  // least one playable rendition survives. When none does, fail loudly so the
  // caller can fall back to the progressive H.264 file.
  const videoCodecs = [...xml.matchAll(/<Representation\b([^>]*)>/gi)]
    .map((m) => m[1] ?? "")
    .filter((attrs) => /mimeType="video\//i.test(attrs))
    .map((attrs) => attrs.match(/codecs="([^"]+)"/i)?.[1] ?? "");
  const hasPlayableVideo = videoCodecs.some((codec) => codec && canDecode("video/mp4", codec));
  if (!hasPlayableVideo) throw new Error("This browser cannot decode the adaptive stream");

  if (videoCodecs.some((codec) => codec && !canDecode("video/mp4", codec))) {
    xml = xml.replace(
      /<Representation\b([^>]*)(\/>|>[\s\S]*?<\/Representation>)/gi,
      (whole, attrs: string) => {
        const codec = attrs.match(/codecs="([^"]+)"/i)?.[1];
        if (!codec || !/mimeType="video\//i.test(attrs)) return whole;
        return canDecode("video/mp4", codec) ? whole : "";
      },
    );
  }

  const codecs = [...xml.matchAll(/codecs="([^"]+)"/gi)].map((match) => match[1] ?? "").filter(Boolean);
  const videoQualities = [...xml.matchAll(/<Representation\s+([^>]*mimeType="video\/mp4"[^>]*)>/gi)]
    .map((match, index) => {
      const attrs = match[1] ?? "";
      const height = Number(attrs.match(/height="(\d+)"/i)?.[1]) || 0;
      const bandwidth = Number(attrs.match(/bandwidth="(\d+)"/i)?.[1]) || 0;
      const rawId = Number(attrs.match(/id="(\d+)"/i)?.[1]);
      return { id: Number.isFinite(rawId) ? rawId : index, height, bandwidth };
    })
    .filter((quality) => quality.height > 0);

  if (!videoQualities.length) throw new Error("No playable video track in this stream");

  return {
    url: URL.createObjectURL(new Blob([xml], { type: "application/dash+xml" })),
    codecs: [...new Set(codecs)],
    videoQualities,
  };
}
