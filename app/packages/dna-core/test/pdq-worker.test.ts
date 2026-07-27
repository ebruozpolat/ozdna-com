import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { pdqDistance } from "../src/pdq.js";
import { initPdqNode, pdqHashNode } from "../src/pdq-node.js";
import type { PdqCreateModule } from "../src/pdq-worker.js";
import { initPdqWorker, pdqHashWorker } from "../src/pdq-worker.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const wasmPath = join(root, "vendor/pdq-wasm/wasm/pdq.wasm");
const gluePath = join(root, "vendor/pdq-wasm/wasm/pdq.js");

describe("pdq-worker vs pdq-node (bit-exact)", () => {
  beforeAll(async () => {
    await initPdqNode();
    const require = createRequire(import.meta.url);
    const loaded = require(gluePath) as PdqCreateModule | { default: PdqCreateModule };
    const createPDQModule = typeof loaded === "function" ? loaded : loaded.default;
    const wasm = readFileSync(wasmPath);
    await initPdqWorker(wasm, createPDQModule);
  });

  it("hashes the same gradient identically", async () => {
    const w = 64;
    const h = 48;
    const data = new Uint8Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 3;
        data[i] = Math.round((x / (w - 1)) * 255);
        data[i + 1] = Math.round(data[i]! * 0.5);
        data[i + 2] = y * 4;
      }
    }
    const img = { data, width: w, height: h, channels: 3 as const };
    const node = await pdqHashNode(img);
    const worker = await pdqHashWorker(img);
    expect(worker.hex).toBe(node.hex);
    expect(pdqDistance(node.hash, worker.hash)).toBe(0);
    expect(worker.quality).toBe(node.quality);
  });
});
