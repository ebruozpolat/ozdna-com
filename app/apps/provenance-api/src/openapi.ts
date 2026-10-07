// OpenAPI 3.1 document generated from the zod schemas in schemas.ts — never hand-written.

import { z } from "zod";
import { SCOPES } from "./auth.js";
import { schemaRegistry } from "./schemas.js";

const ref = (id: string) => ({ $ref: `#/components/schemas/${id}` });
const json = (id: string) => ({ "application/json": { schema: ref(id) } });
const err = (description: string) => ({ description, content: json("Error") });

const projectId = { name: "id", in: "path", required: true, schema: { type: "string" } };
const idempotencyKey = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  schema: { type: "string", pattern: "^[A-Za-z0-9_.:-]{1,128}$" },
};
const authErrors = {
  "401": err("Missing, malformed or revoked service key"),
  "403": err("Key lacks the required scope"),
};
const secured = (scope: string) => ({ security: [{ serviceKey: [scope] }] });

function components(): Record<string, unknown> {
  const out = z.toJSONSchema(schemaRegistry, {
    uri: (id) => `#/components/schemas/${id}`,
    unrepresentable: "any",
  }) as { schemas: Record<string, Record<string, unknown>> };
  for (const s of Object.values(out.schemas)) {
    delete s.$schema;
    delete s.$id;
  }
  return out.schemas;
}

export function buildOpenApi() {
  return {
    openapi: "3.1.0",
    info: {
      title: "ozDNA research provenance API",
      version: "0.2.0-phase2",
      description:
        "Append-only, tamper-evident event chains per project. Integrity only until signed checkpoints (Phase 3). Error shape: {error, code, message}.",
    },
    servers: [{ url: "/v1/provenance" }],
    components: {
      schemas: components(),
      securitySchemes: {
        serviceKey: {
          type: "http",
          scheme: "bearer",
          description: `Service key (ozp_…). Scopes: ${SCOPES.join(", ")}.`,
        },
        adminToken: { type: "apiKey", in: "header", name: "X-Admin-Token" },
      },
    },
    paths: {
      "/admin/tenants": {
        post: {
          summary: "Create a tenant and its first service key (key shown once)",
          security: [{ adminToken: [] }],
          requestBody: { required: true, content: json("CreateTenant") },
          responses: {
            "201": { description: "Created" },
            "401": err("Bad admin token"),
            "503": err("Admin bootstrap disabled"),
          },
        },
      },
      "/projects": {
        post: {
          summary: "Create a project (appends its project.created genesis event)",
          ...secured("projects:write"),
          requestBody: { required: true, content: json("CreateProject") },
          responses: {
            "201": { description: "Created" },
            "409": err("external_ref exists"),
            ...authErrors,
          },
        },
        get: {
          summary: "List this tenant's projects",
          ...secured("events:read"),
          responses: { "200": { description: "Projects" }, ...authErrors },
        },
      },
      "/projects/{id}": {
        get: {
          summary: "Get a project",
          ...secured("events:read"),
          parameters: [projectId],
          responses: { "200": { description: "Project" }, "404": err("Not found"), ...authErrors },
        },
      },
      "/projects/{id}/artifacts": {
        post: {
          summary: "Register an artifact (appends artifact.registered)",
          ...secured("artifacts:write"),
          parameters: [projectId, idempotencyKey],
          requestBody: { required: true, content: json("CreateArtifact") },
          responses: {
            "201": { description: "Registered" },
            "200": { description: "Idempotent replay" },
            "404": err("Project not found"),
            "422": err("Event invalid"),
            ...authErrors,
          },
        },
      },
      "/projects/{id}/events": {
        post: {
          summary: "Append an event",
          ...secured("events:append"),
          parameters: [projectId, idempotencyKey],
          requestBody: { required: true, content: json("AppendEvent") },
          responses: {
            "201": { description: "Appended", content: json("AppendResult") },
            "200": { description: "Idempotent replay", content: json("AppendResult") },
            "400": err("Malformed request or type not appendable here"),
            "404": err("Project not found"),
            "409": err("Idempotency key reused with a different body, or chain corrupt"),
            "413": err("Body too large"),
            "422": err("Event invalid (registry, payload, artifact)"),
            "503": err("Append contention; retry"),
            ...authErrors,
          },
        },
        get: {
          summary: "List events in seq order",
          ...secured("events:read"),
          parameters: [
            projectId,
            { name: "after_seq", in: "query", schema: { type: "integer", default: -1 } },
            { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          ],
          responses: { "200": { description: "Events" }, "404": err("Not found"), ...authErrors },
        },
      },
      "/projects/{id}/verify": {
        get: {
          summary: "Re-verify the stored chain from canonical JSON",
          ...secured("events:read"),
          parameters: [projectId],
          responses: {
            "200": { description: "Verification result", content: json("VerifyResult") },
            "404": err("Not found"),
            ...authErrors,
          },
        },
      },
    },
  };
}
