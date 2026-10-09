// Service-key auth with scopes. A calling platform (tenant) holds one or more keys;
// each key carries a service_id that the API writes into actor.asserted_by — callers
// cannot choose it.

import type { MiddlewareHandler } from "hono";
import { sha256Hex } from "./crypto.js";
import type { Env } from "./env.js";
import { apiError } from "./errors.js";

export const SCOPES = [
  "projects:write",
  "artifacts:write",
  "events:append",
  "events:read",
  "checkpoints:write",
] as const;
export type Scope = (typeof SCOPES)[number];

export interface ServiceAuth {
  readonly tenantId: string;
  readonly serviceId: string;
  readonly keyId: string;
  readonly scopes: ReadonlySet<string>;
}

declare module "hono" {
  interface ContextVariableMap {
    svc: ServiceAuth;
  }
}

const BEARER = /^Bearer\s+(ozp_[0-9A-Za-z]{40})\s*$/;

/** Authenticate the service key, then require every listed scope. */
export function requireScopes(...needed: Scope[]): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const m = BEARER.exec(c.req.header("Authorization") ?? "");
    if (!m) {
      return apiError(
        c,
        401,
        "authentication_error",
        "INVALID_SERVICE_KEY",
        "Missing or malformed service key.",
      );
    }
    const row = await c.env.PROV_DB.prepare(
      `SELECT id, tenant_id, service_id, scopes, revoked_at FROM service_keys WHERE key_hash = ? LIMIT 1`,
    )
      .bind(await sha256Hex(m[1]!))
      .first<{
        id: string;
        tenant_id: string;
        service_id: string;
        scopes: string;
        revoked_at: string | null;
      }>();
    if (!row || row.revoked_at) {
      return apiError(
        c,
        401,
        "authentication_error",
        row?.revoked_at ? "REVOKED_SERVICE_KEY" : "INVALID_SERVICE_KEY",
        "Service key is not valid.",
      );
    }
    const scopes = new Set(row.scopes.split(" ").filter(Boolean));
    const missing = needed.filter((s) => !scopes.has(s));
    if (missing.length > 0) {
      return apiError(
        c,
        403,
        "permission_error",
        "INSUFFICIENT_SCOPE",
        `Key lacks scope: ${missing.join(", ")}.`,
      );
    }
    c.set("svc", { tenantId: row.tenant_id, serviceId: row.service_id, keyId: row.id, scopes });
    await next();
  };
}
