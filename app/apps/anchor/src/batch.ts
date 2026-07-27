// Pure batch builder for the anchor cron (plan/03-ALGORITHMS.md §3.2–§3.4). Takes the pending
// records, assigns leaf indices in the canonical (registered_at, id) order, builds the Merkle
// tree via dna-core (the ONE shared impl), and emits each record's inclusion proof. No I/O,
// no chain SDK — fully unit-testable; the D1 read and the chain submit are the edges (repo.ts,
// anchor-backends).

import { buildTree, hashLeaf, type LeafRecord, leafPreimage, merkleProof, type ProofStep, toHex } from "@ozdna/dna-core";

/** A record awaiting anchoring — exactly the fields §3.2 folds into the leaf preimage. */
export type PendingRecord = LeafRecord;

export interface BatchEntry {
  readonly record: PendingRecord;
  readonly leafIndex: number;
  readonly leafHex: string; // bare hex of hashLeaf(preimage) — matches dna-core proof/verify
  readonly proof: ProofStep[];
}

export interface BuiltBatch {
  readonly batchId: string;
  readonly root: Uint8Array;
  readonly rootHex: string; // bare hex
  readonly leafCount: number;
  readonly entries: BatchEntry[];
}

/** Canonical leaf order: registered_at ascending, then id ascending (03 §3.3). */
export function orderRecords(records: readonly PendingRecord[]): PendingRecord[] {
  return [...records].sort((a, b) => (a.registeredAt < b.registeredAt ? -1 : a.registeredAt > b.registeredAt ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Build a batch: order → hash leaves → tree → per-record inclusion proof. */
export async function buildBatch(records: readonly PendingRecord[], batchId: string): Promise<BuiltBatch> {
  if (records.length === 0) throw new Error("cannot build a batch with 0 records");
  const ordered = orderRecords(records);
  const leafHashes = await Promise.all(ordered.map((r) => hashLeaf(leafPreimage(r))));
  const tree = await buildTree(leafHashes);
  const entries: BatchEntry[] = ordered.map((record, leafIndex) => ({
    record,
    leafIndex,
    leafHex: toHex(leafHashes[leafIndex]!),
    proof: merkleProof(tree, leafIndex),
  }));
  return { batchId, root: tree.root, rootHex: toHex(tree.root), leafCount: ordered.length, entries };
}
