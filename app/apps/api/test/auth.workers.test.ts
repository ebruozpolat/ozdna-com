import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { bootstrapApiKey } from "../src/auth.js";
import type { Env } from "../src/env.js";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}

describe("auth + marks + webhooks", () => {
  it("rejects marks without API key", async () => {
    const res = await SELF.fetch("http://local/v1/marks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sha256: "a".repeat(64),
        phash: "b".repeat(16),
        file_mime: "image/jpeg",
      }),
    });
    expect(res.status).toBe(401);
  });

  it("bootstrap → mark → usage → webhook CRUD", async () => {
    const created = await bootstrapApiKey(env.DB, "marks-test@ozdna.example", "Test");
    const auth = { Authorization: `Bearer ${created.apiKey}` };

    const mark = await SELF.fetch("http://local/v1/marks", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        sha256: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
        phash: "c4a2b1d8e0f39a57",
        file_mime: "image/png",
        title: "registry-only",
      }),
    });
    expect(mark.status).toBe(201);
    const markBody = (await mark.json()) as {
      mode: string;
      embed: boolean;
      record: { id: string };
    };
    expect(markBody.mode).toBe("registry_only");
    expect(markBody.embed).toBe(false);
    expect(markBody.record.id).toMatch(/^rec_/);

    const usage = await SELF.fetch("http://local/v1/usage", { headers: auth });
    expect(usage.status).toBe(200);
    const usageBody = (await usage.json()) as { events: { mark: number }; plan: string };
    expect(usageBody.events.mark).toBe(1);
    expect(usageBody.plan).toBe("free");

    const wh = await SELF.fetch("http://local/v1/webhook-endpoints", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/hooks/ozdna", description: "test" }),
    });
    expect(wh.status).toBe(201);
    const whBody = (await wh.json()) as { id: string; secret: string };
    expect(whBody.id).toMatch(/^whe_/);
    expect(whBody.secret.length).toBeGreaterThan(10);

    const list = await SELF.fetch("http://local/v1/webhook-endpoints", { headers: auth });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { endpoints: { id: string }[] };
    expect(listBody.endpoints).toHaveLength(1);

    const del = await SELF.fetch(`http://local/v1/webhook-endpoints/${whBody.id}`, {
      method: "DELETE",
      headers: auth,
    });
    expect(del.status).toBe(200);
  });

  it("does not let live API keys create hidden unbillable test marks", async () => {
    const created = await bootstrapApiKey(env.DB, "live-test-flag@ozdna.example", "Live Test Flag");
    const auth = { Authorization: `Bearer ${created.apiKey}` };
    const sha256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

    const mark = await SELF.fetch("http://local/v1/marks", {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        sha256,
        phash: "d4a2b1d8e0f39a57",
        file_mime: "image/png",
        is_test: true,
      }),
    });
    expect(mark.status).toBe(201);
    const markBody = (await mark.json()) as { record: { id: string } };

    const record = await SELF.fetch(`http://local/v1/records/${markBody.record.id}`);
    expect(record.status).toBe(200);

    const verify = await SELF.fetch(`http://local/v1/verify?hash=${sha256}`);
    expect(verify.status).toBe(200);
    const verifyBody = (await verify.json()) as { match_type: string; record: { id: string } };
    expect(verifyBody.match_type).toBe("exact");
    expect(verifyBody.record.id).toBe(markBody.record.id);

    const usage = await SELF.fetch("http://local/v1/usage", { headers: auth });
    expect(usage.status).toBe(200);
    const usageBody = (await usage.json()) as { events: { mark: number } };
    expect(usageBody.events.mark).toBe(1);
  });
});
