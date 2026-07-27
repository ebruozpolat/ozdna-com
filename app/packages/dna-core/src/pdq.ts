// PDQ-256 — the SECONDARY (confirmation/scoring) perceptual hash, normative per
// plan/03-ALGORITHMS.md §1.4/§1.5. pHash (§1.3) does cheap indexing; PDQ confirms each
// candidate at Hamming distance ≤ 31 of 256, which drives the false-positive rate to
// effectively zero (§1.5 math). Stored from day one as the nullable `pdq256` BLOB (04 §5).
//
// SCOPE OF THIS MODULE — the PURE, canonical half only: distance, encoding, and the
// confirmation predicate. It has NO wasm dependency, exactly like anchor-backends keeps
// viem out of the shared layer: dna-core stays pure and fast, and the platform injects the
// hasher (see PdqHasher below).
//
// The 256-bit HASH ITSELF is produced ONLY by Meta's reference PDQ via the vendored
// `pdq-wasm` build (app/vendor/pdq-wasm/, BSD-3; spike verified 2026-07-27 —
// app/docs/pdq-spike-2026-07-27.md). It is DELIBERATELY NOT reimplemented in TypeScript:
// PDQ's entire value is that it is the industry-standard hash, so a non-bit-exact JS clone
// would be worthless for cross-tool interop and could silently diverge from every other
// PDQ producer. Distance/encoding, by contrast, are unambiguous and safe to own here.

/** PDQ hash width: 32 bytes = 256 bits (03 §1.4). */
export const PDQ_HASH_BYTES = 32;
export const PDQ_HASH_BITS = 256;

/**
 * Published PDQ near-duplicate threshold: Hamming distance ≤ 31 of 256 (Meta's own
 * production value, 03 §1.4/§1.5). Confirmation stage only — never a standalone verdict.
 * MUST equal verdict.THRESHOLDS.pdqConfirm (pdq.test.ts asserts they stay in lockstep).
 */
export const PDQ_CONFIRM_MAX = 31;

const BYTE_POPCOUNT = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) t[i] = (i & 1) + t[i >> 1]!;
  return t;
})();

function assertPdq(bytes: Uint8Array, label: string): void {
  if (bytes.length !== PDQ_HASH_BYTES) {
    throw new Error(`${label}: PDQ hash must be ${PDQ_HASH_BYTES} bytes, got ${bytes.length}`);
  }
}

/**
 * Hamming distance between two 256-bit PDQ hashes (0 = identical … 256 = opposite).
 * XOR byte-wise, sum a precomputed popcount table — the scorer's inner loop (03 §2.5).
 */
export function pdqDistance(a: Uint8Array, b: Uint8Array): number {
  assertPdq(a, "pdqDistance(a)");
  assertPdq(b, "pdqDistance(b)");
  let d = 0;
  for (let i = 0; i < PDQ_HASH_BYTES; i++) d += BYTE_POPCOUNT[a[i]! ^ b[i]!]!;
  return d;
}

/** Does a PDQ distance confirm a candidate? (d ≤ threshold; default 31 of 256, §1.5). */
export function pdqConfirms(distance: number, threshold: number = PDQ_CONFIRM_MAX): boolean {
  return distance <= threshold;
}

/** 64 lowercase hex chars of a 32-byte PDQ hash. */
export function pdq256ToHex(bytes: Uint8Array): string {
  assertPdq(bytes, "pdq256ToHex");
  let s = "";
  for (let i = 0; i < PDQ_HASH_BYTES; i++) s += bytes[i]!.toString(16).padStart(2, "0");
  return s;
}

/** Parse 64 hex chars into a 32-byte PDQ hash (rejects wrong length / non-hex). */
export function pdq256FromHex(hex: string): Uint8Array {
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(`pdq256FromHex: expected 64 hex chars, got ${JSON.stringify(hex)}`);
  }
  const out = new Uint8Array(PDQ_HASH_BYTES);
  for (let i = 0; i < PDQ_HASH_BYTES; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export interface PdqScore {
  readonly distance: number;
  readonly confirmed: boolean;
}

/** Score a query PDQ hash against a candidate: distance + whether it confirms (§1.5). */
export function scorePdq(
  query: Uint8Array,
  candidate: Uint8Array,
  threshold: number = PDQ_CONFIRM_MAX,
): PdqScore {
  const distance = pdqDistance(query, candidate);
  return { distance, confirmed: pdqConfirms(distance, threshold) };
}

// --- Hasher contract (producer is platform-injected; see module header) --------------------

/** Decoded pixels handed to the PDQ hasher. RGB (3) or grayscale (1); matches pdq-wasm. */
export interface PdqImageInput {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
  readonly channels: 1 | 3;
}

export interface Pdq256Result {
  /** The 256-bit PDQ hash, 32 bytes. */
  readonly hash: Uint8Array;
  /** PDQ quality score 0–100; low quality (near-flat images) means the hash is unreliable. */
  readonly quality: number;
}

/**
 * The platform-injected PDQ producer. The ONLY conformant implementation is Meta's
 * reference PDQ via the vendored `pdq-wasm` (app/vendor/pdq-wasm/):
 *   - Browser (apps/web): `pdq-wasm/browser` with `PDQ.init({ wasmUrl })` pointing at the
 *     vendored `pdq.wasm` served as a static asset (NOT the package's CDN default — offline
 *     + CSP). Spike caveat: the ESM Node auto-loader is broken; the browser/worker path with
 *     an explicit wasmUrl is the supported one.
 *   - Workers (apps/api metered compute): CF Workers is ESM and has no `document`, so neither
 *     the package's Node (`fs.readFileSync`) nor browser (`<script>`) loader applies —
 *     instantiate the Emscripten factory manually from the imported `pdq.wasm` binary.
 * Full findings + decision: app/docs/pdq-spike-2026-07-27.md.
 */
export interface PdqHasher {
  hash(image: PdqImageInput): Pdq256Result;
}
