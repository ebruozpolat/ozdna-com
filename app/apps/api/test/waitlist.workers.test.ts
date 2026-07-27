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

    const row = await env.DB.prepare(
      "SELECT email, segment FROM waitlist WHERE email = ?",
    )
      .bind(body.email)
      .first<{ email: string; segment: string }>();
    expect(row).toEqual({ email: body.email, segment: "fact_checker" });
  });
});
