/**
 * Dependency-free MD5 / HMAC-MD5 over bytes.
 * Runs identically in the browser, Node and edge runtimes (no node:crypto,
 * no Buffer) so the catalog client can be called from either side.
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14,
  20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6,
  10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const K = new Uint32Array(64);
for (let i = 0; i < 64; i += 1) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296);

const rotl = (x: number, c: number) => (x << c) | (x >>> (32 - c));

export function md5Bytes(input: Uint8Array): Uint8Array {
  const len = input.length;
  const withOne = len + 1;
  const padded = new Uint8Array(withOne + ((56 - (withOne % 64)) + 64) % 64 + 8);
  padded.set(input);
  padded[len] = 0x80;

  const bitLen = len * 8;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, Math.floor(bitLen / 4294967296), true);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Uint32Array(16);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i += 1) M[i] = view.getUint32(offset + i * 4, true);

    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;

    for (let i = 0; i < 64; i += 1) {
      let F: number;
      let g: number;
      if (i < 16) {
        F = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        F = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        F = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        F = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      F = (F + A + K[i]! + M[g]!) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rotl(F, S[i]!)) >>> 0;
    }

    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, a0, true);
  outView.setUint32(4, b0, true);
  outView.setUint32(8, c0, true);
  outView.setUint32(12, d0, true);
  return out;
}

export const toHex = (bytes: Uint8Array) =>
  [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

export const md5Hex = (input: Uint8Array | string) =>
  toHex(md5Bytes(typeof input === "string" ? new TextEncoder().encode(input) : input));

export function hmacMd5(key: Uint8Array, message: Uint8Array): Uint8Array {
  let k = key;
  if (k.length > 64) k = md5Bytes(k);
  const block = new Uint8Array(64);
  block.set(k);

  const inner = new Uint8Array(64 + message.length);
  const outerKey = new Uint8Array(64);
  for (let i = 0; i < 64; i += 1) {
    inner[i] = block[i]! ^ 0x36;
    outerKey[i] = block[i]! ^ 0x5c;
  }
  inner.set(message, 64);

  const innerHash = md5Bytes(inner);
  const outer = new Uint8Array(64 + 16);
  outer.set(outerKey);
  outer.set(innerHash, 64);
  return md5Bytes(outer);
}

export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
