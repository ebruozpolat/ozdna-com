// ozDNA API Worker — Hono. Spec: plan/04-MVP-SPEC.md §4, plan/09 §3.
// Foundation: health, OpenAPI, waitlist, verify-by-hash (D1). Signing/marks land next.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import { openapiYaml } from "./openapi.js";
import { waitlistRoutes } from "./routes/waitlist.js";
import { verifyRoutes } from "./routes/verify.js";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ozdna-api",
    version: "0.0.0",
    time: new Date().toISOString(),
  }),
);

app.get("/v1/openapi.yaml", (c) =>
  c.body(openapiYaml, 200, {
    "Content-Type": "application/yaml; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  }),
);

app.route("/v1", waitlistRoutes);
app.route("/v1", verifyRoutes);

app.notFound((c) =>
  c.json({ error: "not_found", message: "No such route. See GET /v1/openapi.yaml." }, 404),
);

export default app;
