import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("waitlist (workerd + D1)", () => {
  it("POST /v1/waitlist registers then idempotent", async () => {
    const body = {
      email: "polish-test@ozdna.example",
      segment: "fact_checker",
      locale: "en",
      consent: true,
    };

    const first = await SELF.fetch("http://local/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(first.status).toBe(201);
    expect(await first.json()).toEqual({ ok: true, status: "registered" });

    const second = await SELF.fetch("http://local/v1/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ ok: true, status: "already_registered" });

    const row = await env.DB.prepare("SELECT email, segment FROM waitlist WHERE email = ?")
      .bind(body.email)
      .first<{ email: string; segment: string }>();
    expect(row).toEqual({ email: body.email, segment: "fact_checker" });
  });

  it("POST /v1/registrations stores the canonical pHash without 64-bit rounding", async () => {
    const body = {
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      phash: "FEDCBA9876543210",
      kind: "ai_generated",
      file_mime: "image/jpeg",
      file_bytes: 12345,
    };

    const res = await SELF.fetch("http://local/v1/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toMatchObject({
      record: { sha256: body.sha256, phash: "fedcba9876543210", status: "registered" },
      deduplicated: false,
    });

    const row = await env.DB.prepare(
      `SELECT phash64, typeof(phash64) AS storage_type, band0, band1, band2, band3
       FROM records
       WHERE sha256 = ?`,
    )
      .bind(body.sha256)
      .first<{
        phash64: string;
        storage_type: string;
        band0: number;
        band1: number;
        band2: number;
        band3: number;
      }>();
    expect(row).toEqual({
      phash64: "fedcba9876543210",
      storage_type: "text",
      band0: 0xfedc,
      band1: 0xba98,
      band2: 0x7654,
      band3: 0x3210,
    });

    const verify = await SELF.fetch(`http://local/v1/verify?hash=${body.sha256}`);
    expect(verify.status).toBe(200);
    await expect(verify.json()).resolves.toMatchObject({
      verdict: "EXACT_PENDING",
      record: { sha256: body.sha256, phash64: "fedcba9876543210" },
    });
  });
});
