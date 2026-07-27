import { describe, expect, it } from "vitest";
import { initPdq, pdqConfirms, pdqFromPixels, pdqHamming } from "../src/pdq.js";
import { THRESHOLDS } from "../src/verdict.js";

describe("pdq-wasm wrapper (plan/03 §1.4)", () => {
  it("hashes a synthetic grayscale gradient deterministically", async () => {
    await initPdq();
    const w = 64;
    const h = 64;
    const data = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) data[y * w + x] = Math.floor((x / w) * 255);

    const a = await pdqFromPixels({ data, width: w, height: h, channels: 1 });
    const b = await pdqFromPixels({ data, width: w, height: h, channels: 1 });
    expect(a.hex).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash.byteLength).toBe(32);
    expect(a.hex).toBe(b.hex);
    expect(pdqHamming(a.hash, b.hash)).toBe(0);
  });

  it("distance between different images is usually > confirm threshold", async () => {
    await initPdq();
    const w = 64;
    const h = 64;
    const g1 = new Uint8Array(w * h);
    const g2 = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
      g1[i] = i % 256;
      g2[i] = 255 - (i % 256);
    }
    const a = await pdqFromPixels({ data: g1, width: w, height: h, channels: 1 });
    const b = await pdqFromPixels({ data: g2, width: w, height: h, channels: 1 });
    const d = pdqHamming(a.hex, b.hex);
    expect(d).toBeGreaterThan(THRESHOLDS.pdqConfirm);
    expect(pdqConfirms(d)).toBe(false);
  });
});
