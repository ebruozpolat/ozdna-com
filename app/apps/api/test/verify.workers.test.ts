import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

function shaFromNumber(n: number): string {
  return n.toString(16).padStart(64, "0");
}

describe("verify (workerd + D1)", () => {
  it("scores perceptual candidates beyond the first 500 band hits", async () => {
    const decoyPhash = 0x0000ffffffffffff;
    const decoyInsert = env.DB.prepare(
      `INSERT INTO records (
         id, kind, source, sha256, phash64,
         band0, band1, band2, band3, file_mime, status, is_test
       ) VALUES (?, 'ai_generated', 'api_registration', ?, ?, 0, 65535, 65535, 65535, 'image/png', 'registered', 0)`,
    );

    for (let i = 0; i < 501; i += 100) {
      await env.DB.batch(
        Array.from({ length: Math.min(100, 501 - i) }, (_, offset) => {
          const n = i + offset + 1;
          return decoyInsert.bind(`rec_verify_decoy_${n}`, shaFromNumber(n), decoyPhash);
        }),
      );
    }

    await env.DB.prepare(
      `INSERT INTO records (
         id, kind, source, sha256, phash64,
         band0, band1, band2, band3, file_mime, status, is_test
       ) VALUES ('rec_verify_target', 'ai_generated', 'api_registration', ?, 0, 0, 0, 0, 0, 'image/png', 'registered', 0)`,
    )
      .bind(shaFromNumber(999_999))
      .run();

    const res = await SELF.fetch("http://local/v1/verify?phash=0000000000000000");
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      verdict: string;
      match_type: string;
      record: { id: string } | null;
    };
    expect(body.verdict).toBe("VISUAL_MATCH_HIGH");
    expect(body.match_type).toBe("perceptual");
    expect(body.record?.id).toBe("rec_verify_target");
  });
});
