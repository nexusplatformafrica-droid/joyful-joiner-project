/**
 * Minimal fragmented-MP4 (CMAF) merger.
 *
 * The catalog's real movies only exist as signed DASH streams: one fMP4 video
 * representation plus a separate fMP4 audio representation. Browsers cannot
 * save that as one file, so the server stitches the two tracks together on the
 * fly — the init segments are merged into a single `moov` with two tracks and
 * every audio fragment gets its track id rewritten before being interleaved.
 * All work is header-level, so the movie bytes stream straight through.
 */

const u32 = (b: Uint8Array, o: number) =>
  ((b[o]! << 24) >>> 0) + (b[o + 1]! << 16) + (b[o + 2]! << 8) + b[o + 3]!;

const setU32 = (b: Uint8Array, o: number, v: number) => {
  b[o] = (v >>> 24) & 0xff;
  b[o + 1] = (v >>> 16) & 0xff;
  b[o + 2] = (v >>> 8) & 0xff;
  b[o + 3] = v & 0xff;
};

export type Box = { type: string; start: number; end: number; body: number };

export function readBoxes(buf: Uint8Array, start = 0, end = buf.length): Box[] {
  const out: Box[] = [];
  let o = start;
  while (o + 8 <= end) {
    let size = u32(buf, o);
    const type = String.fromCharCode(buf[o + 4]!, buf[o + 5]!, buf[o + 6]!, buf[o + 7]!);
    let body = o + 8;
    if (size === 1) {
      // 64-bit size: high word is always 0 for our segments
      size = u32(buf, o + 12);
      body = o + 16;
    } else if (size === 0) {
      size = end - o;
    }
    if (size < 8 || o + size > end) break;
    out.push({ type, start: o, end: o + size, body });
    o += size;
  }
  return out;
}

const find = (boxes: Box[], type: string) => boxes.find((b) => b.type === type);
const all = (boxes: Box[], type: string) => boxes.filter((b) => b.type === type);
const slice = (buf: Uint8Array, b: Box) => buf.slice(b.start, b.end);

function box(type: string, payload: Uint8Array[]): Uint8Array {
  const len = payload.reduce((n, p) => n + p.length, 0) + 8;
  const out = new Uint8Array(len);
  setU32(out, 0, len);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  let o = 8;
  for (const p of payload) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** track_ID inside a tkhd box (version aware). */
function tkhdTrackIdOffset(buf: Uint8Array, tkhd: Box) {
  const version = buf[tkhd.body]!;
  return tkhd.body + 4 + (version === 1 ? 16 : 8);
}

function trakTrackId(buf: Uint8Array, trak: Box): number {
  const tkhd = find(readBoxes(buf, trak.body, trak.end), "tkhd");
  return tkhd ? u32(buf, tkhdTrackIdOffset(buf, tkhd)) : 1;
}

function retrackTrak(buf: Uint8Array, trak: Box, id: number): Uint8Array {
  const copy = slice(buf, trak);
  const tkhd = find(readBoxes(copy, 8, copy.length), "tkhd");
  if (tkhd) setU32(copy, tkhdTrackIdOffset(copy, tkhd), id);
  return copy;
}

function retrackTrex(buf: Uint8Array, trex: Box, id: number): Uint8Array {
  const copy = slice(buf, trex);
  setU32(copy, 12, id); // 8 header + 4 fullbox
  return copy;
}

/**
 * Builds one init segment containing the video track (id 1) and the audio
 * track (id 2).
 */
export function mergeInitSegments(videoInit: Uint8Array, audioInit: Uint8Array) {
  const vTop = readBoxes(videoInit);
  const aTop = readBoxes(audioInit);
  const ftyp = find(vTop, "ftyp");
  const vMoov = find(vTop, "moov");
  const aMoov = find(aTop, "moov");
  if (!vMoov || !aMoov) throw new Error("init segment missing moov");

  const vChildren = readBoxes(videoInit, vMoov.body, vMoov.end);
  const aChildren = readBoxes(audioInit, aMoov.body, aMoov.end);

  const mvhd = find(vChildren, "mvhd");
  const vTraks = all(vChildren, "trak");
  const aTraks = all(aChildren, "trak");
  const videoId = vTraks[0] ? trakTrackId(videoInit, vTraks[0]) : 1;
  const audioId = videoId + 1;

  const vTrex = find(vChildren, "mvex")
    ? all(readBoxes(videoInit, find(vChildren, "mvex")!.body, find(vChildren, "mvex")!.end), "trex")
    : [];
  const aTrex = find(aChildren, "mvex")
    ? all(readBoxes(audioInit, find(aChildren, "mvex")!.body, find(aChildren, "mvex")!.end), "trex")
    : [];

  const parts: Uint8Array[] = [];
  if (mvhd) {
    const head = slice(videoInit, mvhd);
    // next_track_ID is the last 4 bytes of mvhd
    setU32(head, head.length - 4, audioId + 1);
    parts.push(head);
  }
  for (const t of vTraks) parts.push(slice(videoInit, t));
  for (const t of aTraks) parts.push(retrackTrak(audioInit, t, audioId));

  const mvexParts: Uint8Array[] = [];
  for (const t of vTrex) mvexParts.push(slice(videoInit, t));
  for (const t of aTrex) mvexParts.push(retrackTrex(audioInit, t, audioId));
  if (mvexParts.length) parts.push(box("mvex", mvexParts));

  const moov = box("moov", parts);
  const head = ftyp ? slice(videoInit, ftyp) : new Uint8Array(0);
  const out = new Uint8Array(head.length + moov.length);
  out.set(head, 0);
  out.set(moov, head.length);
  return { init: out, videoId, audioId };
}

/** Rewrites every tfhd/sidx track reference inside a media segment. */
export function retrackSegment(segment: Uint8Array, id: number): Uint8Array {
  for (const top of readBoxes(segment)) {
    if (top.type === "sidx") {
      setU32(segment, top.body + 4, id);
    } else if (top.type === "moof") {
      for (const child of readBoxes(segment, top.body, top.end)) {
        if (child.type !== "traf") continue;
        for (const tf of readBoxes(segment, child.body, child.end)) {
          if (tf.type === "tfhd") setU32(segment, tf.body + 4, id);
        }
      }
    }
  }
  return segment;
}

/** Drops `styp`/`sidx` boxes so concatenated fragments stay a single movie. */
export function stripSegmentHeaders(segment: Uint8Array): Uint8Array {
  const keep = readBoxes(segment).filter((b) => b.type !== "styp" && b.type !== "sidx");
  if (keep.length === 0) return new Uint8Array(0);
  const first = keep[0]!;
  const last = keep[keep.length - 1]!;
  if (first.start === 0 && last.end === segment.length) return segment;
  const size = keep.reduce((n, b) => n + (b.end - b.start), 0);
  const out = new Uint8Array(size);
  let o = 0;
  for (const b of keep) {
    out.set(segment.subarray(b.start, b.end), o);
    o += b.end - b.start;
  }
  return out;
}
