// /v1/sources — Phase 4c source verification. Tenant-scoped like every other route: another
// tenant's source or project is indistinguishable from one that does not exist (404).
//
// Event mapping (the registry uses dotted lowercase types; see ADR-004 §7):
//   SOURCE_IMPORTED → source.imported@1        SOURCE_VERIFIED → source.verification_recorded@1
//   SOURCE_REJECTED → source.rejected@1        SOURCE_STATUS_CHANGED → source.status_changed@1
//   SOURCE_VERIFICATION_FAILED → source.verification_failed@1

import {
  canonicalize,
  normalizeNfcDeep,
  parseCanonical,
  type StoredEvent,
} from "@ozdna/provenance-schema";
import {
  type CitedReference,
  normalizeIdentifier,
  toVerificationPayload,
} from "@ozdna/source-verification";
import { Hono } from "hono";
import { requireScopes } from "../auth.js";
import { readJson } from "../body.js";
import { sha256Hex } from "../crypto.js";
import type { Env } from "../env.js";
import { HttpError } from "../errors.js";
import { newId } from "../ids.js";
import { d1Stores } from "../repo/d1.js";
import { d1SourceStore, type SourceRow } from "../repo/sources.js";
import { verifySourceSchema } from "../schemas.js";
import { appendWithRetry } from "../service/append.js";
import { toCitedReference } from "../sources/reference.js";
import {
  canonicalReference,
  DEFAULT_REFRESH_SECONDS,
  type Deps,
  fanOutStatusChange,
  intEnv,
  MIN_REFRESH_SECONDS,
  runVerification,
  VERIFIER_VERSION,
} from "../sources/service.js";

export const sourceRoutes = new Hono<{ Bindings: Env }>();

const now = () => new Date().toISOString();

function sourceView(s: SourceRow) {
  return {
    id: s.id,
    scheme: s.scheme,
    value: s.value,
    refresh_after_seconds: s.refresh_after_seconds,
    created_at: s.created_at,
  };
}

async function inputHash(value: unknown): Promise<string> {
  try {
    return await sha256Hex(canonicalize(normalizeNfcDeep(value)));
  } catch {
    throw new HttpError(
      400,
      "invalid_request",
      "REFERENCE_UNREPRESENTABLE",
      "The reference contains values that cannot be represented (non-integer numbers, lone surrogates).",
    );
  }
}

