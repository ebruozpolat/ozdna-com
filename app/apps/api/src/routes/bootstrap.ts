import { Hono } from "hono";
import { z } from "zod";
import { bootstrapApiKey, requireApiKey, ulidish } from "../auth.js";
import type { Env } from "../env.js";

export const bootstrapRoutes = new Hono<{ Bindings: Env }>();

const Body = z.object({
  email: z.string().email().max(320),
  display_name: z.string().max(80).optional(),
});

/**
 * One-shot tenant bootstrap. Requires Worker secret BOOTSTRAP_TOKEN.
 * Returns the raw API key once — store it; only the hash is kept in D1.
 */
bootstrapRoutes.post("/bootstrap/api-key", async (c) => {
  const expected = c.env.BOOTSTRAP_TOKEN;
  if (!expected) {
    return c.json(
      { error: "bootstrap_disabled", message: "Set BOOTSTRAP_TOKEN Worker secret to enable." },
      503,
    );
  }
  const provided = c.req.header("X-Bootstrap-Token") ?? "";
  if (provided !== expected) {
    return c.json({ error: "authentication_error", code: "invalid_bootstrap_token" }, 401);
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

  const email = parsed.data.email.toLowerCase();
  const existing = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ? LIMIT 1`)
    .bind(email)
    .first<{ id: string }>();
  if (existing) {
    return c.json(
      {
        error: "conflict",
        code: "user_exists",
        message: "User already exists; create keys via dashboard later.",
      },
      409,
    );
  }

  const created = await bootstrapApiKey(c.env.DB, email, parsed.data.display_name);
  return c.json(
    {
      user_id: created.userId,
      api_key_id: created.apiKeyId,
      key_prefix: created.keyPrefix,
      api_key: created.apiKey,
      warning: "Store api_key now — it cannot be retrieved again.",
    },
    201,
  );
});

export { requireApiKey, ulidish };
