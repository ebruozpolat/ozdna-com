// In-memory AnchorRepo + record factory for node tests.

import type { PendingRecord } from "../src/batch.js";
import type { AnchorRepo } from "../src/repo.js";

export class FakeAnchorRepo implements AnchorRepo {
  pending: PendingRecord[] = [];
  readonly calls: string[] = [];
  batch?: { batchId: string; rootHex: string; recordCount: number; chain: string; status: string; txHash?: string; blockNumber?: number; confirmedAt?: string };
  assignments: { recordId: string; leafIndex: number }[] = [];

  async getPendingRecords(limit: number): Promise<PendingRecord[]> {
    this.calls.push("getPendingRecords");
    return this.pending.slice(0, limit);
  }
  async createBatch(batchId: string, rootHex: string, recordCount: number, chain: string): Promise<void> {
    this.calls.push("createBatch");
    this.batch = { batchId, rootHex, recordCount, chain, status: "pending" };
  }
  async assignRecordsToBatch(_batchId: string, assignments: readonly { recordId: string; leafIndex: number }[]): Promise<void> {
    this.calls.push("assignRecordsToBatch");
    this.assignments = [...assignments];
  }
  async markBatchSubmitted(_batchId: string, txHash: string): Promise<void> {
    this.calls.push("markBatchSubmitted");
    if (this.batch) {
      this.batch.status = "submitted";
      this.batch.txHash = txHash;
    }
  }
  async finalizeBatchConfirmed(_batchId: string, blockNumber: number, confirmedAt: string): Promise<void> {
    this.calls.push("finalizeBatchConfirmed");
    if (this.batch) {
      this.batch.status = "confirmed";
      this.batch.blockNumber = blockNumber;
      this.batch.confirmedAt = confirmedAt;
    }
  }
  async markBatchFailed(_batchId: string): Promise<void> {
    this.calls.push("markBatchFailed");
    if (this.batch) this.batch.status = "failed";
  }
}

let seq = 0;
/** Deterministic pending record. `at` sets registered_at so ordering can be exercised. */
export function makePending(id: string, at: string, over: Partial<PendingRecord> = {}): PendingRecord {
  seq += 1;
  const h = (c: string) => c.repeat(64);
  return {
    id,
    sha256Hex: h(((seq % 15) + 1).toString(16)),
    phash64Hex: "a1b2c3d4e5f60718",
    pdq256Hex: null,
    manifestSha256Hex: null,
    accountId: "usr_01JZX0AAAAAAAAAAAAAAAAAAAA",
    registeredAt: at,
    ...over,
  };
}
