// The anchor cron cycle (plan/03 §3.4, plan/01 §6). One run: pull pending records → build the
// Merkle batch → open the batch row + attach records → submit the root through the injected
// AnchorBackend → independently verify → finalize. Pure over (repo, backend): the NullAdapter
// makes the whole path run offline; a viem BaseAdapter (apps/anchor only) is the real edge.

import type { AnchorBackend } from "@ozdna/anchor-backends";
import { buildBatch } from "./batch.js";
import type { AnchorRepo } from "./repo.js";

export interface CycleDeps {
  /** Fresh batch id, e.g. `bat_<ULID>` (crypto in prod, fixed in tests). */
  newBatchId(): string;
  /** ISO-8601 UTC string for confirmation timestamps. */
  nowIso(): string;
  /** Anchor contract address recorded on batches/proofs (01-ARCHITECTURE). */
  contract: string;
  /** Max records per batch (03 §3.4; tree size is padded implicitly by promotion). */
  maxBatch: number;
}

export interface CycleResult {
  readonly batched: number;
  readonly batchId?: string;
  readonly txHash?: string;
  readonly status: "idle" | "submitted" | "confirmed" | "failed";
}

export async function runAnchorCycle(repo: AnchorRepo, backend: AnchorBackend, deps: CycleDeps): Promise<CycleResult> {
  const pending = await repo.getPendingRecords(deps.maxBatch);
  if (pending.length === 0) return { batched: 0, status: "idle" };

  const batchId = deps.newBatchId();
  const built = await buildBatch(pending, batchId);

  await repo.createBatch(batchId, built.rootHex, built.leafCount, backend.chainId);
  await repo.assignRecordsToBatch(
    batchId,
    built.entries.map((e) => ({ recordId: e.record.id, leafIndex: e.leafIndex })),
  );

  let receipt;
  try {
    receipt = await backend.anchor(built.root, batchId);
  } catch {
    await repo.markBatchFailed(batchId);
    return { batched: built.leafCount, batchId, status: "failed" };
  }
  await repo.markBatchSubmitted(batchId, receipt.txid);

  // Independent confirmation against the public chain (NullAdapter confirms synchronously; a
  // real chain may still be 'pending' here — then we leave it submitted for a later cycle).
  const status = await backend.verify(receipt, built.root);
  if (status === "confirmed" && receipt.blockTime !== undefined) {
    const blockNumber = typeof receipt.raw?.blockNumber === "number" ? receipt.raw.blockNumber : 0;
    await repo.finalizeBatchConfirmed(batchId, blockNumber, deps.nowIso());
    return { batched: built.leafCount, batchId, txHash: receipt.txid, status: "confirmed" };
  }

  return { batched: built.leafCount, batchId, txHash: receipt.txid, status: "submitted" };
}