sourceRoutes.post("/sources/verify", requireScopes("events:append"), async (c) => {
  const svc = c.get("svc");
  const stores = d1Stores(c.env.PROV_DB);
  const sources = d1SourceStore(c.env.PROV_DB);
  const deps: Deps = { env: c.env, stores, sources, now };
  const { data } = await readJson(c, verifySourceSchema);

  const project = await stores.projects.get(svc.tenantId, data.project_id);
  if (!project) throw new HttpError(404, "not_found", "PROJECT_NOT_FOUND", "No such project.");
  const projectId = project.id;
  const actor = { ...data.actor, asserted_by: svc.serviceId };

  const { reference, kind } = toCitedReference(data.reference);
  const inputSha256 = await inputHash(reference ?? data.reference);

  // ---- Not acceptable as a source: rejected, never guessed.
  const normalized = reference
    ? normalizeIdentifier(reference.identifier.scheme, reference.identifier.value)
    : null;
  if (normalized === null || normalized.status !== "ok") {
    const reason =
      normalized === null
        ? "no_identifier"
        : normalized.status === "ambiguous"
          ? "identifier_ambiguous"
          : "identifier_invalid";
    const candidates =
      normalized?.status === "ambiguous"
        ? normalized.candidates.slice(0, 10).map((value) => ({ scheme: normalized.scheme, value }))
        : [];
    const { event } = await appendWithRetry(stores, {
      tenantId: svc.tenantId,
      projectId,
      eventId: newId("evt"),
      draft: {
        type: "source.rejected",
        type_version: 1,
        artifact_id: null,
        payload: { citation_id: data.citation_id, reason, input_sha256: inputSha256, candidates },
        occurred_at: data.occurred_at,
        actor,
      },
      now,
    });
    return c.json(
      {
        source: null,
        verification: {
          result_id: null,
          state: "UNVERIFIED",
          confidence_bp: 0,
          components: {},
          provider: null,
          reason: reason.toUpperCase(),
          failure_reason: null,
          candidates,
          snapshot_sha256: null,
          verifier_version: VERIFIER_VERSION,
        },
        events: [event],
      },
      200,
    );
  }

  // ---- Find or create the tenant's source for this identifier.
  const ref: CitedReference = {
    ...reference!,
    identifier: { scheme: normalized.scheme, value: normalized.value },
  };
  let source = await sources.byIdentifier(svc.tenantId, normalized.scheme, normalized.value);
  if (!source) {
    const row = {
      id: newId("src"),
      scheme: normalized.scheme,
      value: normalized.value,
      reference_canonical: canonicalReference(ref),
      refresh_after_seconds: intEnv(
        c.env.SOURCE_REFRESH_SECONDS,
        DEFAULT_REFRESH_SECONDS,
        MIN_REFRESH_SECONDS,
        365 * 24 * 3600,
      ),
    };
    try {
      await stores.uow.commit([
        sources.insert(svc.tenantId, row),
        sources.insertIdentifier(svc.tenantId, row.id, {
          scheme: row.scheme,
          value: row.value,
          origin: "input",
        }),
      ]);
    } catch (e) {
      if (!String(e instanceof Error ? e.message : e).includes("UNIQUE constraint failed")) throw e;
    }
    source = await sources.byIdentifier(svc.tenantId, normalized.scheme, normalized.value);
    if (!source) throw new HttpError(500, "internal_error", "INTERNAL", "Source not stored.");
  }

  // ---- Link the citation to the source (once); the link is what status fan-out follows.
  const events: StoredEvent[] = [];
  const link = await sources.link(svc.tenantId, projectId, data.citation_id);
  if (link && link.source_id !== source.id) {
    throw new HttpError(
      409,
      "conflict",
      "CITATION_LINKED_ELSEWHERE",
      "This citation_id is already linked to a different source in this project.",
    );
  }
  if (!link) {
    const src = source;
    const { event } = await appendWithRetry(stores, {
      tenantId: svc.tenantId,
      projectId,
      eventId: newId("evt"),
      draft: {
        type: "source.imported",
        type_version: 1,
        artifact_id: null,
        payload: {
          source_id: src.id,
          citation_id: data.citation_id,
          identifier: { scheme: src.scheme, value: src.value },
          input_kind: kind,
          input_sha256: inputSha256,
        },
        occurred_at: data.occurred_at,
        actor,
      },
      extraWrites: () => [
        sources.insertLink(svc.tenantId, {
          project_id: projectId,
          source_id: src.id,
          citation_id: data.citation_id,
          service_id: svc.serviceId,
        }),
      ],
      now,
    });
    events.push(event);
  }

  // ---- Verify, persist, record on the chain.
  const run = await runVerification(deps, svc.tenantId, source, ref, "request");
  // A failed lookup is recorded once, as source.verification_failed; verification_recorded@1
  // is reserved for an actual provider answer.
  const payload = run.failure ? null : toVerificationPayload(run.result, data.citation_id);
  if (payload) {
    const { event } = await appendWithRetry(stores, {
      tenantId: svc.tenantId,
      projectId,
      eventId: newId("evt"),
      draft: {
        type: "source.verification_recorded",
        type_version: 1,
        artifact_id: null,
        payload,
        occurred_at: data.occurred_at,
        actor,
      },
      now,
    });
    events.push(event);
  }
  if (run.failure) {
    const { event } = await appendWithRetry(stores, {
      tenantId: svc.tenantId,
      projectId,
      eventId: newId("evt"),
      draft: {
        type: "source.verification_failed",
        type_version: 1,
        artifact_id: null,
        payload: {
          source_id: source.id,
          reason: run.failure,
          verifier_version: VERIFIER_VERSION,
          attempted_providers: [...run.attemptedProviders],
        },
        occurred_at: data.occurred_at,
        actor,
      },
      now,
    });
    events.push(event);
  }
  events.push(...(await fanOutStatusChange(deps, svc.tenantId, source.id, run, "request")));

  return c.json(
    {
      source: sourceView(source),
      verification: {
        result_id: run.resultId,
        state: run.result.state,
        confidence_bp: run.result.confidence_bp,
        components: { ...run.result.components },
        provider: run.result.provider,
        reason: run.result.reason,
        failure_reason: run.failure,
        candidates: run.result.candidates.map((x) => ({ scheme: x.scheme, value: x.value })),
        snapshot_sha256: run.snapshotSha256,
        verifier_version: VERIFIER_VERSION,
      },
      events,
    },
    201,
  );
});

async function requireSource(c: { env: Env; get: (k: "svc") => { tenantId: string } }, id: string) {
  const source = await d1SourceStore(c.env.PROV_DB).get(c.get("svc").tenantId, id);
  if (!source) throw new HttpError(404, "not_found", "SOURCE_NOT_FOUND", "No such source.");
  return source;
}

sourceRoutes.get("/sources/:id", requireScopes("events:read"), async (c) => {
  const tenantId = c.get("svc").tenantId;
  const source = await requireSource(c, c.req.param("id"));
  const sources = d1SourceStore(c.env.PROV_DB);
  const [identifiers, snapshots, latest] = await Promise.all([
    sources.identifiers(tenantId, source.id),
    sources.snapshots(tenantId, source.id),
    sources.latestResult(tenantId, source.id),
  ]);
  return c.json({
    source: sourceView(source),
    identifiers,
    snapshots,
    latest_result: latest
      ? { ...latest, components: parseCanonical(latest.components) as Record<string, number> }
      : null,
  });
});

sourceRoutes.get("/sources/:id/status", requireScopes("events:read"), async (c) => {
  const tenantId = c.get("svc").tenantId;
  const source = await requireSource(c, c.req.param("id"));
  const sources = d1SourceStore(c.env.PROV_DB);
  const [history, results] = await Promise.all([
    sources.statusHistory(tenantId, source.id),
    sources.results(tenantId, source.id, 500),
  ]);
  return c.json({
    source_id: source.id,
    state: history.at(-1)?.state ?? null,
    history,
    results: results.map((r) => ({
      id: r.id,
      state: r.state,
      confidence_bp: r.confidence_bp,
      reason: r.reason,
      failure_reason: r.failure_reason,
      snapshot_id: r.snapshot_id,
      verifier_version: r.verifier_version,
      trigger: r.trigger,
      created_at: r.created_at,
    })),
  });
});
