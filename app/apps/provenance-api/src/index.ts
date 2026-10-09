// ozDNA research-provenance API Worker (Phase 2). Own D1 database; separate from the
// image API. Not deployed. Rules: app/CLAUDE-ACADEMIC.md. Plan: IMPLEMENTATION_PLAN.md.
//
// Logging: none. Request bodies, payloads and keys are never logged.

import { Hono } from "hono";
import type { Env, RefreshMessage } from "./env.js";
import { apiError, HttpError } from "./errors.js";
import { buildOpenApi } from "./openapi.js";
import { adminRoutes } from "./routes/admin.js";
import { checkpointRoutes } from "./routes/checkpoints.js";
import { adminKeyRoutes, publicKeyRoutes } from "./routes/keys.js";
import { projectRoutes } from "./routes/projects.js";
import { sourceRoutes } from "./routes/sources.js";
import { enqueueStale, handleRefreshBatch } from "./sources/refresh.js";

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) =>
  c.json({ ok: true, service: "ozdna-provenance-api", version: "0.4.0-phase4c" }),
);

const openapi = buildOpenApi();
app.get("/v1/provenance/openapi.json", (c) => c.json(openapi));

app.route("/v1/provenance", adminRoutes);
app.route("/v1/provenance", projectRoutes);
app.route("/v1/provenance", checkpointRoutes);
app.route("/v1/provenance", adminKeyRoutes);
app.route("/v1", publicKeyRoutes);
app.route("/v1", sourceRoutes);

app.notFound((c) => apiError(c, 404, "not_found", "ROUTE_NOT_FOUND", "No such route."));

app.onError((e, c) => {
  if (e instanceof HttpError) return apiError(c, e.status, e.category, e.code, e.message, e.issues);
  // Deliberately no details and no logging of the request.
  return apiError(c, 500, "internal_error", "INTERNAL", "Internal error.");
});

/** Worker entry: HTTP, the refresh cron and the refresh queue consumer. */
export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(enqueueStale(env, new Date(controller.scheduledTime).toISOString()));
  },
  async queue(batch, env) {
    await handleRefreshBatch(batch, env);
  },
} satisfies ExportedHandler<Env, RefreshMessage>;
