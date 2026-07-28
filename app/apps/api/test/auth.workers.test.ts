import { env, SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { bootstrapApiKey } from "../src/auth.js";
import type { Env } from "../src/env.js";
import app from "../src/index.js";

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

  it("protects digest signing with API-key auth and logs usage", async () => {
    const unauthorized = await SELF.fetch("http://local/v1/sign-digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ digest_b64: btoa("digest") }),
    });
    expect(unauthorized.status).toBe(401);

    const created = await bootstrapApiKey(env.DB, "sign-test@ozdna.example", "Signer");
    const keyPair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ]);
    const jwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

    const signed = await app.fetch(
      new Request("http://local/v1/sign-digest", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${created.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ digest_b64: btoa("digest") }),
      }),
      { ...env, SIGNING_KEY_JWK: JSON.stringify(jwk), SIGNING_KEY_ID: "test-key" },
    );

    expect(signed.status).toBe(200);
    const body = (await signed.json()) as { alg: string; signature_b64: string; key_id: string };
    expect(body.alg).toBe("ES256");
    expect(body.signature_b64.length).toBeGreaterThan(20);
    expect(body.key_id).toBe("test-key");

    const usage = await SELF.fetch("http://local/v1/usage", {
      headers: { Authorization: `Bearer ${created.apiKey}` },
    });
    expect(usage.status).toBe(200);
    const usageBody = (await usage.json()) as { events: { sign_digest: number } };
    expect(usageBody.events.sign_digest).toBe(1);
  });
});
