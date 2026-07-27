// OzDNA pHash v1 — normative per plan/03-ALGORITHMS.md §1.3.
// This module owns steps 2–7 (luma → 32×32 area-average → DCT-II → top-left 8×8 →
// median threshold → MSB-first packing). Steps 0–1 (EXIF orientation + decode to RGBA)
// are platform-specific (browser createImageBitmap / Workers @cf-wasm/photon) and feed
// pixels in here. ONE implementation, shared by browser and Workers — a one-bit drift
// between two impls destroys matching (architectural invariant, plan/01 §1, 03 §1).

const SIZE = 32; // downscale target
const KEEP = 8; // top-left DCT block kept (64 coefficients)

/**
 * Rec. 601 luma from RGBA bytes, compositing alpha over white first.
 * @returns Float64 luma, length width*height, row-major.
 */
export function lumaFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): Float64Array {
  if (rgba.length < width * height * 4) throw new Error("rgba shorter than width*height*4");
  const out = new Float64Array(width * height);
  for (let p = 0; p < width * height; p++) {
    const r = rgba[p * 4]!;
    const g = rgba[p * 4 + 1]!;
    const b = rgba[p * 4 + 2]!;
    const a = rgba[p * 4 + 3]! / 255;
    const rr = r * a + 255 * (1 - a);
    const gg = g * a + 255 * (1 - a);
    const bb = b * a + 255 * (1 - a);
    out[p] = 0.299 * rr + 0.587 * gg + 0.114 * bb;
  }
  return out;
}

/**
 * Area-average (box) downscale of a luma plane to 32×32, with fractional edge coverage.
 * Our own resampler — never the platform's (canvas scaling is not cross-browser identical).
 * @returns Float64 length 32*32, row-major [row i][col j].
 */
export function boxDownscale32(luma: Float64Array, width: number, height: number): Float64Array {
  const out = new Float64Array(SIZE * SIZE);
  for (let i = 0; i < SIZE; i++) {
    const y0 = (i * height) / SIZE;
    const y1 = ((i + 1) * height) / SIZE;
    for (let j = 0; j < SIZE; j++) {
      const x0 = (j * width) / SIZE;
      const x1 = ((j + 1) * width) / SIZE;
      let sum = 0;
      let wsum = 0;
      for (let y = Math.floor(y0); y < Math.min(height, Math.ceil(y1)); y++) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        if (wy <= 0) continue;
        for (let x = Math.floor(x0); x < Math.min(width, Math.ceil(x1)); x++) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          if (wx <= 0) continue;
          const w = wy * wx;
          sum += luma[y * width + x]! * w;
          wsum += w;
        }
      }
      out[i * SIZE + j] = wsum > 0 ? sum / wsum : 0;
    }
  }
  return out;
}

// Precomputed cosine table: cos[k][n] = cos((2n+1) k π / (2*SIZE)), k in 0..KEEP-1, n in 0..SIZE-1.
const COS = (() => {
  const t: number[][] = [];
  for (let k = 0; k < KEEP; k++) {
    const row = new Array<number>(SIZE);
    for (let n = 0; n < SIZE; n++) row[n] = Math.cos(((2 * n + 1) * k * Math.PI) / (2 * SIZE));
    t.push(row);
  }
  return t;
})();
const ALPHA = (k: number): number => (k === 0 ? Math.sqrt(1 / SIZE) : Math.sqrt(2 / SIZE));

/** Top-left 8×8 orthonormal 2-D DCT-II coefficients of a 32×32 grid (row-major, 64 values). */
export function dctTopLeft(grid32: Float64Array): Float64Array {
  const c = new Float64Array(KEEP * KEEP);
  for (let u = 0; u < KEEP; u++) {
    const cu = COS[u]!;
    for (let v = 0; v < KEEP; v++) {
      const cv = COS[v]!;
      let sum = 0;
      for (let x = 0; x < SIZE; x++) {
        const cux = cu[x]!;
        const rowoff = x * SIZE;
        let inner = 0;
        for (let y = 0; y < SIZE; y++) inner += grid32[rowoff + y]! * cv[y]!;
        sum += cux * inner;
      }
      c[u * KEEP + v] = ALPHA(u) * ALPHA(v) * sum;
    }
  }
  return c;
}

/** Median of 64 coefficients = mean of the 32nd and 33rd order statistics. */
export function median64(coeffs: Float64Array): number {
  const s = Array.from(coeffs).sort((a, b) => a - b);
  return (s[31]! + s[32]!) / 2;
}

/**
 * Pack 64 coefficients into a 64-bit hash: bit(8u+v)=1 iff C>median (STRICT);
 * bit(0)=(u=0,v=0) is the MSB. Returns an unsigned BigInt in [0, 2^64).
 */
export function packHash(coeffs: Float64Array): bigint {
  const m = median64(coeffs);
  let v = 0n;
  for (let k = 0; k < 64; k++) {
    if (coeffs[k]! > m) v |= 1n << BigInt(63 - k);
  }
  return v;
}

/** 16 lowercase hex chars of an unsigned 64-bit value. */
export function hashToHex(v: bigint): string {
  return v.toString(16).padStart(16, "0");
}

/** Full OzDNA pHash v1 over decoded RGBA pixels → 16-hex string (steps 2–7). */
export function phashFromRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number): string {
  const luma = lumaFromRgba(rgba, width, height);
  const grid = boxDownscale32(luma, width, height);
  const coeffs = dctTopLeft(grid);
  return hashToHex(packHash(coeffs));
}
