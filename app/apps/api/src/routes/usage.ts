import { Hono } from "hono";
import { z } from "zod";
import { requireApiKey, ulidish } from "../auth.js";
import type { Env } from "../env.js";
import { quotasForPlan } from "../quotas.js";

export const usageRoutes = new Hono<{ Bindings: Env }>();
usageRoutes.use("*", requireApiKey);

usageRoutes.get("/usage", async (c) => {
  const auth = c.get("auth");
  const month = new Date().toISOString().slice(0, 7);
  const rows = await c.env.DB.prepare(
    `SELECT event_type, COUNT(*) AS n
     FROM usage_events
     WHERE user_id = ? AND month = ? AND billable = 1
     GROUP BY event_type`,
  )
    .bind(auth.userId, month)
    .all<{ event_type: string; n: number }>();

  const events: Record<string, number> = {};
  for (const r of rows.results ?? []) {
    events[r.event_type] = r.n;
  }

  const q = quotasForPlan(auth.plan);

  return c.json({
    month,
    plan: auth.plan,
    events: {
      mark: events.mark ?? 0,
      registration: events.registration ?? 0,
      verify_file: events.verify_file ?? 0,
      sign_digest: events.sign_digest ?? 0,
    },
    quotas: {
      mark: q.mark,
      registration: q.registration,
      verify_file: 0,
      sign_digest: 0,
    },
  });
});

export const webhookRoutes = new Hono<{ Bindings: Env }>();
webhookRoutes.use("*", requireApiKey);

webhookRoutes.get("/webhook-endpoints", async (c) => {
  const auth = c.get("auth");
  const rows = await c.env.DB.prepare(
    `SELECT id, url, description, created_at, revoked_at
     FROM webhook_endpoints
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created_at DESC`,
  )
    .bind(auth.userId)
    .all<{
      id: string;
      url: string;
      description: string | null;
      created_at: string;
      revoked_at: string | null;
    }>();

  return c.json({
    endpoints: (rows.results ?? []).map((r) => ({
      id: r.id,
      url: r.url,
      description: r.description,
      created_at: r.created_at,
    })),
  });
});

const CreateBody = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(200).optional(),
});

webhookRoutes.post("/webhook-endpoints", async (c) => {
  const auth = c.get("auth");
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "validation_error", details: parsed.error.flatten() }, 400);
  }
  if (!parsed.data.url.startsWith("https://")) {
    return c.json({ error: "validation_error", message: "url must be https://" }, 400);
  }

  const id = ulidish("whe");
  const secret = [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => (b % 36).toString(36))
    .join("");

  await c.env.DB.prepare(
    `INSERT INTO webhook_endpoints (id, user_id, url, secret, description)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, auth.userId, parsed.data.url, secret, parsed.data.description ?? null)
    .run();

  return c.json(
    {
      id,
      url: parsed.data.url,
      description: parsed.data.description ?? null,
      secret,
      warning: "Store secret now — used for Ozdna-Signature HMAC; not shown again.",
    },
    201,
  );
});

webhookRoutes.delete("/webhook-endpoints/:id", async (c) => {
  const auth = c.get("auth");
  const id = c.req.param("id");
  const row = await c.env.DB.prepare(
    `SELECT id FROM webhook_endpoints WHERE id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1`,
  )
    .bind(id, auth.userId)
    .first<{ id: string }>();

  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  await c.env.DB.prepare(
    `UPDATE webhook_endpoints SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
  )
    .bind(id)
    .run();

  return c.json({ ok: true, id, revoked: true });
});
