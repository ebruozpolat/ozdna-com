import { env, SELF } from "cloudflare:test";
import {
  fromBase64Url,
  verifyAgainstCheckpoint,
  verifyCheckpointSignature,
} from "@ozdna/provenance-core";
import { canonicalize } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { ADMIN, api, createProject, createTenant, declaredAiBody } from "./helpers.js";

async function ensureActiveKey() {
  const r = await api("/admin/keys/rotate", { headers: { "X-Admin-Token": ADMIN }, body: {} });
  expect([200, 201]).toContain(r.status);
  return r.json.key;
}

async function publicKey(keyId: string) {
  const res = await SELF.fetch(`http://local/v1/keys/${keyId}`);
  return { status: res.status, json: (await res.json()) as any };
}

async function projectWithEvents(n = 2) {
  const t = await createTenant();
  const projectId = await createProject(t.key);
  for (let i = 0; i < n; i++) {
    expect(
      (await api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody(`T${i}`) }))
        .status,
    ).toBe(201);
  }
  return { t, projectId };
}

describe("key registry", () => {
  it("rotate registers the signer's key (admin only) and GET /v1/keys/{key_id} serves it publicly", async () => {
    const denied = await api("/admin/keys/rotate", {
      headers: { "X-Admin-Token": "nope" },
      body: {},
    });
    expect(denied.status).toBe(401);

    const key = await ensureActiveKey();
    expect(key).toMatchObject({
      algorithm: "Ed25519",
      status: "active",
      valid_to: null,
      revoked_at: null,
    });
    const again = await api("/admin/keys/rotate", {
      headers: { "X-Admin-Token": ADMIN },
      body: {},
    });
    expect(again.status).toBe(200);
    expect(again.json.rotated).toBe(false);

    const pub = await publicKey(key.key_id);
    expect(pub.status).toBe(200);
    expect(pub.json.key).toEqual(key);
    expect((await publicKey("ed25519-00000000000000000000000000000000")).status).toBe(404);
    expect((await publicKey("../../etc")).status).toBe(404);
  });
});

describe("signed checkpoints", () => {
  it("signature verifies with the public key alone (raw WebCrypto, no ozDNA code)", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents();
    const r = await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    expect(r.status).toBe(201);
    const { checkpoint, signature } = r.json;
    expect(checkpoint.body).toMatchObject({ project_id: projectId, head_seq: 2, event_count: 3 });

    const { json } = await publicKey(signature.key_id);
    const pk = await crypto.subtle.importKey(
      "raw",
      fromBase64Url(json.key.public_key),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    const message = new TextEncoder().encode(
      `ozdna.provenance.checkpoint/v1\n${canonicalize(checkpoint.body)}`,
    );
    expect(
      await crypto.subtle.verify({ name: "Ed25519" }, pk, fromBase64Url(signature.sig), message),
    ).toBe(true);

    // and through the library, against the published record
    expect(await verifyCheckpointSignature(checkpoint, signature, json.key)).toEqual({
      valid: true,
      code: null,
    });
  });

  it("the stored events verify against the signed checkpoint", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents();
    const cp = await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    const events = (await api(`/projects/${projectId}/events`, { key: t.key })).json.events;
    expect(await verifyAgainstCheckpoint(events, cp.json.checkpoint)).toMatchObject({
      valid: true,
      covered_count: 3,
    });
  });

  it("a tampered checkpoint fails verification", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents();
    const { checkpoint, signature } = (
      await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} })
    ).json;
    const key = (await publicKey(signature.key_id)).json.key;
    const forgedBody = { ...checkpoint.body, issued_at: "2030-01-01T00:00:00.000Z" };
    const tampered = { body: forgedBody, digest: checkpoint.digest };
    expect((await verifyCheckpointSignature(tampered, signature, key)).valid).toBe(false);
    const flipped = {
      ...signature,
      sig: `${signature.sig[0] === "A" ? "B" : "A"}${signature.sig.slice(1)}`,
    };
    expect((await verifyCheckpointSignature(checkpoint, flipped, key)).valid).toBe(false);
  });

  it("latest returns the newest; re-checkpointing an unchanged head returns the same checkpoint", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents(1);
    expect((await api(`/projects/${projectId}/checkpoints/latest`, { key: t.key })).json.code).toBe(
      "NO_CHECKPOINT",
    );
    const first = await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    const same = await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    expect(same.status).toBe(200);
    expect(same.json.checkpoint.digest).toBe(first.json.checkpoint.digest);

    await api(`/projects/${projectId}/events`, { key: t.key, body: declaredAiBody("later") });
    const second = await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    expect(second.status).toBe(201);
    expect(second.json.checkpoint.body.head_seq).toBe(2);
    const latest = await api(`/projects/${projectId}/checkpoints/latest`, { key: t.key });
    expect(latest.json.checkpoint).toEqual(second.json.checkpoint);
    expect(latest.json.signature).toEqual(second.json.signature);
  });

  it("needs the checkpoints:write scope and is tenant-scoped", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents(1);
    const reader = await createTenant(["events:read"]);
    const r = await api(`/projects/${projectId}/checkpoints`, { key: reader.key, body: {} });
    expect(r.status).toBe(403);
    const other = await createTenant();
    expect(
      (await api(`/projects/${projectId}/checkpoints`, { key: other.key, body: {} })).status,
    ).toBe(404);
    await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    expect(
      (await api(`/projects/${projectId}/checkpoints/latest`, { key: other.key })).status,
    ).toBe(404);
  });

  it("checkpoint rows are append-only", async () => {
    await ensureActiveKey();
    const { t, projectId } = await projectWithEvents(1);
    await api(`/projects/${projectId}/checkpoints`, { key: t.key, body: {} });
    await expect(
      env.PROV_DB.prepare("UPDATE checkpoints SET signature = 'x' WHERE project_id = ?")
        .bind(projectId)
        .run(),
    ).rejects.toThrow("append-only");
    await expect(
      env.PROV_DB.prepare("DELETE FROM checkpoints WHERE project_id = ?").bind(projectId).run(),
    ).rejects.toThrow("append-only");
  });
});

describe("the signer behind the service binding", () => {
  it("refuses payloads other than checkpoint bodies", async () => {
    for (const payload of ["sign these bytes", { digest: "00" }, [1, 2, 3], null]) {
      // RPC promises must be settled directly; expect().rejects observes them too late.
      const outcome = await env.SIGNER!.signCheckpoint(payload).then(
        () => "signed",
        (e: unknown) => String(e),
      );
      expect(outcome).toMatch(/NOT_A_CHECKPOINT/);
    }
  });

  it("has no HTTP surface the API could proxy", async () => {
    const r = await api("/sign", { body: { bytes: "AAAA" } });
    expect(r.status).toBe(404);
  });
});
