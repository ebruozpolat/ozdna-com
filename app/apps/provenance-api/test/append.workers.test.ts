import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { d1Stores } from "../src/repo/d1.js";
import type { Stores, Write } from "../src/repo/stores.js";
import { MAX_BODY_BYTES } from "../src/schemas.js";
import { appendWithRetry, MAX_APPEND_ATTEMPTS } from "../src/service/append.js";
import {
  ACTOR,
  api,
  createArtifact,
  createProject,
  createTenant,
  declaredAiBody,
  expectErrorShape,
  H,
  T0,
} from "./helpers.js";

const draft = (tool: string) => ({
  type: "ai.use_declared",
  type_version: 1,
  artifact_id: null,
  payload: { tool, purpose: "editing" },
  occurred_at: T0,
  actor: { ...ACTOR, asserted_by: "svc_testservice00" },
});
const now = () => new Date().toISOString();

describe("concurrent appends", () => {
  it("two concurrent appends get seq n and n+1 and the chain stays valid", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const [r1, r2] = await Promise.all([
      api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody("ToolA") }),
      api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody("ToolB") }),
    ]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect([r1.json.event.seq, r2.json.event.seq].sort()).toEqual([1, 2]);
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({ valid: true, event_count: 3, head_seq: 2 });
  });

  it("many concurrent appends: contiguous seqs, valid chain", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody(`Tool${i}`) }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    expect(results.map((r) => r.json.event.seq).sort()).toEqual([1, 2, 3, 4]);
    expect((await api(`/projects/${projectId}/verify`, { key: t.key })).json.valid).toBe(true);
  });

  it("loser of a seq race retries on the new head (deterministic race)", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const real = d1Stores(env.PROV_DB);
    let raced = false;
    let commits = 0;
    // Before our first commit lands, a competing append takes seq 1.
    const racing: Stores = {
      ...real,
      uow: {
        async commit(writes: readonly Write[]) {
          commits++;
          if (!raced) {
            raced = true;
            await appendWithRetry(real, {
              tenantId: t.tenantId,
              projectId,
              eventId: "evt_competitor0000000000000",
              draft: draft("Competitor"),
              now,
            });
          }
          await real.uow.commit(writes);
        },
      },
    };
    const { event } = await appendWithRetry(racing, {
      tenantId: t.tenantId,
      projectId,
      eventId: "evt_loser000000000000000000",
      draft: draft("Loser"),
      now,
    });
    expect(commits).toBe(2);
    expect(event.seq).toBe(2);
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({ valid: true, event_count: 3 });
  });

  it("retries are bounded: persistent contention returns 503", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const real = d1Stores(env.PROV_DB);
    let commits = 0;
    const alwaysLoses: Stores = {
      ...real,
      uow: {
        async commit() {
          commits++;
          throw new Error(
            "D1_ERROR: UNIQUE constraint failed: events.project_id, events.seq: SQLITE_CONSTRAINT",
          );
        },
      },
    };
    await expect(
      appendWithRetry(alwaysLoses, {
        tenantId: t.tenantId,
        projectId,
        eventId: "evt_neverlands0000000000000",
        draft: draft("X"),
        now,
      }),
    ).rejects.toMatchObject({ status: 503, code: "APPEND_CONTENTION" });
    expect(commits).toBe(MAX_APPEND_ATTEMPTS);
  });
});

describe("idempotency", () => {
  it("same key + same body replays the original event; nothing new is stored", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const headers = { "Idempotency-Key": "append-1" };
    const first = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: declaredAiBody(),
      headers,
    });
    const again = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: declaredAiBody(),
      headers,
    });
    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.json.idempotent_replay).toBe(true);
    expect(again.json.event).toEqual(first.json.event);
    const list = await api(`/projects/${projectId}/events`, { key: t.key });
    expect(list.json.events).toHaveLength(2);
  });

  it("same key + different body is a 409", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const headers = { "Idempotency-Key": "append-2" };
    await api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody("A"), headers });
    const clash = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: declaredAiBody("B"),
      headers,
    });
    expect(clash.status).toBe(409);
    expect(clash.json.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("concurrent requests with one key store exactly one event", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const headers = { "Idempotency-Key": "append-3" };
    const rs = await Promise.all(
      [1, 2, 3].map(() =>
        api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody(), headers }),
      ),
    );
    expect(rs.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(new Set(rs.map((r) => r.json.event.event_hash)).size).toBe(1);
    const list = await api(`/projects/${projectId}/events`, { key: t.key });
    expect(list.json.events).toHaveLength(2);
  });

  it("keys are scoped per project, and malformed keys are rejected", async () => {
    const t = await createTenant();
    const p1 = await createProject(t.key);
    const p2 = await createProject(t.key);
    const headers = { "Idempotency-Key": "shared" };
    expect(
      (await api(`/projects/${p1}/events`, { key: t.key, body: declaredAiBody(), headers })).status,
    ).toBe(201);
    expect(
      (await api(`/projects/${p2}/events`, { key: t.key, body: declaredAiBody(), headers })).status,
    ).toBe(201);
    const bad = await api(`/projects/${p1}/events`, {
      key: t.key,
      body: declaredAiBody(),
      headers: { "Idempotency-Key": "has space" },
    });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("INVALID_IDEMPOTENCY_KEY");
  });
});

