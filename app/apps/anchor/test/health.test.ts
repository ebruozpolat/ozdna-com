import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

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

  it("does not create a batch when the configured Base backend is missing secrets", async () => {
    const statements: string[] = [];
    const db = {
      prepare(sql: string) {
        statements.push(sql);
        const stmt = {
          bind: (..._args: unknown[]) => stmt,
          all: async () => ({
            results: [
              {
                id: "rec_pending_anchor",
                user_id: "usr_anchor",
                sha256: "2".repeat(64),
                phash64: 0,
                pdq256: null,
                created_at: "2026-08-15T00:00:00.000Z",
              },
            ],
          }),
          run: async () => ({ success: true, meta: {} }),
        };
        return stmt;
      },
    } as unknown as D1Database;
    const env = {
      DB: db,
      ENVIRONMENT: "development" as const,
      ANCHOR_BACKEND: "base" as const,
    };

    const res = await worker.fetch(new Request("http://local/run", { method: "POST" }), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      picked: number;
      batchId: string | null;
      root: string | null;
      txid: string | null;
      skipped?: string;
    };

    expect(body).toMatchObject({
      ok: false,
      picked: 1,
      batchId: null,
      root: null,
      txid: null,
      skipped: "base_backend_missing_secrets",
    });
    expect(statements.some((sql) => sql.includes("INSERT INTO anchor_batches"))).toBe(false);
  });
});
