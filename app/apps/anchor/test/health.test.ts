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
});
