import { describe, expect, it } from "vitest";
import worker, { runAnchorBatch } from "../src/index.js";

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

  it("does not fake-anchor production records when Base backend is disabled", async () => {
    const preparedSql: string[] = [];
    const db = {
      prepare(sql: string) {
        preparedSql.push(sql);
        const statement = {
          bind() {
            return statement;
          },
          async all() {
            return {
              results: [
                {
                  id: "rec_live",
                  user_id: "usr_live",
                  sha256: "a".repeat(64),
                  phash64: 0,
                  pdq256: null,
                  created_at: "2026-08-02T00:00:00.000Z",
                },
              ],
            };
          },
          async run() {
            throw new Error(`unexpected mutation: ${sql}`);
          },
        };
        return statement;
      },
    } as unknown as D1Database;

    const result = await runAnchorBatch({
      DB: db,
      ENVIRONMENT: "production",
      ANCHOR_BACKEND: "null",
    });

    expect(result).toEqual({
      ok: false,
      picked: 1,
      batchId: null,
      root: null,
      txid: null,
      skipped: "production_anchor_backend_disabled",
    });
    expect(preparedSql.some((sql) => /^\s*(INSERT|UPDATE)\b/i.test(sql))).toBe(false);
  });
});
