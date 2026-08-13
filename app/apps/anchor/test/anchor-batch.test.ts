import { describe, expect, it } from "vitest";
import { runAnchorBatch } from "../src/index.js";

type FakeRecord = {
  id: string;
  user_id: string;
  sha256: string;
  phash64: number;
  pdq256: ArrayBuffer | null;
  created_at: string;
  status: "registered" | "anchoring" | "anchored";
  anchor_batch_id: string | null;
  leaf_index: number | null;
  anchored_at: string | null;
  is_test: number;
};

type FakeBatch = {
  id: string;
  chain: string;
  merkle_root: string;
  record_count: number;
  status: "pending" | "submitted" | "confirmed";
  tx_hash: string | null;
  created_at: string;
  confirmed_at: string | null;
};

class FakeStatement {
  private values: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async all<T>() {
    if (this.sql.includes("FROM anchor_batches") && this.sql.includes("status = 'submitted'")) {
      return {
        results: this.db.batches
          .filter((b) => b.status === "submitted" && b.merkle_root && b.tx_hash)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, 32) as T[],
      };
    }

    if (this.sql.includes("FROM records") && this.sql.includes("status = 'registered'")) {
      return {
        results: this.db.records
          .filter((r) => r.status === "registered" && r.is_test === 0)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, 256) as T[],
      };
    }

    return { results: [] as T[] };
  }

  async run() {
    if (this.sql.includes("INSERT INTO anchor_batches")) {
      const [id, chain, merkleRoot, recordCount] = this.values as [string, string, string, number];
      this.db.batches.push({
        id,
        chain,
        merkle_root: merkleRoot,
        record_count: recordCount,
        status: "pending",
        tx_hash: null,
        created_at: new Date().toISOString(),
        confirmed_at: null,
      });
      return { success: true };
    }

    if (this.sql.includes("UPDATE anchor_batches SET status = ?, tx_hash = ?")) {
      const [status, txHash, id] = this.values as [FakeBatch["status"], string, string];
      const batch = this.db.batches.find((b) => b.id === id);
      if (batch) {
        batch.status = status;
        batch.tx_hash = txHash;
      }
      return { success: true };
    }

    if (this.sql.includes("SET status = 'confirmed'")) {
      const [confirmedAt, id] = this.values as [string, string];
      const batch = this.db.batches.find((b) => b.id === id);
      if (batch) {
        batch.status = "confirmed";
        batch.confirmed_at = confirmedAt;
      }
      return { success: true };
    }

    if (this.sql.includes("SET status = 'anchoring'")) {
      const [batchId, leafIndex, id] = this.values as [string, number, string];
      const record = this.db.records.find((r) => r.id === id);
      if (record) {
        record.status = "anchoring";
        record.anchor_batch_id = batchId;
        record.leaf_index = leafIndex;
      }
      return { success: true };
    }

    if (this.sql.includes("SET status = 'anchored'")) {
      const [anchoredAt, batchId] = this.values as [string, string];
      for (const record of this.db.records) {
        if (record.anchor_batch_id === batchId && record.status === "anchoring") {
          record.status = "anchored";
          record.anchored_at = anchoredAt;
        }
      }
      return { success: true };
    }

    return { success: true };
  }
}

class FakeD1Database {
  records: FakeRecord[] = [];
  batches: FakeBatch[] = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }
}

describe("runAnchorBatch", () => {
  it("confirms submitted batches on a later run so records do not stay anchoring forever", async () => {
    const db = new FakeD1Database();
    db.records.push({
      id: "rec_1",
      user_id: "usr_1",
      sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
      phash64: 42,
      pdq256: null,
      created_at: "2026-08-13T11:00:00.000Z",
      status: "registered",
      anchor_batch_id: null,
      leaf_index: null,
      anchored_at: null,
      is_test: 0,
    });
    const env = {
      DB: db as unknown as D1Database,
      ENVIRONMENT: "development" as const,
      ANCHOR_BACKEND: "null" as const,
    };

    const submitted = await runAnchorBatch(env);
    expect(submitted.ok).toBe(true);
    expect(submitted.picked).toBe(1);
    expect(db.records[0]!.status).toBe("anchoring");
    expect(db.batches[0]!.status).toBe("submitted");
    expect(db.batches[0]!.chain).toBe("null");

    const confirmed = await runAnchorBatch(env);
    expect(confirmed.ok).toBe(true);
    expect(confirmed.picked).toBe(0);
    expect(confirmed.confirmed).toBe(1);
    expect(db.records[0]!.status).toBe("anchored");
    expect(db.records[0]!.anchored_at).toBeTruthy();
    expect(db.batches[0]!.status).toBe("confirmed");
    expect(db.batches[0]!.confirmed_at).toBeTruthy();
  });
});
