// Runtime schemas (zod) for the data shapes dna-core produces/consumes.
// Field shapes track plan/04-MVP-SPEC.md §4/§5 and plan/03-ALGORITHMS.md §3.2/§3.7.
// Full HTTP request/response schemas live with apps/api (later); these cover the shared
// primitives: leaf record, inclusion proof, verdict.

import { z } from "zod";
import { VERDICTS } from "./verdict.js";

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected 64 lowercase hex");
const phash64Hex = z.string().regex(/^[0-9a-f]{16}$/, "expected 16 lowercase hex");
const pdq256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected 64 lowercase hex");
const prefixedId = z.string().regex(/^[a-z]+_[0-9A-Za-z]+$/, "expected prefixed id, e.g. rec_…");
const isoUtcMs = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "expected ISO-8601 UTC with ms");

/** LeafRecord (plan/03 §3.2 fields that go into the leaf preimage). */
export const leafRecordSchema = z.object({
  id: prefixedId,
  sha256Hex,
  phash64Hex,
  pdq256Hex: pdq256Hex.nullish(),
  manifestSha256Hex: sha256Hex.nullish(),
  accountId: prefixedId,
  registeredAt: isoUtcMs,
});
export type LeafRecordInput = z.infer<typeof leafRecordSchema>;

export const proofStepSchema = z.object({
  pos: z.enum(["left", "right"]),
  hash: sha256Hex,
});

/** Self-contained inclusion proof (plan/03 §3.7 / plan/04 §4.4, "ozdna-proof-v1"). */
export const inclusionProofSchema = z.object({
  version: z.literal("ozdna-proof-v1"),
  record: z.object({
    id: prefixedId,
    sha256: sha256Hex,
    phash64: phash64Hex,
    pdq256: pdq256Hex.nullish(),
    manifest_sha256: sha256Hex.nullish(),
    account_id: prefixedId,
    registered_at: isoUtcMs,
  }),
  batch_id: prefixedId,
  chain: z.string(),
  contract: z.string(),
  tx_hash: z.string(),
  block_number: z.number().int().nonnegative(),
  block_time: z.string(),
  merkle_root: z.string(),
  leaf: sha256Hex,
  leaf_index: z.number().int().nonnegative(),
  leaf_count: z.number().int().positive(),
  proof: z.array(proofStepSchema),
  hash_algorithm: z.literal("sha256"),
  leaf_construction: z.string(),
  verify_instructions_url: z.string().url(),
});
export type InclusionProof = z.infer<typeof inclusionProofSchema>;

/** Verdict enum as a runtime schema. */
export const verdictSchema = z.enum(VERDICTS as unknown as [string, ...string[]]);
