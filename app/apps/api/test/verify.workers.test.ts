import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("verify route (workerd + D1)", () => {
  it("excludes revoked records from exact and perceptual lookups", async () => {
    const sha = "1".repeat(64);
    const phash = "0000000000000000";

    await env.DB.prepare(
      `INSERT INTO records (
         id, kind, source, sha256, phash64,
         band0, band1, band2, band3, file_mime, status, is_test
       ) VALUES (?, 'ai_generated', 'web_sign', ?, 0, 0, 0, 0, 0, 'image/png', 'revoked', 0)`,
    )
      .bind("rec_revoked_verify_test", sha)
      .run();

    const exact = await SELF.fetch(`http://local/v1/verify?hash=${sha}`);
    expect(exact.status).toBe(200);
    await expect(exact.json()).resolves.toMatchObject({
      verdict: "NO_RECORD",
      match_type: "none",
      record: null,
    });

    const perceptual = await SELF.fetch(`http://local/v1/verify?phash=${phash}`);
    expect(perceptual.status).toBe(200);
    await expect(perceptual.json()).resolves.toMatchObject({
      verdict: "NO_RECORD",
      match_type: "none",
      record: null,
    });
  });
});
