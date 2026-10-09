// Phase 4c: source verification storage, routes, events and refresh.
// Providers are the fake-providers auxiliary worker (synthetic fixtures); every other outbound
// request from the API Worker hits network-blocked. CI never touches the network.

import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  env,
  getQueueResult,
  SELF,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "../src/index.js";
import { d1Stores } from "../src/repo/d1.js";
import { d1SourceStore } from "../src/repo/sources.js";
import { storePayload } from "../src/sources/payload-store.js";
import { enqueueStale, handleRefreshBatch, refreshOne } from "../src/sources/refresh.js";
import { providerFetch, runVerification } from "../src/sources/service.js";
import { ACTOR, api, createProject, createTenant, expectErrorShape, T0 } from "./helpers.js";

const NORMAL = "10.5555/ozdna.normal.2024";
const RETRACTED = "10.5555/ozdna.retracted.2022";
const FLIP = "10.5555/ozdna.flip.2024";
const NORMAL_CSL = {
  title: "Analytical engines and the calculation of Bernoulli numbers",
  author: [{ family: "Lovelace", given: "Ada" }, { family: "Babbage" }],
  issued: { "date-parts": [[2024, 3, 14]] },
  "container-title": "Journal of Synthetic Fixtures",
};

let citationCounter = 0;
const citation = () => `cit_${String(++citationCounter).padStart(10, "0")}x${Date.now() % 1e6}`;

