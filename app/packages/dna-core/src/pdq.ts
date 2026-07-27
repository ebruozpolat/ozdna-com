// PDQ-256 wrapper — plan/03-ALGORITHMS.md §1.4.
// One copy for browser + Workers. Uses pdq-wasm 0.3.9 (Meta PDQ via WASM).
// Threshold for confirmation: Hamming ≤ 31 of 256 (THRESHOLDS.pdqConfirm in verdict.ts).
//
// Note: pdq-wasm's ESM entry cannot resolve the WASM factory under Node ESM/Vitest
// (no `require`). We load the CJS entry via createRequire. Cloudflare Workers use
// `nodejs_compat` so the same path works; browsers should call initPdqBrowser().

import { createRequire } from "node:module";
import type { PDQ as PDQType } from "pdq-wasm";
import { THRESHOLDS } from "./verdict.js";

type PDQClass = typeof PDQType;

function loadPDQ(): PDQClass {
  const require = createRequire(import.meta.url);
  // CJS main: dist/index.js — getWasmFactory() works there.
  const mod = require("pdq-wasm") as { PDQ: PDQClass };
  return mod.PDQ;
}

const PDQ = loadPDQ();

let initPromise: Promise<void> | null = null;

/** Ensure WASM is loaded (idempotent). Call once before hashing in each isolate. */
export function initPdq(): Promise<void> {
  if (!initPromise) initPromise = PDQ.init();
  return initPromise;
}

/**
 * Browser / Worker without node require — pass a URL to the packaged wasm.
 * Example: initPdqBrowser({ wasmUrl: "/assets/pdq.wasm" })
 */
export function initPdqBrowser(options: { wasmUrl: string }): Promise<void> {
  if (!initPromise) initPromise = PDQ.init(options);
  return initPromise;
}

export type PdqInput = {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  /** 3 = RGB, 1 = grayscale */
  readonly channels: 1 | 3;
};

export type PdqResult = {
  readonly hash: Uint8Array; // 32 bytes
  readonly hex: string; // 64 lowercase hex
  readonly quality: number;
};

/** Hash RGBA by stripping alpha (composite over white). */
export async function pdqFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
): Promise<PdqResult> {
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
  return pdqFromPixels({ data: rgb, width, height, channels: 3 });
}

export async function pdqFromPixels(img: PdqInput): Promise<PdqResult> {
  await initPdq();
  const result = PDQ.hash({
    data: img.data,
    width: img.width,
    height: img.height,
    channels: img.channels,
  });
  return {
    hash: result.hash,
    hex: PDQ.toHex(result.hash).toLowerCase(),
    quality: result.quality,
  };
}

/** Hamming distance 0–256 between two 32-byte (or 64-hex) PDQ hashes. */
export function pdqHamming(a: Uint8Array | string, b: Uint8Array | string): number {
  const ha = typeof a === "string" ? PDQ.fromHex(a) : a;
  const hb = typeof b === "string" ? PDQ.fromHex(b) : b;
  return PDQ.hammingDistance(ha, hb);
}

export function pdqConfirms(distance: number): boolean {
  return distance <= THRESHOLDS.pdqConfirm;
}
