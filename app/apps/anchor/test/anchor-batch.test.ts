import { buildTree, hashLeaf, leafPreimage, toHex } from "@ozdna/dna-core";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

const record = {
  id: "rec_roundtrip",
  user_id: "usr_anchor",
  sha256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  phash64: "fedcba9876543210",
  pdq256: new Uint8Array(32).fill(0xab),
  manifest_sha256: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  created_at: "2026-10-14T09:31:02.417Z",
};

class FakeStatement {
  private args: unknown[] = [];

  constructor(
    private readonly db: FakeD1Database,
    private readonly sql: string,
  ) {}

  bind(...args: unknown[]): FakeStatement {
    this.args = args;
    return this;
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM records") && this.sql.includes("status = 'registered'")) {
      return { results: [record as T] };
    }
    throw new Error(`unexpected all() SQL: ${this.sql}`);
  }

  async run(): Promise<D1Result> {
    if (this.sql.includes("INSERT INTO anchor_batches")) {
      this.db.insertedBatch = this.args;
      return { success: true } as D1Result;
    }
    if (this.sql.includes("UPDATE anchor_batches")) {
      this.db.batchUpdates.push(this.args);
      return { success: true } as D1Result;
    }
    if (this.sql.includes("UPDATE records SET status = 'anchoring'")) {
      this.db.recordUpdates.push(this.args);
      return { success: true } as D1Result;
    }
    throw new Error(`unexpected run() SQL: ${this.sql}`);
  }
}

class FakeD1Database {
  insertedBatch: unknown[] | null = null;
  batchUpdates: unknown[][] = [];
  recordUpdates: unknown[][] = [];

  prepare(sql: string): FakeStatement {
    return new FakeStatement(this, sql);
  }
}

describe("anchor batch worker", () => {
  it("builds Merkle leaves from canonical pHash, PDQ, and manifest fields", async () => {
    const db = new FakeD1Database();
    const env = {
      DB: db as unknown as D1Database,
      ENVIRONMENT: "development" as const,
      ANCHOR_BACKEND: "null" as const,
    };

    const res = await worker.fetch(new Request("http://local/run", { method: "POST" }), env);
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ ok: true, picked: 1 });

    const leaf = await hashLeaf(
      leafPreimage({
        id: record.id,
        sha256Hex: record.sha256,
        phash64Hex: record.phash64,
        pdq256Hex: toHex(record.pdq256),
        manifestSha256Hex: record.manifest_sha256,
        accountId: record.user_id,
        registeredAt: record.created_at,
      }),
    );
    const tree = await buildTree([leaf]);
    expect(db.insertedBatch).not.toBeNull();
    expect(db.insertedBatch?.[1]).toBe(`0x${toHex(tree.root)}`);
    expect(db.recordUpdates).toHaveLength(1);
  });
});
