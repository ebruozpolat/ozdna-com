// Cloudflare Workers PDQ hasher — Emscripten factory + wasmBinary (no document/fs).
// Import `@ozdna/dna-core/pdq-worker`. Caller supplies createPDQModule from vendored glue
// (app/vendor/pdq-wasm/wasm/pdq.js) plus the .wasm bytes — see spike caveat 2.

import type { Pdq256Result, PdqHasher, PdqImageInput } from "./pdq.js";
import { PDQ_HASH_BYTES, pdq256ToHex } from "./pdq.js";

type EmModule = {
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;
  _pdq_hash_from_rgb(
    rgb: number,
    width: number,
    height: number,
    hashOut: number,
    qualityOut: number,
  ): number;
  _pdq_hash_from_gray(
    gray: number,
    width: number,
    height: number,
    hashOut: number,
    qualityOut: number,
  ): number;
};

export type PdqCreateModule = (opts: { wasmBinary: ArrayBuffer | Uint8Array }) => Promise<EmModule>;

let mod: EmModule | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Initialize PDQ in a Worker isolate from the vendored binary bytes.
 * @param wasmBinary Contents of `app/vendor/pdq-wasm/wasm/pdq.wasm`
 * @param createModule Emscripten factory from `vendor/pdq-wasm/wasm/pdq.js`
 */
export function initPdqWorker(
  wasmBinary: ArrayBuffer | Uint8Array,
  createModule: PdqCreateModule,
): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const binary =
        wasmBinary instanceof Uint8Array
          ? wasmBinary.buffer.slice(
              wasmBinary.byteOffset,
              wasmBinary.byteOffset + wasmBinary.byteLength,
            )
          : wasmBinary;
      mod = await createModule({ wasmBinary: binary as ArrayBuffer });
    })();
  }
  return initPromise;
}

function requireMod(): EmModule {
  if (!mod)
    throw new Error("initPdqWorker(wasmBinary, createModule) must be called before hashing");
  return mod;
}

function hashWithModule(image: PdqImageInput): Pdq256Result {
  const m = requireMod();
  const pixels = image.data;
  const pixPtr = m._malloc(pixels.byteLength);
  const hashPtr = m._malloc(PDQ_HASH_BYTES);
  const qualPtr = m._malloc(4);
  try {
    m.HEAPU8.set(pixels, pixPtr);
    const rc =
      image.channels === 1
        ? m._pdq_hash_from_gray(pixPtr, image.width, image.height, hashPtr, qualPtr)
        : m._pdq_hash_from_rgb(pixPtr, image.width, image.height, hashPtr, qualPtr);
    if (rc !== 0) throw new Error(`pdq hash failed (code ${rc})`);
    const hash = m.HEAPU8.slice(hashPtr, hashPtr + PDQ_HASH_BYTES);
    const quality = m.HEAP32[qualPtr >> 2]!;
    return { hash, quality };
  } finally {
    m._free(pixPtr);
    m._free(hashPtr);
    m._free(qualPtr);
  }
}

export async function pdqHashWorker(image: PdqImageInput): Promise<Pdq256Result & { hex: string }> {
  if (!initPromise) {
    throw new Error("initPdqWorker(wasmBinary, createModule) must be called before hashing");
  }
  await initPromise;
  const result = hashWithModule(image);
  return { ...result, hex: pdq256ToHex(result.hash) };
}

export const workerPdqHasher: PdqHasher = {
  hash(image: PdqImageInput): Pdq256Result {
    return hashWithModule(image);
  },
};
