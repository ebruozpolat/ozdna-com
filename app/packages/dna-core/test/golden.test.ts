import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hammingHex } from "../src/bands.js";
import { decodeAndOrient, decodeImageBytes } from "../src/decode-node.js";
import { readJpegOrientation } from "../src/exif.js";
import { applyOrientation } from "../src/orient.js";
import { phashFromRgba } from "../src/phash.js";
import expected from "./fixtures/golden/expected-hashes.json";

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

type ExpectedImage = (typeof expected.images)[number];

describe("golden-image corpus (plan/03 §1.3 C5 / plan/09 §7)", () => {
  it("has ≥5 images including Orientation=6 and near-flat", () => {
    expect(expected.images.length).toBeGreaterThanOrEqual(5);
    expect(expected.images.some((i) => i.fileOrientation === 6)).toBe(true);
    expect(expected.images.some((i) => i.file.includes("near-flat"))).toBe(true);
  });

  for (const img of expected.images as ExpectedImage[]) {
    it(`reproduces phash for ${img.file}`, () => {
      const bytes = new Uint8Array(readFileSync(join(goldenDir, img.file)));
      const oriented = decodeAndOrient(bytes, img.mime as "image/jpeg" | "image/png");
      expect(oriented.width).toBe(img.displayWidth);
      expect(oriented.height).toBe(img.displayHeight);
      expect(oriented.orientationApplied).toBe(img.fileOrientation);
      const hash = phashFromRgba(oriented.data, oriented.width, oriented.height);
      // Same decoder family (jpeg-js/pngjs) → exact match
      expect(hash).toBe(img.phash16);
    });
  }

  it("Orientation=6 changes hash vs skipping step-0 (regression catch)", () => {
    const meta = expected.images.find((i) => i.file === "06-portrait-orient6.jpg");
    expect(meta).toBeDefined();
    expect(meta!.fileOrientation).toBe(6);
    expect(meta!.hamming_step0_delta).toBeGreaterThan(0);

    const bytes = new Uint8Array(readFileSync(join(goldenDir, "06-portrait-orient6.jpg")));
    expect(readJpegOrientation(bytes)).toBe(6);

    const raw = decodeImageBytes(bytes, "image/jpeg");
    expect(raw.fileOrientation).toBe(6);
    expect(raw.width).toBe(96);
    expect(raw.height).toBe(64);

    const withStep0 = decodeAndOrient(bytes, "image/jpeg");
    expect(withStep0.width).toBe(64);
    expect(withStep0.height).toBe(96);

    const h0 = phashFromRgba(raw.data, raw.width, raw.height);
    const h1 = phashFromRgba(withStep0.data, withStep0.width, withStep0.height);
    expect(h1).toBe(meta!.phash16);
    expect(h0).toBe(meta!.phash16_without_step0);
    expect(hammingHex(h0, h1)).toBe(meta!.hamming_step0_delta);
  });
});

describe("applyOrientation (step 0 transforms)", () => {
  it("orientation 6 rotates 90 CW and swaps dimensions", () => {
    // 2×3: unique colors per pixel
    const w = 2;
    const h = 3;
    const src = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      src[i * 4] = i * 10;
      src[i * 4 + 1] = 0;
      src[i * 4 + 2] = 0;
      src[i * 4 + 3] = 255;
    }
    const out = applyOrientation(src, w, h, 6);
    expect(out.width).toBe(3);
    expect(out.height).toBe(2);
    // (0,2)=40 → (0,0); (0,0)=0 → (2,0)
    expect(out.data[0]).toBe(40);
    expect(out.data[(0 * 3 + 2) * 4]).toBe(0);
  });

  it("orientation 1 is identity dimensions", () => {
    const src = new Uint8Array(16).fill(128);
    src[3] = 255;
    const out = applyOrientation(src, 2, 2, 1);
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    expect([...out.data]).toEqual([...src]);
  });
});
