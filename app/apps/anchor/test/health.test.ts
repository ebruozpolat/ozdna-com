import { describe, expect, it } from "vitest";
import worker from "../src/index.js";

type PreparedCall = { sql: string; args: unknown[] };

function fakeD1(calls: PreparedCall[]): D1Database {
  const record = {
    id: "rec_test",
    user_id: "usr_test",
    sha256: "a".repeat(64),
    phash64: 0,
    pdq256: null,
    created_at: "2026-08-14T00:00:00.000Z",
  };

  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async all() {
              calls.push({ sql, args });
              if (sql.includes("FROM records")) {
                return { results: [record] };
              }
              return { results: [] };
            },
            async run() {
              calls.push({ sql, args });
              return { success: true };
            },
          };
        },
        async all() {
          calls.push({ sql, args: [] });
          if (sql.includes("FROM records")) {
            return { results: [record] };
          }
          return { results: [] };
        },
      };
    },
  } as unknown as D1Database;
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

  it("records the resolved backend chain on anchor batches", async () => {
    const calls: PreparedCall[] = [];
    const env = {
      DB: fakeD1(calls),
      ENVIRONMENT: "development" as const,
      ANCHOR_BACKEND: "null" as const,
    };

    const res = await worker.fetch(new Request("http://local/run", { method: "POST" }), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; picked: number; txid: string };
    expect(body.ok).toBe(true);
    expect(body.picked).toBe(1);
    expect(body.txid).toMatch(/^null_/);

    const insertBatch = calls.find((call) => call.sql.includes("INSERT INTO anchor_batches"));
    expect(insertBatch?.args[1]).toBe("null");
  });
});
