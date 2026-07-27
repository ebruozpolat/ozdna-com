// I/O boundary for the anchor cron. The cycle logic depends only on this + an AnchorBackend,
// so it runs offline in node tests (test/fakes.ts) with the NullAdapter. The D1 impl (repo-d1.ts)
// is the production edge.

import type { PendingRecord } from "./batch.js";

export interface SubmittedBatch {
  readonly batchId: string;
  readonly rootHex: string;
  readonly txHash: string;
}

export interface AnchorRepo {
  /** Records awaiting anchoring: status='registered' AND is_test=0, up to `limit`. */
  getPendingRecords(limit: number): Promise<PendingRecord[]>;

  /** Open a batch row (status='pending') with its computed root + size. */
  createBatch(batchId: string, rootHex: string, recordCount: number, chain: string): Promise<void>;

  /** Attach records to the batch and move them to status='anchoring' with their leaf indices. */
  assignRecordsToBatch(batchId: string, assignments: readonly { recordId: string; leafIndex: number }[]): Promise<void>;

  /** Batch tx broadcast: status='submitted', store tx hash. */
  markBatchSubmitted(batchId: string, txHash: string): Promise<void>;

  /**
   * Batch confirmed on chain: batch → status='confirmed' (+ block number/time); its records →
   * status='anchored' (+ anchored_at). One transition, both tables (plan/04 §5).
   */
  finalizeBatchConfirmed(batchId: string, blockNumber: number, confirmedAt: string): Promise<void>;

  /** Batch tx failed/dropped: status='failed' (records stay 'anchoring' for a retry cycle). */
  markBatchFailed(batchId: string): Promise<void>;
}
