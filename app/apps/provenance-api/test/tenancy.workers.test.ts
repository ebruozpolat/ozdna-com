import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import {
  ACTOR,
  ADMIN,
  api,
  createArtifact,
  createProject,
  createTenant,
  declaredAiBody,
  expectErrorShape,
  H,
  T0,
} from "./helpers.js";

async function eventCount(projectId: string): Promise<number> {
  const r = await env.PROV_DB.prepare("SELECT COUNT(*) AS n FROM events WHERE project_id = ?")
    .bind(projectId)
    .first<{ n: number }>();
  return r!.n;
}

describe("cross-tenant isolation", () => {
  it("tenant B can never read, write or list tenant A's data", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const projectA = await createProject(a.key);
    const artifactA = await createArtifact(a.key, projectA);
    const before = await eventCount(projectA);

    // read
    for (const path of [
      `/projects/${projectA}`,
      `/projects/${projectA}/events`,
      `/projects/${projectA}/verify`,
    ]) {
      const r = await api(path, { key: b.key });
      expect(r.status, path).toBe(404);
      expectErrorShape(r.json);
      expect(r.json.code).toBe("PROJECT_NOT_FOUND");
    }

    // list
    const listB = await api("/projects", { key: b.key });
    expect(listB.status).toBe(200);
    expect(listB.json.projects.map((p: { id: string }) => p.id)).not.toContain(projectA);
    const listA = await api("/projects", { key: a.key });
    expect(listA.json.projects.map((p: { id: string }) => p.id)).toContain(projectA);

    // write
    const append = await api(`/projects/${projectA}/events`, {
      key: b.key,
      body: declaredAiBody(),
    });
    expect(append.status).toBe(404);
    const art = await api(`/projects/${projectA}/artifacts`, {
      key: b.key,
      body: {
        kind: "dataset",
        content_sha256: H("b"),
        byte_length: 1,
        media_type: "text/csv",
        label: null,
        occurred_at: T0,
        actor: ACTOR,
      },
    });
    expect(art.status).toBe(404);

    // B cannot reference A's artifact from B's own project either
    const projectB = await createProject(b.key);
    const cross = await api(`/projects/${projectB}/events`, {
      key: b.key,
      body: { ...declaredAiBody(), artifact_id: artifactA },
    });
    expect(cross.status).toBe(422);
    expect(cross.json.code).toBe("ARTIFACT_NOT_FOUND");

    // nothing of A's changed
    expect(await eventCount(projectA)).toBe(before);
    const verifyA = await api(`/projects/${projectA}/verify`, { key: a.key });
    expect(verifyA.json.valid).toBe(true);
  });

  it("the same external_ref in two tenants are two different projects", async () => {
    const a = await createTenant();
    const b = await createTenant();
    const pa = await createProject(a.key, "shared-ref");
    const pb = await createProject(b.key, "shared-ref");
    expect(pa).not.toBe(pb);
    const dup = await api("/projects", {
      key: a.key,
      body: { external_ref: "shared-ref", occurred_at: T0, actor: ACTOR },
    });
    expect(dup.status).toBe(409);
    expect(dup.json.code).toBe("PROJECT_EXISTS");
  });
});

describe("service-key auth and scopes", () => {
  it("rejects missing, malformed, unknown and revoked keys", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    for (const key of [undefined, "nope", `ozp_${"x".repeat(40)}`]) {
      const r = await api(`/projects/${projectId}`, key ? { key } : {});
      expect(r.status).toBe(401);
      expectErrorShape(r.json);
    }
    await env.PROV_DB.prepare(
      "UPDATE service_keys SET revoked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?",
    )
      .bind(t.keyId)
      .run();
    const revoked = await api(`/projects/${projectId}`, { key: t.key });
    expect(revoked.status).toBe(401);
    expect(revoked.json.code).toBe("REVOKED_SERVICE_KEY");
  });

  it("enforces scopes per endpoint", async () => {
    const writer = await createTenant();
    const projectId = await createProject(writer.key);
    const reader = await createTenant(["events:read"]);
    const r = await api("/projects", {
      key: reader.key,
      body: { external_ref: "x", occurred_at: T0, actor: ACTOR },
    });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe("INSUFFICIENT_SCOPE");

    const appendOnly = await createTenant(["events:append"]);
    const read = await api("/projects", { key: appendOnly.key });
    expect(read.status).toBe(403);
    // and a scoped key still only sees its own tenant
    const other = await api(`/projects/${projectId}/events`, {
      key: appendOnly.key,
      body: declaredAiBody(),
    });
    expect(other.status).toBe(404);
  });

  it("asserted_by always comes from the key; callers cannot set it", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    const ok = await api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody() });
    expect(ok.status).toBe(201);
    expect(ok.json.event.actor).toEqual({ ...ACTOR, asserted_by: t.serviceId });

    const spoof = await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: { ...declaredAiBody(), actor: { ...ACTOR, asserted_by: "svc_someoneelse0000" } },
    });
    expect(spoof.status).toBe(400);
    expect(spoof.json.code).toBe("VALIDATION_ERROR");
  });

  it("admin bootstrap needs the admin token", async () => {
    for (const token of [undefined, "wrong", `${ADMIN}x`]) {
      const r = await api("/admin/tenants", {
        ...(token ? { headers: { "X-Admin-Token": token } } : {}),
        body: { name: "t" },
      });
      expect(r.status).toBe(401);
      expect(r.json.code).toBe("INVALID_ADMIN_TOKEN");
    }
  });

  it("stores only the key hash", async () => {
    const t = await createTenant();
    const row = await env.PROV_DB.prepare(
      "SELECT key_hash, key_prefix FROM service_keys WHERE id = ?",
    )
      .bind(t.keyId)
      .first<{ key_hash: string; key_prefix: string }>();
    expect(row!.key_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row!.key_hash).not.toContain(t.key);
    expect(t.key.startsWith(row!.key_prefix)).toBe(true);
  });
});

describe("append-only storage", () => {
  it("direct UPDATE and DELETE on event tables abort", async () => {
    const t = await createTenant();
    const projectId = await createProject(t.key);
    await createArtifact(t.key, projectId);
    await api(`/projects/${projectId}/events`, {
      key: t.key,
      body: declaredAiBody(),
      headers: { "Idempotency-Key": "k1" },
    });

    const attempts: Array<[string, string]> = [
      ["UPDATE events SET canonical = 'x' WHERE project_id = ?", "append-only"],
      ["DELETE FROM events WHERE project_id = ?", "append-only"],
      ["UPDATE artifacts SET kind = 'figure' WHERE project_id = ?", "append-only"],
      ["DELETE FROM artifacts WHERE project_id = ?", "append-only"],
      ["UPDATE idempotency_keys SET seq = 0 WHERE project_id = ?", "append-only"],
      ["DELETE FROM idempotency_keys WHERE project_id = ?", "append-only"],
      ["UPDATE projects SET external_ref = 'x' WHERE id = ?", "immutable"],
      ["DELETE FROM projects WHERE id = ?", "immutable"],
    ];
    for (const [sql, msg] of attempts) {
      await expect(env.PROV_DB.prepare(sql).bind(projectId).run(), sql).rejects.toThrow(msg);
    }
    const verify = await api(`/projects/${projectId}/verify`, { key: t.key });
    expect(verify.json).toMatchObject({ valid: true, event_count: 3 });
  });
});
