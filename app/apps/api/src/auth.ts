import type { Context, Next } from "hono";
import type { Env } from "./env.js";

export type AuthContext = {
  userId: string;
  apiKeyId: string;
  mode: "live" | "test";
  plan: string;
};

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

function ulidish(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export { ulidish };

/** SHA-256 hex of the full API key secret (never store raw). */
export async function hashApiKey(secret: string): Promise<string> {
  const data = new TextEncoder().encode(secret);
  const dig = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Require Authorization: Bearer ozdna_live_… | ozdna_test_… */
export async function requireApiKey(c: Context<{ Bindings: Env }>, next: Next) {
  const hdr = c.req.header("Authorization") ?? "";
  const m = /^Bearer\s+(ozdna_(live|test)_[A-Za-z0-9]+)\s*$/i.exec(hdr);
  if (!m) {
    return c.json(
      {
        error: "authentication_error",
        code: "invalid_api_key",
        message: "Missing or malformed Bearer token.",
      },
      401,
    );
  }
  const secret = m[1]!;
  const keyHash = await hashApiKey(secret);
  const row = await c.env.DB.prepare(
    `SELECT k.id AS api_key_id, k.user_id, k.mode, k.revoked_at, u.plan
     FROM api_keys k JOIN users u ON u.id = k.user_id
     WHERE k.key_hash = ? LIMIT 1`,
  )
    .bind(keyHash)
    .first<{
      api_key_id: string;
      user_id: string;
      mode: "live" | "test";
      revoked_at: string | null;
      plan: string;
    }>();

  if (!row || row.revoked_at) {
    return c.json(
      {
        error: "authentication_error",
        code: row?.revoked_at ? "revoked_api_key" : "invalid_api_key",
      },
      401,
    );
  }

  await c.env.DB.prepare(
    `UPDATE api_keys SET last_used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
  )
    .bind(row.api_key_id)
    .run();

  c.set("auth", {
    userId: row.user_id,
    apiKeyId: row.api_key_id,
    mode: row.mode,
    plan: row.plan,
  });
  await next();
}

/** One-shot bootstrap: creates a free user + live API key. Requires BOOTSTRAP_TOKEN. */
export async function bootstrapApiKey(
  db: D1Database,
  email: string,
  displayName?: string,
): Promise<{ userId: string; apiKeyId: string; apiKey: string; keyPrefix: string }> {
  const userId = ulidish("usr");
  const apiKeyId = ulidish("key");
  const raw = `ozdna_live_${[...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => (b % 36).toString(36))
    .join("")}`;
  const keyHash = await hashApiKey(raw);
  const keyPrefix = raw.slice(0, 18);

  await db
    .prepare(
      `INSERT INTO users (id, email, email_verified_at, display_name, plan, segment)
       VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ','now'), ?, 'free', 'ai_company')`,
    )
    .bind(userId, email.toLowerCase(), displayName ?? null)
    .run();

  await db
    .prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, mode)
       VALUES (?, ?, 'default', ?, ?, 'live')`,
    )
    .bind(apiKeyId, userId, keyHash, keyPrefix)
    .run();

  return { userId, apiKeyId, apiKey: raw, keyPrefix };
}
