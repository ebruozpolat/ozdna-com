import { writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import jpeg from "jpeg-js";
import { PhotonImage, initPhoton } from "@cf-wasm/photon/node";
import { readJpegOrientation } from "../src/exif.js";
import { applyOrientation } from "../src/orient.js";
import { phashFromRgba } from "../src/phash.js";
import { bandsFromHex, hammingHex } from "../src/bands.js";
import { decodeAndOrient, decodeImageBytes } from "../src/decode-node.js";
import expectedOld from "../test/fixtures/golden/expected-hashes.json" with { type: "json" };

try {
  await initPhoton();
} catch {
  /* already inited */
}

function makeExifApp1(orientation: number): Uint8Array {
  const tiff = Buffer.alloc(26);
  tiff.write("II", 0);
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x0112, 10);
  tiff.writeUInt16LE(3, 12);
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt16LE(0, 20);
  tiff.writeUInt32LE(0, 22);
  const body = Buffer.concat([Buffer.from("Exif\0\0"), tiff]);
  const segLen = body.length + 2;
  const out = Buffer.alloc(2 + 2 + body.length);
  out[0] = 0xff;
  out[1] = 0xe1;
  out[2] = (segLen >> 8) & 0xff;
  out[3] = segLen & 0xff;
  body.copy(out, 4);
  return out;
}

function injectExifOrientation(jpegBytes: Uint8Array, orientation: number): Uint8Array {
  if (jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) throw new Error("not jpeg");
  const app1 = makeExifApp1(orientation);
  const out = new Uint8Array(2 + app1.length + (jpegBytes.length - 2));
  out[0] = 0xff;
  out[1] = 0xd8;
  out.set(app1, 2);
  out.set(jpegBytes.subarray(2), 2 + app1.length);
  return out;
}

function rgba(
  w: number,
  h: number,
  f: (x: number, y: number) => [number, number, number],
): Buffer {
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

const outDir = join(dirname(fileURLToPath(import.meta.url)), "../test/fixtures/golden");

{
  const W = 80;
  const H = 80;
  const data = rgba(W, H, (x, y) => {
    const cx = x - W / 2;
    const cy = y - H / 2;
    const d = Math.sqrt(cx * cx + cy * cy);
    const v = Math.max(0, Math.min(255, Math.round(255 - d * 4)));
    return [v, Math.round(v * 0.7), Math.round(v * 0.4)];
  });
  let jpg = jpeg.encode({ data, width: W, height: H }, 100).data;
  jpg = Buffer.from(injectExifOrientation(jpg, 1));
  writeFileSync(join(outDir, "05-radial.jpg"), jpg);
  console.log("wrote 05", join(outDir, "05-radial.jpg"), "orient", readJpegOrientation(jpg));
}

{
  const W = 96;
  const H = 64;
  const data = rgba(W, H, (x) => {
    const v = Math.round((x / (W - 1)) * 200 + 30);
    return [v, v, v];
  });
  let jpg = jpeg.encode({ data, width: W, height: H }, 100).data;
  jpg = Buffer.from(injectExifOrientation(jpg, 6));
  writeFileSync(join(outDir, "06-portrait-orient6.jpg"), jpg);
  console.log("wrote 06", join(outDir, "06-portrait-orient6.jpg"), "orient", readJpegOrientation(jpg), "len", jpg.length);
}

const files: Array<[string, "image/png" | "image/jpeg"]> = [
  ["01-gradient.png", "image/png"],
  ["02-checker.png", "image/png"],
  ["03-near-flat.png", "image/png"],
  ["04-stripes-v.png", "image/png"],
  ["05-radial.jpg", "image/jpeg"],
  ["06-portrait-orient6.jpg", "image/jpeg"],
];

const images: Record<string, unknown>[] = [];
for (const [name, mime] of files) {
  const bytes = new Uint8Array(readFileSync(join(outDir, name)));
  const raw = decodeImageBytes(bytes, mime);
  const node = decodeAndOrient(bytes, mime);
  const img = PhotonImage.new_from_byteslice(bytes);
  const praw = new Uint8Array(img.get_raw_pixels());
  const photon = applyOrientation(praw, img.get_width(), img.get_height(), raw.fileOrientation);
  img.free();
  const hn = phashFromRgba(node.data, node.width, node.height);
  const hp = phashFromRgba(photon.data, photon.width, photon.height);
  const d = hammingHex(hn, hp);
  console.log(name, "d=", d, "node", hn, "photon", hp, "orient", raw.fileOrientation, "disp", node.width, node.height);
  const entry: Record<string, unknown> = {
    file: name,
    mime,
    note: expectedOld.images.find((i) => i.file === name)?.note ?? name,
    fileWidth: raw.width,
    fileHeight: raw.height,
    fileOrientation: raw.fileOrientation,
    displayWidth: node.width,
    displayHeight: node.height,
    phash16: hn,
    phash16_photon: hp,
    cross_decoder_hamming: d,
    bands: bandsFromHex(hn),
  };
  if (raw.fileOrientation !== 1) {
    const without = phashFromRgba(raw.data, raw.width, raw.height);
    entry.phash16_without_step0 = without;
    entry.hamming_step0_delta = hammingHex(hn, without);
  }
  images.push(entry);
}

writeFileSync(
  join(outDir, "expected-hashes.json"),
  JSON.stringify(
    {
      _note:
        "OzDNA pHash v1 golden-image corpus (plan/03 §1.3). Node = jpeg-js/pngjs; photon = @cf-wasm/photon 0.3.6. Cross-decoder Hamming must be ≤2.",
      _decoder_node: "jpeg-js + pngjs + dna-core orient",
      _decoder_photon: "@cf-wasm/photon@0.3.6 + dna-core orient",
      images,
    },
    null,
    2,
  ) + "\n",
);

if (images.some((i) => (i.cross_decoder_hamming as number) > 2)) {
  console.error("FAIL cross-decoder d>2");
  process.exit(1);
}
console.log("OK all d≤2");
