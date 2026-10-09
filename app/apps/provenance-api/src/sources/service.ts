// Source verification service (Phase 4c): run one verification, persist it (snapshot, raw
// payload by reference, result, status timeline) and fan status changes out to every project
// that cites the source. Used by POST /v1/sources/verify and by the refresh queue consumer.
//
// Status rules: the first result of a source starts its status timeline. After that, only a
// definitive provider answer can change the status; a failed lookup (timeout, 429, outage)
// records an UNVERIFIED result but never overwrites an earlier status.

import { canonicalize, normalizeNfcDeep, type StoredEvent } from "@ozdna/provenance-schema";
import {
  type AdapterContext,
  type CitedReference,
  type FetchLike,
  type LookupOutcome,
  VERIFIER_VERSION,
  type VerificationResult,
  verifyReferenceDetailed,
} from "@ozdna/source-verification";
import type { Env } from "../env.js";
import { HttpError } from "../errors.js";
import { newId } from "../ids.js";
import type { SourceRow, SourceStore, StatusRow } from "../repo/sources.js";
import type { Stores, Write } from "../repo/stores.js";
import { appendWithRetry } from "../service/append.js";
import { storePayload } from "./payload-store.js";
import { type ProviderName, type RecordedCall, recordingFetch } from "./recorder.js";
import { snapshotOf } from "./snapshot.js";

export { VERIFIER_VERSION };

export type FailureReason =
  | "no_provider_reached"
  | "timeout"
  | "rate_limited"
  | "malformed_response"
  | "provider_error"
  | "provider_not_configured"
  | "unsupported_registration_agency";

export const SYSTEM_ACTOR_ID = "ozdna-source-verifier";
export const DEFAULT_REFRESH_SECONDS = 7 * 24 * 3600;
export const MIN_REFRESH_SECONDS = 3600;

export function intEnv(v: string | undefined, dflt: number, min: number, max: number): number {
  if (v === undefined || !/^\d{1,10}$/.test(v)) return dflt;
  return Math.min(max, Math.max(min, Number(v)));
}

/** Provider HTTP: the test-only service binding if bound, else the platform fetch. */
export function providerFetch(env: Env): FetchLike {
  const fetcher = env.PROVIDER_FETCHER;
  if (fetcher) return (url, init) => fetcher.fetch(url, init);
  return (url, init) => fetch(url, init);
}

/** Map an adapter failure onto the closed reason set of source.verification_failed@1. */
export function failureReason(reason: string, calls: readonly RecordedCall[]): FailureReason {
  if (reason === "PROVIDER_NOT_CONFIGURED") return "provider_not_configured";
  if (reason === "RA_UNSUPPORTED") return "unsupported_registration_agency";
  if (calls.some((c) => c.status === 429)) return "rate_limited";
  if (reason.includes("TIMEOUT")) return "timeout";
  if (/MALFORMED|BAD_CONTENT_TYPE|TOO_LARGE|UNKNOWN_STATE/.test(reason))
    return "malformed_response";
  if (/NETWORK|HOST_NOT_ALLOWED|REDIRECT/.test(reason)) return "no_provider_reached";
  return "provider_error";
}

function attempted(calls: readonly RecordedCall[]): ProviderName[] {
  return [...new Set(calls.map((c) => c.provider).filter((p): p is ProviderName => p !== null))];
}

export interface VerificationRun {
  readonly result: VerificationResult;
  readonly lookup: LookupOutcome | null;
  readonly resultId: string;
  readonly snapshotSha256: string | null;
  readonly failure: FailureReason | null;
  readonly attemptedProviders: readonly ProviderName[];
  readonly statusChange: StatusRow | null;
}

export interface Deps {
  readonly env: Env;
  readonly stores: Stores;
  readonly sources: SourceStore;
  readonly now: () => string;
}

