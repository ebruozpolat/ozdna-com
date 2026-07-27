// SHA-256 over raw bytes, isomorphic across browser / Workers / Node via Web Crypto.
// (Node 22, Cloudflare Workers, and modern browsers all expose global `crypto.subtle`.)

/** SHA-256 of the given bytes. Async because Web Crypto's digest is async everywhere. */
export async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return new Uint8Array(digest);
}

/** Lowercase hex encoding of bytes. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** Decode lowercase/uppercase hex to bytes. Throws on odd length or non-hex. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("hex length must be even");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) throw new Error(`invalid hex at ${i * 2}`);
    out[i] = byte;
  }
  return out;
}

/** Concatenate byte arrays into one. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

const encoder = new TextEncoder();
/** UTF-8 encode a string. */
export function utf8(s: string): Uint8Array {
  return encoder.encode(s);
}
