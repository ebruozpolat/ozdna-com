// Node-only PDQ hasher — loads pdq-wasm via createRequire (ESM factory is broken).
// Import `@ozdna/dna-core/pdq-node` — never the package root (Workers bundles).
// Browser/Workers: use vendored app/vendor/pdq-wasm + explicit wasmUrl / wasmBinary
// (see app/docs/pdq-spike-2026-07-27.md).

import { createRequire } from "node:module";
import type { PDQ as PDQType } from "pdq-wasm";
import type { Pdq256Result, PdqHasher, PdqImageInput } from "./pdq.js";
import { PDQ_HASH_BYTES, pdq256ToHex } from "./pdq.js";

type PDQClass = typeof PDQType;

let PDQ: PDQClass | null = null;
let initPromise: Promise<void> | null = null;

function getPDQ(): PDQClass {
  if (!PDQ) {
    const require = createRequire(import.meta.url);
    const mod = require("pdq-wasm") as { PDQ: PDQClass };
    PDQ = mod.PDQ;
  }
  return PDQ;
}

export function initPdqNode(): Promise<void> {
  if (!initPromise) initPromise = getPDQ().init();
  return initPromise;
}

export async function pdqHashNode(image: PdqImageInput): Promise<Pdq256Result & { hex: string }> {
  await initPdqNode();
  const cls = getPDQ();
  const result = cls.hash({
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

/** PdqHasher adapter for Node/tests. */
export const nodePdqHasher: PdqHasher = {
  hash(image: PdqImageInput): Pdq256Result {
    // Sync surface required by interface; callers must await initPdqNode() first.
    const cls = getPDQ();
    const result = cls.hash({
      data: image.data,
      width: image.width,
      height: image.height,
      channels: image.channels,
    });
    return { hash: result.hash, quality: result.quality };
  },
};
