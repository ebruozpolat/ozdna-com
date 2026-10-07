import { env } from "cloudflare:test";
import { verifyChain } from "@ozdna/provenance-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ACTOR, api, createTenant, H, T0 } from "./helpers.js";

const SECRET_LABEL = "Unpublished manuscript TOP-SECRET-7f3a";

/** Run SQL with the append-only triggers dropped — only ever in this test-only database. */
async function tamper(sql: string, ...binds: unknown[]) {
  await env.PROV_DB.batch([
    env.PROV_DB.prepare("DROP TRIGGER IF EXISTS events_no_update"),
    env.PROV_DB.prepare("DROP TRIGGER IF EXISTS events_no_delete"),
    env.PROV_DB.prepare(sql).bind(...binds),
    env.PROV_DB.prepare(
      "CREATE TRIGGER events_no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END",
    ),
    env.PROV_DB.prepare(
      "CREATE TRIGGER events_no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT, 'events are append-only'); END",
    ),
  ]);
}

/** tenant → project → artifact → cite → verification → declared AI use. Returns ids. */
async function buildProject() {
  const t = await createTenant();
  const project = await api("/projects", {
    key: t.key,
    body: { external_ref: "thesis-42", occurred_at: T0, actor: ACTOR },
  });
  expect(project.status).toBe(201);
  const projectId = project.json.project.id as string;

  const artifact = await api(`/projects/${projectId}/artifacts`, {
    key: t.key,
    body: {
      kind: "manuscript",
      content_sha256: H("a"),
      byte_length: 52_000,
      media_type: "application/pdf",
      label: SECRET_LABEL,
      occurred_at: T0,
      actor: ACTOR,
    },
  });
  expect(artifact.status).toBe(201);
  const artifactId = artifact.json.artifact.id as string;

  const bodies = [
    {
      type: "source.cited",
      type_version: 1,
      artifact_id: artifactId,
      payload: {
        citation_id: "cit_0000000001",
        identifier: { scheme: "doi", value: "10.1000/xyz123" },
        locator: "p. 4",
      },
    },
    {
      type: "source.verification_recorded",
      type_version: 1,
      artifact_id: artifactId,
      payload: {
        citation_id: "cit_0000000001",
        state: "VERIFIED",
        confidence_bp: 9500,
        components: { title_match: 10000, author_match: 9000 },
        provider: "crossref",
        provider_response_sha256: H("c"),
        candidates: [],
      },
    },
    {
      type: "ai.use_declared",
      type_version: 1,
      artifact_id: null,
      payload: { tool: "ExampleLLM", purpose: "editing" },
    },
  ];
  for (const b of bodies) {
    const r = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: { ...b, occurred_at: T0, actor: ACTOR },
    });
    expect(r.status, b.type).toBe(201);
  }
  return { t, projectId, artifactId };
}

afterEach(() => vi.restoreAllMocks());

