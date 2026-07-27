// ozDNA API Worker — Hono. Spec: plan/04-MVP-SPEC.md §4, plan/09 §3.

import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env.js";
import { openapiYaml } from "./openapi.js";
import { bootstrapRoutes } from "./routes/bootstrap.js";
import { markRoutes } from "./routes/marks.js";
import { recordRoutes } from "./routes/records.js";
import { registrationRoutes } from "./routes/registrations.js";
import { signRoutes } from "./routes/sign-digest.js";
import { usageRoutes, webhookRoutes } from "./routes/usage.js";
import { verifyRoutes } from "./routes/verify.js";
import { waitlistRoutes } from "./routes/waitlist.js";

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: (origin) => origin || "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Idempotency-Key", "X-Bootstrap-Token"],
  }),
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    service: "ozdna-api",
    version: "0.1.0-auth-marks",
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
app.route("/v1", registrationRoutes);
app.route("/v1", signRoutes);
app.route("/v1", recordRoutes);
app.route("/v1", bootstrapRoutes);
app.route("/v1", markRoutes);
app.route("/v1", usageRoutes);
app.route("/v1", webhookRoutes);

app.notFound((c) =>
  c.json({ error: "not_found", message: "No such route. See GET /v1/openapi.yaml." }, 404),
);

export default app;
