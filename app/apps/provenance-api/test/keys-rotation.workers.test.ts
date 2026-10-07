import { env } from "cloudflare:test";
import { verifyAgainstCheckpoint, verifyCheckpointSignature } from "@ozdna/provenance-core";
import { describe, expect, it } from "vitest";
import { createSigner } from "../../signer/src/signer.js";
import type { Env, SignerRpc } from "../src/env.js";
import app from "../src/index.js";
import { ACTOR, ADMIN, createProject, createTenant, declaredAiBody, T0 } from "./helpers.js";

// Rotation is simulated by pointing the API at a second signer (a fresh, test-only key) —
// exactly what happens in production when the signer's secret is replaced.

async function freshSigner(): Promise<SignerRpc> {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const core = await createSigner(
    JSON.stringify(await crypto.subtle.exportKey("jwk", kp.privateKey)),
  );
  return {
    publicKey: async () => core.publicKey(),
    signCheckpoint: (body) => core.signCheckpoint(body),
  };
}

async function call(
  signer: SignerRpc | undefined,
  path: string,
  init: { key?: string; admin?: boolean; body?: unknown } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.key) headers.Authorization = `Bearer ${init.key}`;
  if (init.admin) headers["X-Admin-Token"] = ADMIN;
  const res = await app.fetch(
    new Request(`http://local${path}`, {
      method: init.body !== undefined ? "POST" : "GET",
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    }),
    { ...(env as unknown as Env), SIGNER: signer } as Env,
  );
  return { status: res.status, json: (await res.json()) as any };
}

const rotate = (signer: SignerRpc) =>
  call(signer, "/v1/provenance/admin/keys/rotate", { admin: true, body: {} });
const keyRecord = async (keyId: string) => (await call(undefined, `/v1/keys/${keyId}`)).json.key;

async function appendOne(tenantKey: string, projectId: string, tool: string) {
  const r = await call(undefined, `/v1/provenance/projects/${projectId}/events`, {
    key: tenantKey,
    body: { ...declaredAiBody(tool), occurred_at: T0, actor: ACTOR },
  });
  expect(r.status).toBe(201);
}