/** Verify a stored source and persist everything about the attempt in one batch. */
export async function runVerification(
  deps: Deps,
  tenantId: string,
  source: SourceRow,
  ref: CitedReference,
  trigger: "request" | "refresh",
): Promise<VerificationRun> {
  const { env, stores, sources } = deps;
  const rec = recordingFetch(providerFetch(env));
  const ctx: AdapterContext = {
    fetch: rec.fetch,
    contactEmail: env.PROVIDER_CONTACT_EMAIL ?? "",
    timeoutMs: intEnv(env.PROVIDER_TIMEOUT_MS, 8000, 50, 60_000),
  };
  const { result, lookup } = await verifyReferenceDetailed(ref, ctx);
  const at = deps.now();
  const writes: Write[] = [];

  let snapshotId: string | null = null;
  const snapshot = await snapshotOf(source.value, lookup);
  if (snapshot) {
    const existing = await sources.snapshotByHash(tenantId, source.id, snapshot.sha256);
    if (existing) {
      snapshotId = existing.id;
    } else {
      const raw = rec.calls.find((c) => c.sha256 === snapshot.response_sha256)?.bytes ?? null;
      const payload = await storePayload(env, sources, tenantId, raw);
      if (payload.write) writes.push(payload.write);
      snapshotId = newId("snp");
      writes.push(
        sources.insertSnapshot(tenantId, source.id, {
          id: snapshotId,
          provider: snapshot.provider,
          snapshot_sha256: snapshot.sha256,
          snapshot_canonical: snapshot.canonical,
          response_sha256: snapshot.response_sha256,
          payload_store: payload.store,
          payload_ref: payload.ref,
          payload_note: payload.note,
        }),
      );
    }
  }

  const failure = lookup?.kind === "unavailable" ? failureReason(lookup.reason, rec.calls) : null;
  const resultId = newId("svr");
  writes.push(
    sources.insertResult(tenantId, source.id, {
      id: resultId,
      snapshot_id: snapshotId,
      state: result.state,
      confidence_bp: result.confidence_bp,
      components: canonicalize({ ...result.components }),
      reason: result.reason,
      failure_reason: failure,
      verifier_version: VERIFIER_VERSION,
      trigger,
      created_at: at,
    }),
  );

  const prev = await sources.latestStatus(tenantId, source.id);
  let statusChange: StatusRow | null = null;
  if (prev === null || (failure === null && prev.state !== result.state)) {
    statusChange = {
      seq: prev ? prev.seq + 1 : 0,
      state: result.state,
      previous_state: prev?.state ?? null,
      result_id: resultId,
      created_at: at,
    };
    writes.push(sources.insertStatus(tenantId, source.id, statusChange));
  }
  const atMs = Date.parse(at);
  for (const p of attempted(rec.calls)) writes.push(sources.insertProviderCall(p, atMs));

  try {
    await stores.uow.commit(writes);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE constraint failed") && msg.includes("source_status_events")) {
      throw new HttpError(409, "conflict", "CONCURRENT_VERIFICATION", "Retry the verification.");
    }
    throw e;
  }
  return {
    result,
    lookup,
    resultId,
    snapshotSha256: snapshot?.sha256 ?? null,
    failure,
    attemptedProviders: attempted(rec.calls),
    statusChange,
  };
}

/** Append source.status_changed to every project citing the source (one event per project). */
export async function fanOutStatusChange(
  deps: Deps,
  tenantId: string,
  sourceId: string,
  run: VerificationRun,
  trigger: "request" | "refresh",
): Promise<StoredEvent[]> {
  const change = run.statusChange;
  if (!change) return [];
  const links = await deps.sources.citingProjects(tenantId, sourceId);
  const byProject = new Map<string, string>();
  for (const l of links)
    if (!byProject.has(l.project_id)) byProject.set(l.project_id, l.service_id);
  const events: StoredEvent[] = [];
  for (const [projectId, serviceId] of byProject) {
    const { event } = await appendWithRetry(deps.stores, {
      tenantId,
      projectId,
      eventId: newId("evt"),
      draft: {
        type: "source.status_changed",
        type_version: 1,
        artifact_id: null,
        payload: {
          source_id: sourceId,
          previous_state: change.previous_state,
          state: change.state,
          result_id: change.result_id,
          snapshot_sha256: run.snapshotSha256,
          trigger,
        },
        occurred_at: change.created_at,
        actor: { kind: "service", id: SYSTEM_ACTOR_ID, asserted_by: serviceId },
      },
      now: deps.now,
    });
    events.push(event);
  }
  return events;
}

/** Canonical form of a reference (NFC, ozdna-cjson/v1); throws on unrepresentable input. */
export function canonicalReference(ref: CitedReference): string {
  return canonicalize(normalizeNfcDeep({ ...ref }));
}
