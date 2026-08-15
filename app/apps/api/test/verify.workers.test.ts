import { bandsFromHex, toSignedI64 } from "@ozdna/dna-core";
import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("verify perceptual responses", () => {
  it("does not expose a primary record for near-miss candidates", async () => {
    const recordId = "rec_near_miss_route";
    const candidatePhash = "0000000000000fff";
    const bands = bandsFromHex(candidatePhash);

    await env.DB.prepare(
      `INSERT INTO records (
         id, kind, source, sha256, phash64, band0, band1, band2, band3,
         file_mime, status, is_test
       ) VALUES (?, 'ai_generated', 'api_mark', ?, ?, ?, ?, ?, ?, 'image/png', 'registered', 0)`,
    )
      .bind(
        recordId,
        "1".repeat(64),
        Number(toSignedI64(BigInt(`0x${candidatePhash}`))),
        bands.band0,
        bands.band1,
        bands.band2,
        bands.band3,
      )
      .run();

    const res = await SELF.fetch("http://local/v1/verify?phash=0000000000000000&deep=1");
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      verdict: string;
      match_type: string;
      show_as_match: boolean;
      record: unknown;
      near_misses: { id: string; phash_distance: number }[];
    };

    expect(body.verdict).toBe("NEAR_MISS");
    expect(body.match_type).toBe("none");
    expect(body.show_as_match).toBe(false);
    expect(body.record).toBeNull();
    expect(body.near_misses[0]).toMatchObject({ id: recordId, phash_distance: 12 });
  });
});
