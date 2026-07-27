// D1-backed AnchorRepo (drizzle). Production edge, swapped in at the Worker's scheduled().
//
// UNVERIFIED IN THIS ENV: no workerd/D1 here, so this is not covered by the node cycle tests
// (those use test/fakes.ts). Verify in `wrangler dev` before launch. Same phash64 64-bit
// precision caveat as apps/api (ledger D1a): here we read phash64 back to a 16-hex fingerprint
// via BigInt(number) — exact only ≤2^53; the leaf preimage depends on it, so this MUST move to
// a TEXT-hex read before real anchoring or two records could collide/diverge on their leaves.

import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { hashToHex, pdq256ToHex, toUnsignedU64 } from "@ozdna/dna-core";
import { anchorBatches, records } from "@ozdna/db";
import type { PendingRecord } from "./batch.js";
import type { AnchorRepo } from "./repo.js";

type Db = ReturnType<typeof drizzle>;

/** Anonymous web-sign records have no user; the leaf still needs a stable account_id (§3.2). */
const ANON_ACCOUNT = "usr_anonymous";

export class D1AnchorRepo implements AnchorRepo {
  private readonly db: Db;
  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getPendingRecords(limit: number): Promise<PendingRecord[]> {
    const rows = await this.db
      .select()
      .from(records)
      .where(and(eq(records.status, "registered"), eq(records.isTest, 0)))
      .orderBy(records.createdAt, records.id)
      .limit(limit);
    return rows.map((r) => ({
      id: r.id,
      sha256Hex: r.sha256,
      phash64Hex: hashToHex(toUnsignedU64(BigInt(r.phash64))), // see precision caveat above
      pdq256Hex: r.pdq256 ? pdq256ToHex(new Uint8Array(r.pdq256 as ArrayBuffer)) : null,
      manifestSha256Hex: r.manifestSha256 ?? null,
      accountId: r.userId ?? ANON_ACCOUNT,
      registeredAt: r.createdAt,
    }));
  }

  async createBatch(batchId: string, rootHex: string, recordCount: number, chain: string): Promise<void> {
    await this.db.insert(anchorBatches).values({ id: batchId, chain, merkleRoot: rootHex, recordCount, status: "pending" });
  }

  async assignRecordsToBatch(batchId: string, assignments: readonly { recordId: string; leafIndex: number }[]): Promise<void> {
    for (const a of assignments) {
      await this.db
        .update(records)
        .set({ anchorBatchId: batchId, leafIndex: a.leafIndex, status: "anchoring" })
        .where(eq(records.id, a.recordId));
    }
  }

  async markBatchSubmitted(batchId: string, txHash: string): Promise<void> {
    await this.db.update(anchorBatches).set({ status: "submitted", txHash }).where(eq(anchorBatches.id, batchId));
  }

  async finalizeBatchConfirmed(batchId: string, blockNumber: number, confirmedAt: string): Promise<void> {
    await this.db
      .update(anchorBatches)
      .set({ status: "confirmed", blockNumber, confirmedAt })
      .where(eq(anchorBatches.id, batchId));
    await this.db
      .update(records)
      .set({ status: "anchored", anchoredAt: confirmedAt })
      .where(eq(records.anchorBatchId, batchId));
  }

  async markBatchFailed(batchId: string): Promise<void> {
    await this.db.update(anchorBatches).set({ status: "failed" }).where(eq(anchorBatches.id, batchId));
  }
}
