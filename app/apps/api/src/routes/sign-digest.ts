import { Hono } from "hono";
import { z } from "zod";
import { requireApiKey } from "../auth.js";
import type { Env } from "../env.js";

/**
 * Remote digest signing — plan/04 §4.2 / plan/01 hybrid signing.
 * Dev: SIGNING_KEY_JWK (EC P-256 PKCS8/JWK). Production: Cloudflare Secret.
 * Returns raw ES256 signature bytes as base64 (c2pa-web Signer callback shape TBD in Sept spike).
 */
export const signRoutes = new Hono<{ Bindings: Env }>();
signRoutes.use("*", requireApiKey);

const Body = z.object({
  digest_b64: z.string().min(1).max(1024),
  alg: z.literal("ES256").default("ES256"),
});

signRoutes.post("/sign-digest", async (c) => {
  const keyJwk = c.env.SIGNING_KEY_JWK;
  if (!keyJwk) {
    return c.json(
      {
        error: "signing_not_configured",
        message: "Set SIGNING_KEY_JWK (EC P-256) — generate with npm run certs:dev",
      },
      503,
    );
  }

  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }

  let keyData: JsonWebKey;
  try {
    keyData = JSON.parse(keyJwk) as JsonWebKey;
  } catch {
    return c.json({ error: "signing_key_invalid" }, 500);
  }

  const key = await crypto.subtle.importKey(
    "jwk",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  const digest = Uint8Array.from(atob(parsed.data.digest_b64), (ch) => ch.charCodeAt(0));
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, digest);
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  const auth = c.get("auth");
  const month = new Date().toISOString().slice(0, 7);

  await c.env.DB.prepare(
    `INSERT INTO usage_events (user_id, api_key_id, event_type, billable, month)
     VALUES (?, ?, 'sign_digest', ?, ?)`,
  )
    .bind(auth.userId, auth.apiKeyId, auth.mode === "test" ? 0 : 1, month)
    .run();

  return c.json({
    alg: "ES256",
    signature_b64: sigB64,
    key_id: c.env.SIGNING_KEY_ID ?? "dev",
  });
});
