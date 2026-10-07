import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { bootstrapApiKey } from "../src/auth.js";
import type { Env } from "../src/env.js";
import app from "../src/index.js";

// E-01: POST /v1/sign-digest used to sign arbitrary bytes for anyone. It now requires an
// API key and records a sign_digest usage event. Tests call app.fetch with a per-test
// SIGNING_KEY_JWK (generated here, never committed).

async function signingEnv(): Promise<{ env: Env; publicKey: CryptoKey }> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    env: {
      ...(env as unknown as Env),
      SIGNING_KEY_JWK: JSON.stringify(jwk),
      SIGNING_KEY_ID: "test",
    },
    publicKey: pair.publicKey,
  };
}

const DIGEST = new Uint8Array(32).fill(7);
const DIGEST_B64 = btoa(String.fromCharCode(...DIGEST));

function signRequest(headers: Record<string, string> = {}) {
  return new Request("http://local/v1/sign-digest", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ digest_b64: DIGEST_B64 }),
  });
}

describe("POST /v1/sign-digest (E-01)", () => {
  it("returns 401 without an API key, even when signing is configured", async () => {
    const { env: e } = await signingEnv();
    const res = await app.fetch(signRequest(), e);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string; code: string };
    expect(body).toMatchObject({ error: "authentication_error", code: "invalid_api_key" });
  });

  it("returns 401 for an unknown or revoked key", async () => {
    const { env: e } = await signingEnv();
    const unknown = await app.fetch(signRequest({ Authorization: "Bearer ozdna_live_nope123" }), e);
    expect(unknown.status).toBe(401);

    const created = await bootstrapApiKey(env.DB, "revoked-signer@ozdna.example");
    await env.DB.prepare(
      "UPDATE api_keys SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
      .bind(created.apiKeyId)
      .run();
    const revoked = await app.fetch(signRequest({ Authorization: `Bearer ${created.apiKey}` }), e);
    expect(revoked.status).toBe(401);
    expect(((await revoked.json()) as { code: string }).code).toBe("revoked_api_key");
  });

  it("signs with a valid key and logs one sign_digest usage event", async () => {
    const { env: e, publicKey } = await signingEnv();
    const created = await bootstrapApiKey(env.DB, "signer@ozdna.example");
    const res = await app.fetch(signRequest({ Authorization: `Bearer ${created.apiKey}` }), e);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { alg: string; signature_b64: string; key_id: string };
    expect(body).toMatchObject({ alg: "ES256", key_id: "test" });

    // Behaviour is otherwise unchanged (see E-06): the signature is over SHA-256(input).
    const sig = Uint8Array.from(atob(body.signature_b64), (ch) => ch.charCodeAt(0));
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      sig,
      DIGEST,
    );
    expect(ok).toBe(true);

    const usage = await env.DB.prepare(
      "SELECT api_key_id, event_type, billable, record_id FROM usage_events WHERE user_id = ?",
    )
      .bind(created.userId)
      .all<{
        api_key_id: string;
        event_type: string;
        billable: number;
        record_id: string | null;
      }>();
    expect(usage.results).toEqual([
      { api_key_id: created.apiKeyId, event_type: "sign_digest", billable: 1, record_id: null },
    ]);
  });

  it("does not log usage when the request is rejected", async () => {
    const { env: e } = await signingEnv();
    const created = await bootstrapApiKey(env.DB, "bad-body-signer@ozdna.example");
    const res = await app.fetch(
      new Request("http://local/v1/sign-digest", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${created.apiKey}` },
        body: JSON.stringify({ digest_b64: "" }),
      }),
      e,
    );
    expect(res.status).toBe(400);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM usage_events WHERE user_id = ?")
      .bind(created.userId)
      .first<{ n: number }>();
    expect(n?.n).toBe(0);
  });

  it("does not put public routes mounted after it behind an API key", async () => {
    const { env: e } = await signingEnv();
    const rec = await app.fetch(new Request("http://local/v1/records/rec_doesnotexist"), e);
    expect(rec.status).toBe(404);
    const verify = await app.fetch(new Request(`http://local/v1/verify?hash=${"a".repeat(64)}`), e);
    expect(verify.status).toBe(200);
  });
});