describe("malformed and oversized input", () => {
  async function setup() {
    const t = await createTenant();
    return { t, projectId: await createProject(t.key) };
  }

  it("rejects bodies over the cap with 413", async () => {
    const { t, projectId } = await setup();
    const huge = {
      ...declaredAiBody(),
      payload: { tool: "x".repeat(MAX_BODY_BYTES), purpose: "editing" },
    };
    const r = await api(`/projects/${projectId}/events`, { key: t.key, body: huge });
    expect(r.status).toBe(413);
    expect(r.json.code).toBe("BODY_TOO_LARGE");
  });

  it("rejects an event payload over the registry cap with 422 (under the body cap)", async () => {
    const { t, projectId } = await setup();
    const big = {
      ...declaredAiBody(),
      payload: { tool: "T", purpose: "editing", junk: "x".repeat(20_000) },
    };
    const r = await api(`/projects/${projectId}/events`, { key: t.key, body: big });
    expect(r.status).toBe(422);
    expect(r.json.issues[0].code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("rejects invalid JSON, unknown fields and wrong types with 400", async () => {
    const { t, projectId } = await setup();
    const bad = await api(`/projects/${projectId}/events`, { key: t.key, rawBody: '{"type": ' });
    expect(bad.status).toBe(400);
    expect(bad.json.code).toBe("INVALID_JSON");
    const extra = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: { ...declaredAiBody(), seq: 9 },
    });
    expect(extra.status).toBe(400);
    expect(extra.json.code).toBe("VALIDATION_ERROR");
    const wrong = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: { ...declaredAiBody(), type_version: "1" },
    });
    expect(wrong.status).toBe(400);
  });

  it("rejects registry violations with 422 and structured issues", async () => {
    const { t, projectId } = await setup();
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ ...declaredAiBody(), type: "ai.use_hidden" }, "UNKNOWN_EVENT_TYPE"],
      [{ ...declaredAiBody(), payload: { tool: "T", purpose: "vibes" } }, "PAYLOAD_INVALID"],
      [
        { ...declaredAiBody(), payload: { tool: "T", purpose: "editing", prompt: "write it" } },
        "PAYLOAD_INVALID",
      ],
      [
        { ...declaredAiBody(), payload: { tool: "Draft\u202Ev1", purpose: "editing" } },
        "PAYLOAD_INVALID",
      ],
      [{ ...declaredAiBody(), occurred_at: "yesterday" }, "ENVELOPE_INVALID"],
    ];
    for (const [body, issue] of cases) {
      const r = await api(`/projects/${projectId}/events`, { key: t.key, body });
      expect(r.status, issue).toBe(422);
      expect(r.json.code).toBe("EVENT_INVALID");
      expect(r.json.issues[0].code).toBe(issue);
    }
  });

  it("rejects types that have their own endpoint or need the signer", async () => {
    const { t, projectId } = await setup();
    for (const type of ["project.created", "artifact.registered", "evidence_pack.generated"]) {
      const r = await api(`/projects/${projectId}/events`, {
        key: t.key,
        body: { ...declaredAiBody(), type },
      });
      expect(r.status, type).toBe(400);
      expect(r.json.code).toBe("TYPE_NOT_ALLOWED");
    }
  });

  it("rejects an artifact payload that fails the registry, and stores nothing", async () => {
    const { t, projectId } = await setup();
    const r = await api(`/projects/${projectId}/artifacts`, {
      key: t.key,
      body: {
        kind: "novel",
        content_sha256: H("a"),
        byte_length: 1,
        media_type: "application/pdf",
        label: null,
        occurred_at: T0,
        actor: ACTOR,
      },
    });
    expect(r.status).toBe(422);
    const n = await env.PROV_DB.prepare("SELECT COUNT(*) AS n FROM artifacts WHERE project_id = ?")
      .bind(projectId)
      .first<{ n: number }>();
    expect(n!.n).toBe(0);
  });

  it("every error response has the {error, code, message} shape", async () => {
    const { t, projectId } = await setup();
    const responses = [
      await api(`/projects/${projectId}/events`, { key: t.key, rawBody: "nope" }),
      await api("/projects/prj_doesnotexist000000000000", { key: t.key }),
      await api("/no/such/route", { key: t.key }),
      await api(`/projects/${projectId}/events?after_seq=abc`, { key: t.key }),
      await api(`/projects/${projectId}`),
    ];
    for (const r of responses) {
      expect(r.status).toBeGreaterThanOrEqual(400);
      expectErrorShape(r.json);
    }
  });

  it("registers an artifact and accepts events that reference it", async () => {
    const { t, projectId } = await setup();
    const artifactId = await createArtifact(t.key, projectId);
    const cite = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: {
        type: "source.cited",
        type_version: 1,
        artifact_id: artifactId,
        payload: {
          citation_id: "cit_0000000001",
          identifier: { scheme: "doi", value: "10.1000/xyz" },
          locator: null,
        },
        occurred_at: T0,
        actor: ACTOR,
      },
    });
    expect(cite.status).toBe(201);
    expect(cite.json.event.artifact_id).toBe(artifactId);
  });
});
