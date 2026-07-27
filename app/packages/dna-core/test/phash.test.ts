import { describe, expect, it } from "vitest";
import { hammingHex } from "../src/bands.js";
import { phashFromRgba } from "../src/phash.js";

/** Build a deterministic RGBA image; channel value = f(x,y) clamped to [0,255]. */
function makeRgba(w: number, h: number, f: (x: number, y: number) => number): Uint8Array {
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = Math.max(0, Math.min(255, Math.round(f(x, y))));
      const p = (y * w + x) * 4;
      rgba[p] = v;
      rgba[p + 1] = v;
      rgba[p + 2] = v;
      rgba[p + 3] = 255;
    }
  }
  return rgba;
}

describe("OzDNA pHash v1 (03 §1.3)", () => {
  it("is deterministic and 16 lowercase hex chars", () => {
    const img = makeRgba(40, 30, (x, y) => 8 * x + 4 * y);
    const a = phashFromRgba(img, 40, 30);
    const b = phashFromRgba(img, 40, 30);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it("is invariant to a positive brightness scale (median threshold property)", () => {
    // B = 2*A, all values stay ≤ 240 → coefficients scale ×2, median ×2, comparisons unchanged
    const a = makeRgba(48, 36, (x, y) => 20 + ((x * 3 + y * 2) % 100)); // in [20,119]
    const b = makeRgba(48, 36, (x, y) => 2 * (20 + ((x * 3 + y * 2) % 100)));
    expect(phashFromRgba(a, 48, 36)).toBe(phashFromRgba(b, 48, 36));
  });

  it("distinct structures produce different hashes", () => {
    const horizontal = phashFromRgba(makeRgba(64, 64, (x) => 4 * x), 64, 64);
    const vertical = phashFromRgba(makeRgba(64, 64, (_x, y) => 4 * y), 64, 64);
    expect(horizontal).not.toBe(vertical);
    expect(hammingHex(horizontal, vertical)).toBeGreaterThan(0);
  });

  it("survives a downscale of the same structure within a small Hamming distance", () => {
    const full = phashFromRgba(makeRgba(128, 96, (x, y) => 2 * x + y), 128, 96);
    const small = phashFromRgba(makeRgba(64, 48, (x, y) => 2 * (2 * x) + 2 * y), 64, 48); // same gradient, half res
    expect(hammingHex(full, small)).toBeLessThanOrEqual(6);
  });
});