describe("rotation", () => {
  it("old checkpoints stay valid after rotation; new ones use the new key", async () => {
    const signerA = await freshSigner();
    const signerB = await freshSigner();
    const t = await createTenant();
    const projectId = await createProject(t.key);

    expect((await rotate(signerA)).status).toBe(201);
    const cpA = await call(signerA, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    expect(cpA.status).toBe(201);
    const keyA = cpA.json.signature.key_id;

    const rotated = await rotate(signerB);
    expect(rotated.status).toBe(201);
    const keyB = rotated.json.key.key_id;
    expect(keyB).not.toBe(keyA);

    const recA = await keyRecord(keyA);
    expect(recA).toMatchObject({ status: "retired", revoked_at: null });
    expect(recA.valid_to).not.toBeNull();
    // The old checkpoint still verifies against the (now retired) key record.
    expect(await verifyCheckpointSignature(cpA.json.checkpoint, cpA.json.signature, recA)).toEqual({
      valid: true,
      code: null,
    });

    // The old signer can no longer produce checkpoints; the new one can.
    await appendOne(t.key, projectId, "after-rotation");
    const stale = await call(signerA, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    expect(stale.status).toBe(503);
    expect(stale.json.code).toBe("KEY_NOT_REGISTERED");
    const cpB = await call(signerB, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    expect(cpB.status).toBe(201);
    expect(cpB.json.signature.key_id).toBe(keyB);
    expect(
      await verifyCheckpointSignature(
        cpB.json.checkpoint,
        cpB.json.signature,
        await keyRecord(keyB),
      ),
    ).toMatchObject({
      valid: true,
    });

    // A retired key cannot be made active again.
    const back = await rotate(signerA);
    expect(back.status).toBe(409);
    expect(back.json.code).toBe("KEY_NOT_REUSABLE");
  });
});

describe("revocation", () => {
  it("a revoked key's checkpoints stop verifying, and new checkpoints need a new key", async () => {
    const signer = await freshSigner();
    const t = await createTenant();
    const projectId = await createProject(t.key);
    await rotate(signer);
    const cp = await call(signer, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    const keyId = cp.json.signature.key_id;

    const denied = await call(undefined, `/v1/provenance/admin/keys/${keyId}/revoke`, { body: {} });
    expect(denied.status).toBe(401);
    const revoked = await call(undefined, `/v1/provenance/admin/keys/${keyId}/revoke`, {
      admin: true,
      body: {},
    });
    expect(revoked.status).toBe(200);
    expect(revoked.json.key).toMatchObject({ status: "revoked" });

    const rec = await keyRecord(keyId);
    expect(await verifyCheckpointSignature(cp.json.checkpoint, cp.json.signature, rec)).toEqual({
      valid: false,
      code: "KEY_REVOKED",
    });
    // The chain itself is still intact — only the attestation is withdrawn.
    const events = (
      await call(undefined, `/v1/provenance/projects/${projectId}/events`, { key: t.key })
    ).json.events;
    expect((await verifyAgainstCheckpoint(events, cp.json.checkpoint)).valid).toBe(true);

    await appendOne(t.key, projectId, "after-revocation");
    const none = await call(signer, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    expect(none.status).toBe(503);
    expect(none.json.code).toBe("NO_ACTIVE_KEY");

    const fresh = await freshSigner();
    expect((await rotate(fresh)).status).toBe(201);
    const recovered = await call(fresh, `/v1/provenance/projects/${projectId}/checkpoints`, {
      key: t.key,
      body: {},
    });
    expect(recovered.status).toBe(201);
  });
});

describe("key registry invariants (database triggers)", () => {
  it("rejects deletes, identity changes and backwards status transitions", async () => {
    const signer = await freshSigner();
    await rotate(signer);
    const { key_id } = await signer.publicKey();
    const tries: Array<[string, string]> = [
      ["DELETE FROM signing_keys WHERE key_id = ?", "never deleted"],
      ["UPDATE signing_keys SET public_key = 'x' WHERE key_id = ?", "immutable"],
      [
        "UPDATE signing_keys SET valid_from = '2000-01-01T00:00:00.000Z' WHERE key_id = ?",
        "immutable",
      ],
    ];
    for (const [sql, msg] of tries) {
      await expect(env.PROV_DB.prepare(sql).bind(key_id).run(), sql).rejects.toThrow(msg);
    }
    await call(undefined, `/v1/provenance/admin/keys/${key_id}/revoke`, { admin: true, body: {} });
    // Un-revoking is rejected (by the transition rule), and so is any other edit of a revoked key.
    await expect(
      env.PROV_DB.prepare(
        "UPDATE signing_keys SET status = 'active', revoked_at = NULL WHERE key_id = ?",
      )
        .bind(key_id)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.PROV_DB.prepare(
        "UPDATE signing_keys SET valid_to = '2099-01-01T00:00:00.000Z' WHERE key_id = ?",
      )
        .bind(key_id)
        .run(),
    ).rejects.toThrow("revoked key is final");
  });

  it("retired keys cannot be reactivated, and there is never more than one active key", async () => {
    const a = await freshSigner();
    const b = await freshSigner();
    await rotate(a);
    await rotate(b);
    const idA = (await a.publicKey()).key_id;
    await expect(
      env.PROV_DB.prepare("UPDATE signing_keys SET status = 'active' WHERE key_id = ?")
        .bind(idA)
        .run(),
    ).rejects.toThrow();
    const n = await env.PROV_DB.prepare(
      "SELECT COUNT(*) AS n FROM signing_keys WHERE status = 'active'",
    ).first<{ n: number }>();
    expect(n!.n).toBe(1);
  });

  it("rejects a signer that reports a key_id not matching its key bytes", async () => {
    const real = await freshSigner();
    const liar: SignerRpc = {
      ...real,
      publicKey: async () => ({
        ...(await real.publicKey()),
        key_id: "ed25519-00000000000000000000000000000000",
      }),
    };
    const r = await rotate(liar);
    expect(r.status).toBe(502);
    expect(r.json.code).toBe("SIGNER_KEY_INVALID");
  });
});
