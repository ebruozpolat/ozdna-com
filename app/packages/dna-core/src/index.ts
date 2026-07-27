// @ozdna/dna-core — THE shared math, one copy imported by browser AND Workers.
// Algorithm spec is owned by plan/03-ALGORITHMS.md; this is the implementation.
// v1 foundation: SHA-256 helpers, Merkle tree, leaf preimage, OzDNA pHash v1, bands,
// verdict enum + threshold mapping (plan/03 §6.3/§1.5), zod schemas, PDQ-256 distance +
// hasher contract (plan/03 §1.4; the wasm producer is platform-injected, not bundled here).
//
// Decode / wasm hash paths are NOT re-exported here — they break Workers bundles.
// Import `@ozdna/dna-core/node`, `/photon`, or `/pdq` (pure distance API) explicitly.
// Optional Node hashing adapter: `@ozdna/dna-core/pdq-node` (createRequire → pdq-wasm).

export * from "./bands.js";
export * from "./exif.js";
export * from "./leaf.js";
export * from "./match.js";
export * from "./merkle.js";
export * from "./orient.js";
export * from "./pdq.js";
export * from "./phash.js";
export * from "./schema.js";
export * from "./sha256.js";
export * from "./verdict.js";
