// Tenant-scoped project, artifact and event endpoints. Every lookup goes through the
// repository layer with the tenant id from the service key; another tenant's ids are
// indistinguishable from ids that do not exist (404).

import { verifyChain } from "@ozdna/provenance-core";
import { REGISTRY_V1 } from "@ozdna/provenance-schema";
import { type Context, Hono } from "hono";
import { requireScopes } from "../auth.js";
import { readJson } from "../body.js";
import { sha256Hex } from "../crypto.js";
import type { Env } from "../env.js";
import { HttpError } from "../errors.js";
import { newId } from "../ids.js";
import { d1Stores } from "../repo/d1.js";
import type { Stores } from "../repo/stores.js";
import { appendEventSchema, createArtifactSchema, createProjectSchema } from "../schemas.js";
import { appendWithRetry, parseStoredRow } from "../service/append.js";
import { loadChain } from "../service/chain.js";

export const projectRoutes = new Hono<{ Bindings: Env }>();

const now = () => new Date().toISOString();
const IDEMPOTENCY_KEY = /^[A-Za-z0-9_.:-]{1,128}$/;

/** Types that have their own endpoint, or need the signer (Phase 3), cannot be appended here. */
function assertAppendable(type: string, version: number): void {
  const def = REGISTRY_V1.get(type, version);
  if (!def) return; // unknown types are rejected by the registry with full issues
  if (type === "project.created" || type === "artifact.registered" || def.signatureRequired) {
    throw new HttpError(
      400,
      "invalid_request",
      "TYPE_NOT_ALLOWED",
      `${type} cannot be appended here.`,
    );
  }
}

async function requireProject(stores: Stores, tenantId: string, projectId: string) {
  const project = await stores.projects.get(tenantId, projectId);
  if (!project) throw new HttpError(404, "not_found", "PROJECT_NOT_FOUND", "No such project.");
  return project;
}

async function idempotencyFrom(c: Context, raw: string) {
  const key = c.req.header("Idempotency-Key");
  if (key === undefined) return undefined;
  if (!IDEMPOTENCY_KEY.test(key)) {
    throw new HttpError(
      400,
      "invalid_request",
      "INVALID_IDEMPOTENCY_KEY",
      "Idempotency-Key must be 1–128 of [A-Za-z0-9_.:-].",
    );
  }
  return { key, requestHash: await sha256Hex(raw) };
}

function intQuery(c: Context, name: string, dflt: number, min: number, max: number): number {
  const v = c.req.query(name);
  if (v === undefined) return dflt;
  if (!/^-?\d{1,16}$/.test(v)) {
    throw new HttpError(400, "invalid_request", "INVALID_QUERY", `${name} must be an integer.`);
  }
  return Math.min(max, Math.max(min, Number(v)));
}

projectRoutes.post("/projects", requireScopes("projects:write"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const { data } = await readJson(c, createProjectSchema);
  const projectId = newId("prj");
  const { event } = await appendWithRetry(stores, {
    tenantId: svc.tenantId,
    projectId,
    eventId: newId("evt"),
    genesis: true,
    draft: {
      type: "project.created",
      type_version: 1,
      artifact_id: null,
      payload: { external_ref: data.external_ref },
      occurred_at: data.occurred_at,
      actor: { ...data.actor, asserted_by: svc.serviceId },
    },
    extraWrites: () => [
      stores.projects.insert(svc.tenantId, { id: projectId, externalRef: data.external_ref }),
    ],
    now,
  });
  return c.json({ project: { id: projectId, external_ref: data.external_ref }, event }, 201);
});

projectRoutes.get("/projects", requireScopes("events:read"), async (c) => {
  const svc = c.get("svc");
  const limit = intQuery(c, "limit", 50, 1, 200);
  const after = c.req.query("after");
  const projects = await d1Stores(c.env.PROV_DB).projects.list(svc.tenantId, {
    limit,
    ...(after ? { afterId: after } : {}),
  });
  return c.json({ projects, next_after: projects.length === limit ? projects.at(-1)!.id : null });
});

projectRoutes.get("/projects/:id", requireScopes("events:read"), async (c) => {
  const stores = d1Stores(c.env.PROV_DB);
  const project = await requireProject(stores, c.get("svc").tenantId, c.req.param("id"));
  return c.json({ project });
});