async function sourcesApi(path: string, init: { key?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = {};
  if (init.key) headers.Authorization = `Bearer ${init.key}`;
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  const res = await SELF.fetch(`http://local/v1${path}`, {
    method: init.body !== undefined ? "POST" : "GET",
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const text = await res.text();
  return { status: res.status, json: (text ? JSON.parse(text) : null) as any };
}

function verifyBody(projectId: string, reference: unknown, citationId = citation()) {
  return {
    project_id: projectId,
    citation_id: citationId,
    reference,
    occurred_at: T0,
    actor: ACTOR,
  };
}

const doiRef = (value: string) => ({ identifier: { scheme: "doi", value } });
const cslRef = (doi: string, extra: Record<string, unknown> = NORMAL_CSL) => ({
  csl: { DOI: doi, ...extra },
});

async function setup() {
  const t = await createTenant();
  const projectId = await createProject(t.key);
  return { ...t, projectId };
}

async function verify(key: string, projectId: string, reference: unknown, citationId?: string) {
  return sourcesApi("/sources/verify", {
    key,
    body: verifyBody(projectId, reference, citationId),
  });
}

const types = (events: Array<{ type: string }>) => events.map((e) => e.type);

async function chainValid(key: string, projectId: string) {
  const r = await api(`/projects/${projectId}/verify`, { key });
  return r.json.valid as boolean;
}

describe("POST /v1/sources/verify", () => {
  it("verifies a CSL-JSON reference and records imported, verified and status events", async () => {
    const { key, projectId } = await setup();
    const r = await verify(key, projectId, cslRef(NORMAL));
    expect(r.status).toBe(201);
    expect(r.json.verification.state).toBe("VERIFIED");
    expect(r.json.verification.provider).toBe("crossref");
    expect(r.json.verification.snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(types(r.json.events)).toEqual([
      "source.imported",
      "source.verification_recorded",
      "source.status_changed",
    ]);
    const status = r.json.events[2].payload;
    expect(status).toMatchObject({ previous_state: null, state: "VERIFIED", trigger: "request" });
    expect(status.snapshot_sha256).toBe(r.json.verification.snapshot_sha256);
    expect(r.json.events[0].payload.input_kind).toBe("csl_json");
    expect(await chainValid(key, projectId)).toBe(true);
  });

  it("gives identical snapshot hashes for the same fixture verified twice", async () => {
    const a = await setup();
    const first = await verify(a.key, a.projectId, cslRef(NORMAL));
    const second = await verify(a.key, a.projectId, cslRef(NORMAL));
    const otherTenant = await setup();
    const third = await verify(otherTenant.key, otherTenant.projectId, cslRef(NORMAL));
    expect(second.json.verification.snapshot_sha256).toBe(first.json.verification.snapshot_sha256);
    expect(third.json.verification.snapshot_sha256).toBe(first.json.verification.snapshot_sha256);
    // Same source for the same tenant; second run reuses the stored snapshot, no status change.
    expect(second.json.source.id).toBe(first.json.source.id);
    expect(types(second.json.events)).toEqual(["source.imported", "source.verification_recorded"]);
    const detail = await sourcesApi(`/sources/${first.json.source.id}`, { key: a.key });
    expect(detail.json.snapshots).toHaveLength(1);
  });

  it("returns candidates for an ambiguous identifier and never auto-corrects", async () => {
    const { key, projectId, tenantId } = await setup();
    const r = await verify(key, projectId, doiRef(`${NORMAL}.`));
    expect(r.status).toBe(200);
    expect(r.json.source).toBeNull();
    expect(r.json.verification.state).toBe("UNVERIFIED");
    expect(r.json.verification.candidates).toEqual([
      { scheme: "doi", value: `${NORMAL}.` },
      { scheme: "doi", value: NORMAL },
    ]);
    expect(types(r.json.events)).toEqual(["source.rejected"]);
    expect(r.json.events[0].payload.reason).toBe("identifier_ambiguous");
    const sources = d1SourceStore(env.PROV_DB);
    expect(await sources.byIdentifier(tenantId, "doi", NORMAL)).toBeNull();
    expect(await sources.byIdentifier(tenantId, "doi", `${NORMAL}.`)).toBeNull();
  });

  it("rejects an invalid identifier and a CSL item without one", async () => {
    const { key, projectId } = await setup();
    const bad = await verify(key, projectId, doiRef("not a doi"));
    expect(bad.json.events[0].payload.reason).toBe("identifier_invalid");
    const none = await verify(key, projectId, { csl: { title: "No identifier here" } });
    expect(none.json.events[0].payload.reason).toBe("no_identifier");
    expect(await chainValid(key, projectId)).toBe(true);
  });

  it.each([
    ["10.5555/ozdna.outage", "provider_error", ["doi_ra"]],
    ["10.5555/ozdna.timeout", "timeout", ["doi_ra"]],
    ["10.5555/ozdna.ratelimited", "rate_limited", ["doi_ra", "crossref"]],
  ])("provider failure on %s → source.verification_failed (%s) and UNVERIFIED", async (doi, reason, providers) => {
    const { key, projectId } = await setup();
    const r = await verify(key, projectId, doiRef(doi));
    expect(r.status).toBe(201);
    expect(r.json.verification.state).toBe("UNVERIFIED");
    expect(r.json.verification.failure_reason).toBe(reason);
    expect(types(r.json.events)).toEqual([
      "source.imported",
      "source.verification_failed",
      "source.status_changed",
    ]);
    expect(r.json.events[1].payload).toEqual({
      source_id: r.json.source.id,
      reason,
      verifier_version: r.json.verification.verifier_version,
      attempted_providers: providers,
    });
    expect(r.json.events[2].payload.state).toBe("UNVERIFIED");
  });

  it("records a DOI that does not exist as IDENTIFIER_NOT_FOUND with a doi.org snapshot", async () => {
    const { key, projectId } = await setup();
    const r = await verify(key, projectId, doiRef("10.5555/ozdna.does-not-exist"));
    expect(r.json.verification.state).toBe("IDENTIFIER_NOT_FOUND");
    expect(r.json.verification.snapshot_sha256).toMatch(/^[0-9a-f]{64}$/);
    // No crossref/datacite provider: recorded via status_changed, not verification_recorded@1.
    expect(types(r.json.events)).toEqual(["source.imported", "source.status_changed"]);
  });

  it("refuses to relink a citation to a different source", async () => {
    const { key, projectId } = await setup();
    const cit = citation();
    await verify(key, projectId, cslRef(NORMAL), cit);
    const r = await verify(key, projectId, doiRef(RETRACTED), cit);
    expect(r.status).toBe(409);
    expectErrorShape(r.json);
  });
});

describe("tenant isolation", () => {
  it("hides sources, statuses and projects of other tenants", async () => {
    const a = await setup();
    const b = await setup();
    const verified = await verify(a.key, a.projectId, cslRef(NORMAL));
    const sourceId = verified.json.source.id;

    for (const path of [`/sources/${sourceId}`, `/sources/${sourceId}/status`]) {
      const r = await sourcesApi(path, { key: b.key });
      expect(r.status).toBe(404);
      expectErrorShape(r.json);
      expect((await sourcesApi(path, { key: a.key })).status).toBe(200);
    }
    const intoA = await verify(b.key, a.projectId, cslRef(NORMAL));
    expect(intoA.status).toBe(404);
    expect(intoA.json.code).toBe("PROJECT_NOT_FOUND");

    const own = await verify(b.key, b.projectId, cslRef(NORMAL));
    expect(own.json.source.id).not.toBe(sourceId);
    expect(await d1SourceStore(env.PROV_DB).get(b.tenantId, sourceId)).toBeNull();
  });

  it("requires a service key with the right scope on every route", async () => {
    const readOnly = await createTenant(["events:read"]);
    const owner = await setup();
    const sourceId = (await verify(owner.key, owner.projectId, cslRef(NORMAL))).json.source.id;
    expect((await verify(readOnly.key, owner.projectId, cslRef(NORMAL))).status).toBe(403);
    for (const path of ["/sources/verify", `/sources/${sourceId}`, `/sources/${sourceId}/status`]) {
      const r =
        path === "/sources/verify"
          ? await sourcesApi(path, { body: verifyBody(owner.projectId, cslRef(NORMAL)) })
          : await sourcesApi(path);
      expect(r.status).toBe(401);
    }
  });
});

describe("append-only source tables", () => {
  const tables = [
    "sources",
    "source_identifiers",
    "project_sources",
    "provider_payload_blobs",
    "source_metadata_snapshots",
    "source_verification_results",
    "source_status_events",
  ];

  it.each(tables)("%s rejects UPDATE and DELETE", async (table) => {
    const { key, projectId } = await setup();
    await verify(key, projectId, cslRef(RETRACTED));
    const row = await env.PROV_DB.prepare(`SELECT rowid FROM ${table} LIMIT 1`).first<{
      rowid: number;
    }>();
    expect(row).not.toBeNull();
    await expect(
      env.PROV_DB.prepare(`UPDATE ${table} SET tenant_id = tenant_id WHERE rowid = ?`)
        .bind(row!.rowid)
        .run(),
    ).rejects.toThrow(/append-only/);
    await expect(
      env.PROV_DB.prepare(`DELETE FROM ${table} WHERE rowid = ?`).bind(row!.rowid).run(),
    ).rejects.toThrow(/append-only/);
  });
});

describe("status changes and refresh", () => {
  const later = (days: number) => () => new Date(Date.now() + days * 86_400_000).toISOString();

  it("a VERIFIED source flipping to RETRACTED keeps the original verification in history", async () => {
    const a = await setup();
    const secondProject = await createProject(a.key);
    const first = await verify(a.key, a.projectId, cslRef(FLIP));
    await verify(a.key, secondProject, cslRef(FLIP));
    expect(first.json.verification.state).toBe("VERIFIED");
    const sourceId = first.json.source.id;

    await env.PROVIDER_FETCHER!.fetch("https://fake.control/variant", {
      method: "POST",
      body: JSON.stringify({ doi: FLIP, variant: "retracted" }),
    });
    try {
      const outcome = await refreshOne(
        env,
        { tenant_id: a.tenantId, source_id: sourceId },
        later(8),
      );
      expect(outcome).toBe("refreshed");
    } finally {
      await env.PROVIDER_FETCHER!.fetch("https://fake.control/variant", {
        method: "POST",
        body: JSON.stringify({ doi: FLIP, variant: "default" }),
      });
    }

    const status = await sourcesApi(`/sources/${sourceId}/status`, { key: a.key });
    expect(status.json.state).toBe("RETRACTED");
    expect(status.json.history.map((h: any) => [h.previous_state, h.state])).toEqual([
      [null, "VERIFIED"],
      ["VERIFIED", "RETRACTED"],
    ]);
    const original = status.json.results.find(
      (r: any) => r.id === first.json.verification.result_id,
    );
    expect(original).toMatchObject({ state: "VERIFIED", trigger: "request" });
    expect(status.json.results.at(-1)).toMatchObject({ state: "RETRACTED", trigger: "refresh" });
    // Both snapshots kept, with different hashes.
    const detail = await sourcesApi(`/sources/${sourceId}`, { key: a.key });
    expect(new Set(detail.json.snapshots.map((s: any) => s.snapshot_sha256)).size).toBe(2);

    // Every citing project got the change; both chains still verify.
    for (const projectId of [a.projectId, secondProject]) {
      const events = (await api(`/projects/${projectId}/events`, { key: a.key })).json.events;
      const last = events.at(-1);
      expect(last.type).toBe("source.status_changed");
      expect(last.payload).toMatchObject({
        source_id: sourceId,
        previous_state: "VERIFIED",
        state: "RETRACTED",
        trigger: "refresh",
      });
      expect(last.actor.kind).toBe("service");
      expect(await chainValid(a.key, projectId)).toBe(true);
    }
  });

  it("a failed lookup never overwrites an existing status", async () => {
    const a = await setup();
    const first = await verify(a.key, a.projectId, cslRef(NORMAL));
    const sources = d1SourceStore(env.PROV_DB);
    const source = (await sources.get(a.tenantId, first.json.source.id))!;
    const run = await runVerification(
      {
        env: { ...env, PROVIDER_CONTACT_EMAIL: undefined },
        stores: d1Stores(env.PROV_DB),
        sources,
        now: () => new Date().toISOString(),
      },
      a.tenantId,
      source,
      { identifier: { scheme: "doi", value: NORMAL } },
      "refresh",
    );
    expect(run.result.state).toBe("UNVERIFIED");
    expect(run.failure).toBe("provider_not_configured");
    expect(run.attemptedProviders).toEqual([]);
    expect(run.statusChange).toBeNull();
    expect((await sources.latestStatus(a.tenantId, source.id))!.state).toBe("VERIFIED");
  });

  it("refresh is idempotent: a source that is not stale is not re-verified", async () => {
    const a = await setup();
    const r = await verify(a.key, a.projectId, cslRef(NORMAL));
    const msg = { tenant_id: a.tenantId, source_id: r.json.source.id };
    expect(await refreshOne(env, msg, later(0))).toBe("not_stale");
    expect(await refreshOne(env, msg, later(8))).toBe("refreshed");
    expect(await refreshOne(env, msg, later(8))).toBe("not_stale");
    const status = await sourcesApi(`/sources/${r.json.source.id}/status`, { key: a.key });
    expect(status.json.results).toHaveLength(2);
    expect(status.json.history).toHaveLength(1);
  });

  it("is rate limited per provider", async () => {
    const a = await setup();
    const r = await verify(a.key, a.projectId, cslRef(NORMAL));
    const limited = { ...env, PROVIDER_RATE_PER_MINUTE: "1" };
    const msg = { tenant_id: a.tenantId, source_id: r.json.source.id };
    // The verify call above just used doi_ra and crossref within the last minute.
    expect(await refreshOne(limited, msg, later(0))).toBe("rate_limited");
  });

  it("queue consumer acks processed messages and retries rate-limited ones", async () => {
    const a = await setup();
    const r = await verify(a.key, a.projectId, cslRef(NORMAL));
    const body = { tenant_id: a.tenantId, source_id: r.json.source.id };
    const batch = createMessageBatch("ozdna-provenance-source-refresh", [
      { id: "m1", timestamp: new Date(), attempts: 1, body },
    ]);
    const ctx = createExecutionContext();
    await handleRefreshBatch(batch as any, env, later(8));
    await waitOnExecutionContext(ctx);
    expect((await getQueueResult(batch, ctx)).explicitAcks).toEqual(["m1"]);

    const limitedBatch = createMessageBatch("ozdna-provenance-source-refresh", [
      { id: "m2", timestamp: new Date(), attempts: 1, body },
    ]);
    const ctx2 = createExecutionContext();
    await handleRefreshBatch(limitedBatch as any, { ...env, PROVIDER_RATE_PER_MINUTE: "1" });
    await waitOnExecutionContext(ctx2);
    const limited = await getQueueResult(limitedBatch, ctx2);
    expect(limited.retryMessages.map((m) => m.msgId)).toEqual(["m2"]);
    expect(limited.explicitAcks).toEqual([]);
  });

  it("cron enqueues stale sources through the queue binding", async () => {
    const a = await setup();
    const r = await verify(a.key, a.projectId, cslRef(NORMAL));
    const sent: unknown[] = [];
    const queue = {
      async sendBatch(msgs: Array<{ body: unknown }>) {
        sent.push(...msgs.map((m) => m.body));
      },
    };
    const fakeEnv = { ...env, REFRESH_QUEUE: queue as unknown as Queue };
    const future = Date.now() + 8 * 86_400_000;
    const ctx = createExecutionContext();
    await worker.scheduled(createScheduledController({ scheduledTime: future }), fakeEnv, ctx);
    await waitOnExecutionContext(ctx);
    expect(sent).toContainEqual({ tenant_id: a.tenantId, source_id: r.json.source.id });
    expect(
      await enqueueStale({ ...env, REFRESH_QUEUE: undefined }, new Date(future).toISOString()),
    ).toBe(0);
  });
});

describe("raw payloads and Retraction Watch", () => {
  it("stores the provider payload by reference with Retraction Watch entries reduced to hashes", async () => {
    const { key, tenantId, projectId } = await setup();
    const r = await verify(key, projectId, cslRef(RETRACTED, {}));
    expect(r.json.verification.state).toBe("RETRACTED");
    const detail = await sourcesApi(`/sources/${r.json.source.id}`, { key });
    const snap = detail.json.snapshots[0];
    expect(snap).toMatchObject({ payload_store: "d1", payload_note: "RETRACTION_WATCH_REDACTED" });

    const bytes = await d1SourceStore(env.PROV_DB).blob(tenantId, snap.payload_ref);
    const stored = JSON.parse(new TextDecoder().decode(bytes!));
    const updates = stored.message["updated-by"];
    const rw = updates.filter((u: any) => u.source === "retraction-watch");
    expect(rw).toHaveLength(1);
    expect(Object.keys(rw[0]).sort()).toEqual(["entry_sha256", "source"]);
    expect(JSON.stringify(stored)).not.toContain("record-id");
    // The publisher's own notice is kept as delivered.
    expect(updates.some((u: any) => u.source === "publisher" && u.type === "retraction")).toBe(
      true,
    );

    const canon = await env.PROV_DB.prepare(
      "SELECT snapshot_canonical FROM source_metadata_snapshots WHERE id = ?",
    )
      .bind(snap.id)
      .first<{ snapshot_canonical: string }>();
    const snapshot = JSON.parse(canon!.snapshot_canonical);
    const rwSnap = snapshot.updates.filter((u: any) => u.source === "retraction-watch");
    expect(Object.keys(rwSnap[0]).sort()).toEqual(["entry_sha256", "source"]);
    // The response hash still identifies the exact bytes the provider sent.
    expect(snap.response_sha256).not.toBe(snap.payload_ref);
  });

  it("uses R2 when a bucket is bound", async () => {
    const { tenantId } = await setup();
    const bytes = new TextEncoder().encode('{"message":{"DOI":"10.5555/r2"}}');
    const stored = await storePayload(
      { ...env, RAW_PAYLOADS: env.TEST_R2 },
      d1SourceStore(env.PROV_DB),
      tenantId,
      bytes,
    );
    expect(stored.store).toBe("r2");
    expect(stored.write).toBeNull();
    const obj = await env.TEST_R2.get(stored.ref!);
    expect(await obj!.text()).toBe('{"message":{"DOI":"10.5555/r2"}}');
  });
});

describe("network", () => {
  it("never reaches the real network from tests", async () => {
    const direct = providerFetch({ ...env, PROVIDER_FETCHER: undefined });
    const res = await direct("https://doi.org/doiRA/10.5555/x", {});
    expect(res.status).toBe(599);
    expect(await res.text()).toBe("network blocked in tests: doi.org");
  });
});
