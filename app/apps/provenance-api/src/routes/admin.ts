// Admin bootstrap: create a tenant and its first service key. Gated by ADMIN_TOKEN
// (constant-time compare). The raw key is returned once; only its hash is stored.

import { Hono } from "hono";
import { SCOPES } from "../auth.js";
import { readJson } from "../body.js";
import { secretsEqual, sha256Hex } from "../crypto.js";
import type { Env } from "../env.js";
import { apiError } from "../errors.js";
import { newId, newServiceKeySecret } from "../ids.js";
import { d1Stores } from "../repo/d1.js";
import { createTenantSchema } from "../schemas.js";

export const adminRoutes = new Hono<{ Bindings: Env }>();

adminRoutes.post("/admin/tenants", async (c) => {
  const expected = c.env.ADMIN_TOKEN;
  if (!expected) {
    return apiError(
      c,
      503,
      "unavailable",
      "ADMIN_DISABLED",
      "Set ADMIN_TOKEN to enable tenant bootstrap.",
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
  const { data } = await readJson(c, createTenantSchema);
  const scopes = data.scopes ?? [...SCOPES];
  const secret = newServiceKeySecret();
  const ids = { tenantId: newId("ten"), keyId: newId("skey"), serviceId: newId("svc") };
  await d1Stores(c.env.PROV_DB).tenants.createWithKey({
    ...ids,
    name: data.name,
    keyHash: await sha256Hex(secret),
    keyPrefix: secret.slice(0, 12),
    scopes,
  });
  return c.json(
    {
      tenant: { id: ids.tenantId, name: data.name },
      service_key: { id: ids.keyId, service_id: ids.serviceId, scopes, key: secret },
      warning: "Store the key now; it cannot be retrieved again.",
    },
    201,
  );
});