projectRoutes.post("/projects/:id/artifacts", requireScopes("artifacts:write"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const projectId = c.req.param("id");
  await requireProject(stores, svc.tenantId, projectId);
  const { data, raw } = await readJson(c, createArtifactSchema);
  const artifactId = newId("art");
  const idempotency = await idempotencyFrom(c, raw);
  const { event, replay } = await appendWithRetry(stores, {
    tenantId: svc.tenantId,
    projectId,
    eventId: newId("evt"),
    draft: {
      type: "artifact.registered",
      type_version: 1,
      artifact_id: artifactId,
      payload: {
        kind: data.kind,
        content_sha256: data.content_sha256,
        byte_length: data.byte_length,
        media_type: data.media_type,
        label: data.label,
      },
      occurred_at: data.occurred_at,
      actor: { ...data.actor, asserted_by: svc.serviceId },
    },
    // Row values come from the validated event, not the request.
    extraWrites: (ev) => [
      stores.artifacts.insert(svc.tenantId, projectId, {
        id: ev.artifact_id!,
        kind: ev.payload.kind as string,
        content_sha256: ev.payload.content_sha256 as string,
        byte_length: ev.payload.byte_length as number,
        media_type: ev.payload.media_type as string,
        registered_seq: ev.seq,
      }),
    ],
    ...(idempotency ? { idempotency } : {}),
    now,
  });
  return c.json(
    { artifact: { id: event.artifact_id }, event, idempotent_replay: replay },
    replay ? 200 : 201,
  );
});

projectRoutes.post("/projects/:id/events", requireScopes("events:append"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const projectId = c.req.param("id");
  await requireProject(stores, svc.tenantId, projectId);
  const { data, raw } = await readJson(c, appendEventSchema);
  assertAppendable(data.type, data.type_version);
  if (data.artifact_id !== null) {
    const artifact = await stores.artifacts.get(svc.tenantId, projectId, data.artifact_id);
    if (!artifact) {
      throw new HttpError(
        422,
        "invalid_request",
        "ARTIFACT_NOT_FOUND",
        "artifact_id is not in this project.",
      );
    }
  }
  const idempotency = await idempotencyFrom(c, raw);
  const { event, replay } = await appendWithRetry(stores, {
    tenantId: svc.tenantId,
    projectId,
    eventId: newId("evt"),
    draft: {
      type: data.type,
      type_version: data.type_version,
      artifact_id: data.artifact_id,
      payload: data.payload,
      occurred_at: data.occurred_at,
      actor: { ...data.actor, asserted_by: svc.serviceId },
    },
    ...(idempotency ? { idempotency } : {}),
    now,
  });
  return c.json({ event, idempotent_replay: replay }, replay ? 200 : 201);
});

projectRoutes.get("/projects/:id/events", requireScopes("events:read"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const projectId = c.req.param("id");
  await requireProject(stores, svc.tenantId, projectId);
  const afterSeq = intQuery(c, "after_seq", -1, -1, Number.MAX_SAFE_INTEGER);
  const limit = intQuery(c, "limit", 100, 1, 500);
  const rows = await stores.events.list(svc.tenantId, projectId, { afterSeq, limit });
  const events = rows.map(parseStoredRow);
  return c.json({ events, next_after_seq: rows.length === limit ? rows.at(-1)!.seq : null });
});

/**
 * Re-verify the stored chain from its canonical text alone (denormalised columns are never
 * trusted). Integrity only: signed checkpoints arrive in Phase 3.
 */
projectRoutes.get("/projects/:id/verify", requireScopes("events:read"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const projectId = c.req.param("id");
  await requireProject(stores, svc.tenantId, projectId);

  const { events: parsed, rowCount, unparsable } = await loadChain(stores, svc.tenantId, projectId);

  const chain = await verifyChain(parsed, { projectId });
  const base = { project_id: projectId, event_count: rowCount, signature_checked: false as const };
  if (!chain.valid) {
    return c.json({
      ...base,
      valid: false,
      verified_count: chain.verified_count,
      head_seq: chain.head_seq,
      head_hash: chain.head_hash,
      first_bad_seq: chain.first_bad_seq,
      error: { code: chain.error!.code, message: chain.error!.message },
    });
  }
  if (unparsable !== null) {
    return c.json({
      ...base,
      valid: false,
      verified_count: chain.verified_count,
      head_seq: chain.head_seq,
      head_hash: chain.head_hash,
      first_bad_seq: unparsable.index,
      error: {
        code: "NOT_CANONICAL",
        message: `Stored event at seq ${unparsable.seq} is not canonical JSON.`,
      },
    });
  }
  return c.json({
    ...base,
    valid: true,
    verified_count: chain.verified_count,
    head_seq: chain.head_seq,
    head_hash: chain.head_hash,
    first_bad_seq: null,
    error: null,
  });
});
