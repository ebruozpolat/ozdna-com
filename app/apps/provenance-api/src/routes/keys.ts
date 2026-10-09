// Public-key registry endpoints. GET is public: anyone verifying a checkpoint offline needs
// the key. Rotation and revocation are admin-only.

import { fromBase64Url, keyIdFor } from "@ozdna/provenance-core";
import { keyIdSchema } from "@ozdna/provenance-schema";
import { Hono } from "hono";
import { secretsEqual } from "../crypto.js";
import type { Env } from "../env.js";
import { apiError, HttpError } from "../errors.js";
import { d1Stores } from "../repo/d1.js";

const now = () => new Date().toISOString();

export const publicKeyRoutes = new Hono<{ Bindings: Env }>();

publicKeyRoutes.get("/keys/:key_id", async (c) => {
  const keyId = c.req.param("key_id");
  if (!keyIdSchema.safeParse(keyId).success) {
    return apiError(c, 404, "not_found", "KEY_NOT_FOUND", "No such key.");
  }
  const key = await d1Stores(c.env.PROV_DB).keys.get(keyId);
  if (!key) return apiError(c, 404, "not_found", "KEY_NOT_FOUND", "No such key.");
  return c.json({ key }, 200, { "Cache-Control": "public, max-age=60" });
});

export const adminKeyRoutes = new Hono<{ Bindings: Env }>();

adminKeyRoutes.use("/admin/keys/*", async (c, next) => {
  const expected = c.env.ADMIN_TOKEN;
  if (!expected) {
    return apiError(
      c,
      503,
      "unavailable",
      "ADMIN_DISABLED",
      "Set ADMIN_TOKEN to enable admin endpoints.",
    );
  }
  if (!(await secretsEqual(c.req.header("X-Admin-Token") ?? "", expected))) {
    return apiError(
      c,
      401,
      "authentication_error",
      "INVALID_ADMIN_TOKEN",
      "Admin token is not valid.",
    );
  }
  await next();
});

/**
 * Register the signer's current key as the active key, retiring the previous one. Run after
 * the signer's secret is set or rotated. Idempotent for the already-active key.
 */
adminKeyRoutes.post("/admin/keys/rotate", async (c) => {
  if (!c.env.SIGNER)
    throw new HttpError(503, "unavailable", "SIGNER_UNAVAILABLE", "No signer binding.");
  const pub = await c.env.SIGNER.publicKey();
  // Never trust the signer's label: the key_id must be the fingerprint of the key bytes.
  if (
    pub.algorithm !== "Ed25519" ||
    (await keyIdFor(fromBase64Url(pub.public_key))) !== pub.key_id
  ) {
    throw new HttpError(
      502,
      "unavailable",
      "SIGNER_KEY_INVALID",
      "Signer returned an inconsistent key.",
    );
  }
  const stores = d1Stores(c.env.PROV_DB);
  const existing = await stores.keys.get(pub.key_id);
  if (existing) {
    if (existing.status === "active") return c.json({ key: existing, rotated: false });
    throw new HttpError(
      409,
      "conflict",
      "KEY_NOT_REUSABLE",
      `Key is ${existing.status}; give the signer a new key.`,
    );
  }
  await stores.keys.rotateTo({ key_id: pub.key_id, public_key: pub.public_key }, now());
  return c.json({ key: await stores.keys.get(pub.key_id), rotated: true }, 201);
});

/**
 * Revoke a key (compromise). Every checkpoint it signed stops verifying, whatever its
 * issued_at, because a compromised key can backdate. Re-checkpoint with a new key.
 */
adminKeyRoutes.post("/admin/keys/:key_id/revoke", async (c) => {
  const keyId = c.req.param("key_id");
  const stores = d1Stores(c.env.PROV_DB);
  const key = await stores.keys.get(keyId);
  if (!key) throw new HttpError(404, "not_found", "KEY_NOT_FOUND", "No such key.");
  if (key.status !== "revoked") await stores.keys.revoke(keyId, now());
  return c.json({ key: await stores.keys.get(keyId) });
});
