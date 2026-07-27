// Self-contained inclusion proof document (plan/03 §3.7 / plan/04 §4.4, "ozdna-proof-v1").
// Pure: given a built batch entry + the confirmed chain facts, produce the JSON a skeptic can
// verify with NO OzDNA API call (rebuild the leaf → fold the siblings → compare to the on-chain
// root). Shape is validated by dna-core's inclusionProofSchema.
//
// Hash encoding note: the schema (and dna-core foldProof/verifyProof) use BARE lowercase hex
// for leaf + proof-step hashes, so this doc emits bare hex there. tx_hash is passed through
// from the chain receipt as-is (0x-prefixed on real chains). merkle_root is bare hex to match
// the fold inputs. (The §4.4 example shows 0x on those hash fields; the runtime schema is the
// binding contract and it is bare-hex — we follow the schema.)

import type { InclusionProof } from "@ozdna/dna-core";
import type { BatchEntry } from "./batch.js";

export interface ChainFacts {
  readonly batchId: string;
  readonly chain: string; // 'base-mainnet' | 'null' | …
  readonly contract: string; // anchor contract address (01-ARCHITECTURE)
  readonly txHash: string; // from the anchor receipt
  readonly blockNumber: number;
  readonly blockTime: string; // ISO-8601 UTC
  readonly rootHex: string; // bare hex, batch Merkle root
  readonly leafCount: number;
}

const VERIFY_DOCS = "https://ozdna.com/docs/verify-an-anchor";
const LEAF_CONSTRUCTION =
  "per plan/03-ALGORITHMS.md §3.2 (concatenate the record fields above, prepend 0x00, SHA-256)";

export function buildProofDocument(entry: BatchEntry, facts: ChainFacts): InclusionProof {
  const r = entry.record;
  return {
    version: "ozdna-proof-v1",
    record: {
      id: r.id,
      sha256: r.sha256Hex,
      phash64: r.phash64Hex,
      pdq256: r.pdq256Hex ?? null,
      manifest_sha256: r.manifestSha256Hex ?? null,
      account_id: r.accountId,
      registered_at: r.registeredAt,
    },
    batch_id: facts.batchId,
    chain: facts.chain,
    contract: facts.contract,
    tx_hash: facts.txHash,
    block_number: facts.blockNumber,
    block_time: facts.blockTime,
    merkle_root: facts.rootHex,
    leaf: entry.leafHex,
    leaf_index: entry.leafIndex,
    leaf_count: facts.leafCount,
    proof: entry.proof,
    hash_algorithm: "sha256",
    leaf_construction: LEAF_CONSTRUCTION,
    verify_instructions_url: VERIFY_DOCS,
  };
}
