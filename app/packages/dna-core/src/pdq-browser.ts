// Browser PDQ hasher — pdq-wasm + explicit vendored wasmUrl (never CDN).
// Import `@ozdna/dna-core/pdq-browser`. Call initPdqBrowser({ wasmUrl }) once.
// Serve app/vendor/pdq-wasm/wasm/pdq.wasm as a static asset (e.g. /app/verify/pdq.wasm).

import { PDQ } from "pdq-wasm";
import type { Pdq256Result, PdqHasher, PdqImageInput } from "./pdq.js";
import { PDQ_HASH_BYTES, pdq256ToHex } from "./pdq.js";

let initPromise: Promise<void> | null = null;

/**
 * Initialize Meta PDQ WASM in the browser.
 * @param wasmUrl Absolute or same-origin URL to vendored `pdq.wasm`.
 */
export function initPdqBrowser(options: { wasmUrl: string }): Promise<void> {
  if (!options.wasmUrl) throw new Error("initPdqBrowser: wasmUrl required");
  if (!initPromise) initPromise = PDQ.init({ wasmUrl: options.wasmUrl });
  return initPromise;
}

export async function pdqHashBrowser(
  image: PdqImageInput,
): Promise<Pdq256Result & { hex: string }> {
  if (!initPromise) {
    throw new Error("initPdqBrowser({ wasmUrl }) must be called before hashing");
  }
  await initPromise;
  const result = PDQ.hash({
    data: image.data,
    width: image.width,
    height: image.height,
    channels: image.channels,
  });
  if (result.hash.byteLength !== PDQ_HASH_BYTES) {
    throw new Error(
      `pdq-wasm returned ${result.hash.byteLength} bytes, expected ${PDQ_HASH_BYTES}`,
    );
  }
  return {
    hash: result.hash,
    quality: result.quality,
    hex: pdq256ToHex(result.hash),
  };
}

/** Strip alpha (composite over white) then hash. */
export async function pdqHashRgbaBrowser(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<Pdq256Result & { hex: string }> {
  if (rgba.length < width * height * 4) {
    throw new RangeError("rgba shorter than width*height*4");
  }
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < width * height; i++, j += 3) {
    const a = rgba[i * 4 + 3]! / 255;
    rgb[j] = Math.round(rgba[i * 4]! * a + 255 * (1 - a));
    rgb[j + 1] = Math.round(rgba[i * 4 + 1]! * a + 255 * (1 - a));
    rgb[j + 2] = Math.round(rgba[i * 4 + 2]! * a + 255 * (1 - a));
  }
  return pdqHashBrowser({ data: rgb, width, height, channels: 3 });
}

/** Decode a Blob via createImageBitmap → RGBA → PDQ. */
export async function pdqHashBlobBrowser(blob: Blob): Promise<Pdq256Result & { hex: string }> {
  if (!initPromise) {
    throw new Error("initPdqBrowser({ wasmUrl }) must be called before hashing");
  }
  await initPromise;
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("OffscreenCanvas 2d unavailable");
    ctx.drawImage(bitmap, 0, 0);
    const img = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return pdqHashRgbaBrowser(new Uint8Array(img.data.buffer), bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

export const browserPdqHasher: PdqHasher = {
  hash(image: PdqImageInput): Pdq256Result {
    const result = PDQ.hash({
      data: image.data,
      width: image.width,
      height: image.height,
      channels: image.channels,
    });
    return { hash: result.hash, quality: result.quality };
  },
};
