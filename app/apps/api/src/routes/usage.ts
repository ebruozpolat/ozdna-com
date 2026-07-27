import { Hono } from "hono";
import type { Env } from "../env.js";

export const usageRoutes = new Hono<{ Bindings: Env }>();

/** Stub until API-key auth lands — returns empty quota shape. */
usageRoutes.get("/usage", async (c) => {
  const month = new Date().toISOString().slice(0, 7);
  return c.json({
    month,
    events: [],
    quotas: { mark: 0, registration: 0, verify_file: 0, sign_digest: 0 },
    note: "API-key auth not yet wired; returns empty usage for unauthenticated calls.",
  });
});

export const webhookRoutes = new Hono<{ Bindings: Env }>();

webhookRoutes.get("/webhook-endpoints", (c) => c.json({ endpoints: [] }));
webhookRoutes.post("/webhook-endpoints", (c) =>
  c.json({ error: "not_implemented", message: "Webhook CRUD lands with API-key auth." }, 501),
);
webhookRoutes.delete("/webhook-endpoints/:id", (c) => c.json({ error: "not_implemented" }, 501));
