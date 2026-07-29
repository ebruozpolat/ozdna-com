import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";
import worker, { runAnchorBatch } from "../src/index.js";

type RecordRow = {
  id: string;
  user_id: string | null;
  sha256: string;
  phash64: number;
  pdq256: ArrayBuffer | null;
  created_at: string;
  status: string;
  is_test: number;
  anchor_batch_id: string | null;
  leaf_index: number | null;
};

type BatchRow = {
  id: string;
  chain: string;
  merkle_root: string;
  record_count: number;
  status: string;
  tx_hash: string | null;
};

class FakeD1Statement {
  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
    private readonly args: readonly unknown[] = [],
  ) {}

  bind(...args: unknown[]) {
    return new FakeD1Statement(this.db, this.sql, args);
  }

  async all<T>() {
    const sql = this.normalizedSql();
    if (sql.includes("FROM records") && sql.includes("WHERE status = 'registered'")) {
      const results = this.db.records
        .filter((r) => r.status === "registered" && r.is_test === 0)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .slice(0, 256);
      return { results: results as T[] };
    }
    throw new Error(`FakeD1Statement.all: unhandled SQL ${sql}`);
  }

  async first<T>() {
    const sql = this.normalizedSql();
    if (sql.includes("SELECT COUNT(*) AS n")) {
      const batchId = this.args[0];
      const n = this.db.records.filter(
        (r) => r.anchor_batch_id === batchId && r.status === "anchoring",
      ).length;
      return { n } as T;
    }
    throw new Error(`FakeD1Statement.first: unhandled SQL ${sql}`);
  }

  async run() {
    const sql = this.normalizedSql();
    if (sql.startsWith("INSERT INTO anchor_batches")) {
      const [id, chain, merkleRoot, recordCount] = this.args;
      this.db.batches.push({
        id: String(id),
        chain: String(chain),
        merkle_root: String(merkleRoot),
        record_count: Number(recordCount),
        status: "pending",
        tx_hash: null,
      });
      return { success: true };
    }

    if (sql.startsWith("UPDATE records SET status = 'anchoring'")) {
      const [batchId, leafIndex, id] = this.args;
      const rec = this.db.records.find(
        (r) => r.id === id && r.status === "registered" && r.is_test === 0,
      );
      if (rec) {
        rec.status = "anchoring";
        rec.anchor_batch_id = String(batchId);
        rec.leaf_index = Number(leafIndex);
      }
      return { success: true };
    }

    if (sql.startsWith("UPDATE records SET status = 'registered'")) {
      const [batchId] = this.args;
      for (const rec of this.db.records) {
        if (rec.anchor_batch_id === batchId && rec.status === "anchoring") {
          rec.status = "registered";
          rec.anchor_batch_id = null;
          rec.leaf_index = null;
        }
      }
      return { success: true };
    }

    if (sql.startsWith("UPDATE anchor_batches SET status = 'failed'")) {
      const [id] = this.args;
      const batch = this.db.batches.find((b) => b.id === id);
      if (batch) batch.status = "failed";
      return { success: true };
    }

    if (sql.startsWith("UPDATE anchor_batches SET status = ?, tx_hash = ?")) {
      const [status, txHash, id] = this.args;
      const batch = this.db.batches.find((b) => b.id === id);
      if (batch) {
        batch.status = String(status);
        batch.tx_hash = String(txHash);
      }
      return { success: true };
    }

    throw new Error(`FakeD1Statement.run: unhandled SQL ${sql}`);
  }

  private normalizedSql() {
    return this.sql.replace(/\s+/g, " ").trim();
  }
}

class FakeD1Database {
  readonly batches: BatchRow[] = [];

  constructor(readonly records: RecordRow[]) {}

  prepare(sql: string) {
    return new FakeD1Statement(this, sql);
  }

  async batch(statements: FakeD1Statement[]) {
    return Promise.all(statements.map((stmt) => stmt.run()));
  }
}

describe("anchor worker fetch", () => {
  it("GET /health", async () => {
    const env = {
      DB: {} as D1Database,
      ENVIRONMENT: "development" as const,
      ANCHOR_BACKEND: "null" as const,
    };
    const res = await worker.fetch(new Request("http://local/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; service: string };
    expect(body.ok).toBe(true);
    expect(body.service).toBe("ozdna-anchor");
  });

  it("claims records before chain submission so retries do not double-submit", async () => {
    const db = new FakeD1Database([
      {
        id: "rec_anchor_retry",
        user_id: "usr_anchor",
        sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        phash64: 12345,
        pdq256: null,
        created_at: "2026-07-29T11:00:00.000Z",
        status: "registered",
        is_test: 0,
        anchor_batch_id: null,
        leaf_index: null,
      },
    ]);
    const env: Env = {
      DB: db as unknown as D1Database,
      ENVIRONMENT: "development",
      ANCHOR_BACKEND: "null",
    };

    const first = await runAnchorBatch(env);

    expect(first.ok).toBe(true);
    expect(first.picked).toBe(1);
    expect(first.txid).toMatch(/^null_/);
    expect(db.records[0]!.status).toBe("anchoring");
    expect(db.records[0]!.anchor_batch_id).toBe(first.batchId);
    expect(db.batches[0]!.status).toBe("submitted");

    const second = await runAnchorBatch(env);

    expect(second.picked).toBe(0);
    expect(second.skipped).toBe("empty");
    expect(db.batches).toHaveLength(1);
  });
});