describe("end to end: create tenant → project → artifact → events → GET chain → verify", () => {
  it("builds a valid chain the API and an offline verifier both accept", async () => {
    const { t, projectId, artifactId } = await buildProject();

    const list = await api(`/projects/${projectId}/events`, { key: t.key });
    expect(list.status).toBe(200);
    const events = list.json.events;
    expect(events.map((e: { type: string }) => e.type)).toEqual([
      "project.created",
      "artifact.registered",
      "source.cited",
      "source.verification_recorded",
      "ai.use_declared",
    ]);
    expect(events[1].artifact_id).toBe(artifactId);

    // Offline: the core library alone, on the JSON the API returned.
    expect(await verifyChain(events, { projectId })).toMatchObject({ valid: true, head_seq: 4 });

    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toEqual({
      project_id: projectId,
      valid: true,
      event_count: 5,
      verified_count: 5,
      head_seq: 4,
      head_hash: events[4].event_hash,
      first_bad_seq: null,
      error: null,
      signature_checked: false,
    });

    const page = await api(`/projects/${projectId}/events?after_seq=1&limit=2`, { key: t.key });
    expect(page.json.events.map((e: { seq: number }) => e.seq)).toEqual([2, 3]);
    expect(page.json.next_after_seq).toBe(3);
  });

  it("mutating a stored row makes /verify report invalid at the right seq", async () => {
    const { t, projectId } = await buildProject();
    const row = await env.PROV_DB.prepare(
      "SELECT canonical FROM events WHERE project_id = ? AND seq = 3",
    )
      .bind(projectId)
      .first<{ canonical: string }>();
    // Still canonical JSON, just a different (retracted) verification outcome.
    const forged = row!.canonical.replace('"state":"VERIFIED"', '"state":"RETRACTED"');
    expect(forged).not.toBe(row!.canonical);
    await tamper(
      "UPDATE events SET canonical = ? WHERE project_id = ? AND seq = 3",
      forged,
      projectId,
    );

    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({
      valid: false,
      first_bad_seq: 3,
      verified_count: 3,
      error: { code: "HASH_MISMATCH" },
    });
  });

  it("deleting a stored row is reported where the gap starts", async () => {
    const { t, projectId } = await buildProject();
    await tamper("DELETE FROM events WHERE project_id = ? AND seq = 1", projectId);
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({
      valid: false,
      first_bad_seq: 1,
      error: { code: "SEQ_MISMATCH" },
    });
  });

  it("a stored row that is no longer canonical JSON is reported", async () => {
    const { t, projectId } = await buildProject();
    const row = await env.PROV_DB.prepare(
      "SELECT canonical FROM events WHERE project_id = ? AND seq = 2",
    )
      .bind(projectId)
      .first<{ canonical: string }>();
    await tamper(
      "UPDATE events SET canonical = ? WHERE project_id = ? AND seq = 2",
      ` ${row!.canonical}`,
      projectId,
    );
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({
      valid: false,
      first_bad_seq: 2,
      error: { code: "NOT_CANONICAL" },
    });
    // Appending on top of a corrupt chain is refused only if the HEAD is corrupt; here it is not.
  });

  it("refuses to append on top of a corrupted head", async () => {
    const { t, projectId } = await buildProject();
    const row = await env.PROV_DB.prepare(
      "SELECT canonical FROM events WHERE project_id = ? AND seq = 4",
    )
      .bind(projectId)
      .first<{ canonical: string }>();
    await tamper(
      "UPDATE events SET canonical = ? WHERE project_id = ? AND seq = 4",
      row!.canonical.replace("ExampleLLM", "OtherLLM"),
      projectId,
    );
    const r = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: {
        type: "ai.use_declared",
        type_version: 1,
        artifact_id: null,
        payload: { tool: "T", purpose: "code" },
        occurred_at: T0,
        actor: ACTOR,
      },
    });
    expect(r.status).toBe(409);
    expect(r.json.code).toBe("CHAIN_CORRUPT");
  });

  it("does not trust denormalised columns: editing event_hash/type columns changes nothing", async () => {
    const { t, projectId } = await buildProject();
    await tamper(
      "UPDATE events SET event_hash = ?, type = 'x.y' WHERE project_id = ? AND seq = 2",
      H("0"),
      projectId,
    );
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json.valid).toBe(true);
  });

  it("never logs payload contents or keys", async () => {
    const seen: string[] = [];
    for (const m of ["log", "info", "warn", "error", "debug"] as const) {
      vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
        seen.push(args.map(String).join(" "));
      });
    }
    const { t, projectId } = await buildProject();
    await api(`/projects/${projectId}/events`, {
      key: t.key,
      rawBody: `{"payload":"${SECRET_LABEL}`,
    });
    const all = seen.join("\n");
    expect(all).not.toContain("TOP-SECRET-7f3a");
    expect(all).not.toContain(t.key);
  });
});

describe("OpenAPI", () => {
  it("is generated from the zod schemas and covers every route", async () => {
    const r = await api("/openapi.json");
    expect(r.status).toBe(200);
    expect(r.json.openapi).toBe("3.1.0");
    expect(Object.keys(r.json.paths).sort()).toEqual([
      "/admin/tenants",
      "/projects",
      "/projects/{id}",
      "/projects/{id}/artifacts",
      "/projects/{id}/events",
      "/projects/{id}/verify",
    ]);
    const schemas = r.json.components.schemas;
    for (const id of [
      "Error",
      "ActorInput",
      "CreateProject",
      "CreateArtifact",
      "AppendEvent",
      "StoredEvent",
      "VerifyResult",
    ]) {
      expect(schemas[id], id).toBeDefined();
    }
    expect(schemas.AppendEvent.additionalProperties).toBe(false);
    expect(schemas.Error.required).toEqual(["error", "code", "message"]);
  });
});
