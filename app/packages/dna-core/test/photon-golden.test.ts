import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { hammingHex } from "../src/bands.js";
import { decodeAndOrient } from "../src/decode-node.js";
import { decodeAndOrientPhoton } from "../src/decode-photon.js";
import { phashFromRgba } from "../src/phash.js";
import expected from "./fixtures/golden/expected-hashes.json";

const goldenDir = join(dirname(fileURLToPath(import.meta.url)), "fixtures/golden");

describe("cross-decoder golden (photon vs jpeg-js/pngjs, plan/03 §1.3)", () => {
  for (const img of expected.images) {
    it(`${img.file}: photon within d≤2 of node lock (locked d=${img.cross_decoder_hamming})`, async () => {
      const bytes = new Uint8Array(readFileSync(join(goldenDir, img.file)));
      const node = decodeAndOrient(bytes, img.mime as "image/jpeg" | "image/png");
      const photon = await decodeAndOrientPhoton(bytes);

      expect(photon.width).toBe(img.displayWidth);
      expect(photon.height).toBe(img.displayHeight);

      const hNode = phashFromRgba(node.data, node.width, node.height);
      const hPhoton = phashFromRgba(photon.data, photon.width, photon.height);
      expect(hNode).toBe(img.phash16);
      expect(hPhoton).toBe(img.phash16_photon);

      const d = hammingHex(hNode, hPhoton);
      expect(d).toBe(img.cross_decoder_hamming);
      expect(d).toBeLessThanOrEqual(2);
    }, 30_000);
  }
});
