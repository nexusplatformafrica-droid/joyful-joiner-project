/** Tiny DASH manifest reader (only what our CDN's manifests use). */

export type DashRep = {
  id: string;
  mime: string;
  codecs: string;
  bandwidth: number;
  width: number;
  height: number;
  initTemplate: string;
  mediaTemplate: string;
  startNumber: number;
  segments: number;
};

const attr = (tag: string, name: string) =>
  new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1] ?? "";

function countSegments(block: string): number {
  const timeline = /<SegmentTimeline>([\s\S]*?)<\/SegmentTimeline>/.exec(block)?.[1];
  if (!timeline) return 0;
  let n = 0;
  for (const m of timeline.matchAll(/<S\b([^/>]*)\/?>/g)) {
    const r = Number(attr(m[1] ?? "", "r") || 0);
    n += 1 + (Number.isFinite(r) ? r : 0);
  }
  return n;
}

export function parseDash(xml: string): DashRep[] {
  const reps: DashRep[] = [];
  for (const setMatch of xml.matchAll(/<AdaptationSet\b[\s\S]*?<\/AdaptationSet>/g)) {
    const block = setMatch[0];
    const tpl = /<SegmentTemplate\b[^>]*>/.exec(block)?.[0] ?? "";
    const initTemplate = attr(tpl, "initialization");
    const mediaTemplate = attr(tpl, "media");
    const startNumber = Number(attr(tpl, "startNumber") || 1);
    const segments = countSegments(block);
    for (const repMatch of block.matchAll(/<Representation\b[^>]*>/g)) {
      const tag = repMatch[0];
      reps.push({
        id: attr(tag, "id"),
        mime: attr(tag, "mimeType"),
        codecs: attr(tag, "codecs"),
        bandwidth: Number(attr(tag, "bandwidth") || 0),
        width: Number(attr(tag, "width") || 0),
        height: Number(attr(tag, "height") || 0),
        initTemplate,
        mediaTemplate,
        startNumber,
        segments,
      });
    }
  }
  return reps;
}

export const segmentName = (template: string, repId: string, number?: number) => {
  let name = template.replaceAll("$RepresentationID$", repId);
  if (number !== undefined) {
    name = name.replace(/\$Number(?:%0(\d+)d)?\$/g, (_m, pad?: string) =>
      pad ? String(number).padStart(Number(pad), "0") : String(number),
    );
  }
  return name;
};
