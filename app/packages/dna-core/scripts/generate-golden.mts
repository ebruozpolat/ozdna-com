#!/usr/bin/env node
/**
 * Generate ≥5 golden images for OzDNA pHash C5 (plan/03 §1.3, plan/09 §7).
 * Run: node --experimental-strip-types scripts/generate-golden.mts
 *   or: npx tsx scripts/generate-golden.mts
 *
 * Commits binaries under test/fixtures/golden/. Re-run only when intentionally
 * regenerating expected-hashes.json in the same commit.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";
import sharp from "sharp";
import { bandsFromHex, hammingHex } from "../src/bands.ts";
import { decodeAndOrient, decodeImageBytes } from "../src/decode-node.ts";
import { phashFromRgba } from "../src/phash.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "../test/fixtures/golden");
mkdirSync(outDir, { recursive: true });

function rgba(w: number, h: number, f: (x: number, y: number) => [number, number, number]): Buffer {
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      const i = (y * w + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return buf;
}

async function writePng(
  name: string,
  w: number,
  h: number,
  f: (x: number, y: number) => [number, number, number],
) {
  const data = rgba(w, h, f);
  const png = new PNG({ width: w, height: h });
  png.data = data;
  const bytes = PNG.sync.write(png);
  writeFileSync(join(outDir, name), bytes);
  return bytes;
}

async function writeJpegOrient6(name: string) {
  // Stored pixels: landscape gradient (bright on the RIGHT). Orientation=6 means
  // "rotate 90 CW for display" → display is portrait with bright at BOTTOM.
  const W = 96;
  const H = 64;
  const data = rgba(W, H, (x, y) => {
    const v = Math.round((x / (W - 1)) * 220 + 20);
    const stripe = y % 8 < 2 ? 30 : 0;
    return [Math.min(255, v + stripe), Math.min(255, v), Math.max(0, v - 40)];
  });
  // Encode JPEG without orientation, then re-tag with sharp
  const rawJpeg = jpeg.encode({ data, width: W, height: H }, 90).data;
  const tagged = await sharp(rawJpeg)
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 90 })
    .toBuffer();
  writeFileSync(join(outDir, name), tagged);
  return tagged;
}

async function writeJpegNormal(name: string) {
  const W = 80;
  const H = 80;
  const data = rgba(W, H, (x, y) => {
    const cx = x - W / 2;
    const cy = y - H / 2;
    const d = Math.sqrt(cx * cx + cy * cy);
    const v = Math.max(0, Math.min(255, Math.round(255 - d * 4)));
    return [v, Math.round(v * 0.7), Math.round(v * 0.4)];
  });
  const rawJpeg = jpeg.encode({ data, width: W, height: H }, 85).data;
  const tagged = await sharp(rawJpeg)
    .withMetadata({ orientation: 1 })
    .jpeg({ quality: 85 })
    .toBuffer();
  writeFileSync(join(outDir, name), tagged);
  return tagged;
}

const files: { name: string; mime: "image/png" | "image/jpeg"; note: string }[] = [];

await writePng("01-gradient.png", 64, 48, (x, y) => {
  const v = Math.round((x / 63) * 255);
  return [v, Math.round(v * 0.5), y * 4];
});
files.push({ name: "01-gradient.png", mime: "image/png", note: "horizontal luma gradient PNG" });

await writePng("02-checker.png", 64, 64, (x, y) => {
  const on = ((x >> 3) ^ (y >> 3)) & 1;
  const v = on ? 220 : 40;
  return [v, v, v];
});
files.push({ name: "02-checker.png", mime: "image/png", note: "8px checkerboard" });

await writePng("03-near-flat.png", 48, 48, (x, y) => {
  // Median-tie degenerate: almost constant with ±1 LSB noise
  const n = ((x * 17 + y * 31) % 3) - 1;
  const v = 128 + n;
  return [v, v, v];
});
files.push({
  name: "03-near-flat.png",
  mime: "image/png",
  note: "near-flat median-tie case (SHOULD)",
});

await writePng("04-stripes-v.png", 72, 56, (x) => {
  const v = x % 12 < 6 ? 200 : 50;
  return [v, 80, 180 - (v >> 1)];
});
files.push({ name: "04-stripes-v.png", mime: "image/png", note: "vertical color stripes" });

await writeJpegNormal("05-radial.jpg");
files.push({ name: "05-radial.jpg", mime: "image/jpeg", note: "JPEG Orientation=1 radial" });

const _orient6 = await writeJpegOrient6("06-portrait-orient6.jpg");
files.push({
  name: "06-portrait-orient6.jpg",
  mime: "image/jpeg",
  note: "MUST: EXIF Orientation=6 (phone portrait) — catches step-0 divergence",
});

const expected: Record<string, unknown> = {
  _note:
    "OzDNA pHash v1 golden-image corpus (plan/03 §1.3, plan/09 §7). Hashes computed via jpeg-js/pngjs decode + dna-core applyOrientation + phashFromRgba. Same decoder family must match exactly; cross-decoder (e.g. photon) tolerance d≤2.",
  _decoder:
    "jpeg-js@0.4 + pngjs (Node test path); EXIF via dna-core readJpegOrientation + applyOrientation",
  images: [] as unknown[],
};

for (const f of files) {
  const bytes = new Uint8Array(
    await import("node:fs").then((m) => m.readFileSync(join(outDir, f.name))),
  );
  const raw = decodeImageBytes(bytes, f.mime);
  const oriented = decodeAndOrient(bytes, f.mime);
  const hash = phashFromRgba(oriented.data, oriented.width, oriented.height);
  const bands = bandsFromHex(hash);

  let withoutOrientHash: string | null = null;
  let hammingOrientDelta: number | null = null;
  if (raw.fileOrientation !== 1) {
    withoutOrientHash = phashFromRgba(raw.data, raw.width, raw.height);
    hammingOrientDelta = hammingHex(hash, withoutOrientHash);
  }

  expected.images.push({
    file: f.name,
    mime: f.mime,
    note: f.note,
    fileWidth: raw.width,
    fileHeight: raw.height,
    fileOrientation: raw.fileOrientation,
    displayWidth: oriented.width,
    displayHeight: oriented.height,
    phash16: hash,
    bands: { band0: bands.band0, band1: bands.band1, band2: bands.band2, band3: bands.band3 },
    ...(withoutOrientHash
      ? {
          phash16_without_step0: withoutOrientHash,
          hamming_step0_delta: hammingOrientDelta,
        }
      : {}),
  });
}

// Sanity: Orientation=6 must change hash vs skipping step-0
const o6 = (expected.images as Array<{ file: string; hamming_step0_delta?: number }>).find(
  (i) => i.file === "06-portrait-orient6.jpg",
);
if (!o6 || (o6.hamming_step0_delta ?? 0) === 0) {
  console.error("FAIL: Orientation=6 fixture did not change pHash — step-0 not exercised");
  process.exit(1);
}

writeFileSync(join(outDir, "expected-hashes.json"), `${JSON.stringify(expected, null, 2)}\n`);
console.log(`Wrote ${files.length} golden images + expected-hashes.json → ${outDir}`);
console.log(JSON.stringify(expected.images, null, 2));
