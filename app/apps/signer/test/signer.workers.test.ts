import { createExecutionContext, SELF } from "cloudflare:test";
import { appendEvent, buildCheckpoint, verifyCheckpointSignature } from "@ozdna/provenance-core";
import {
  CHECKPOINT_SCHEMA,
  type EventDraft,
  type PublicKeyRecord,
  type StoredEvent,
} from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { Signer } from "../src/index.js";
import { createSigner, MAX_CLOCK_SKEW_MS } from "../src/signer.js";

const ACTOR = { kind: "person", id: "u1", asserted_by: "svc_academicplatform" } as const;
const H = (c: string) => c.repeat(64);

async function testKeyJwk(): Promise<string> {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.privateKey)) as JsonWebKey;
  return JSON.stringify(jwk);
}

function record(pub: { key_id: string; public_key: string }): PublicKeyRecord {
  return {
    key_id: pub.key_id,
    algorithm: "Ed25519",
    public_key: pub.public_key,
    status: "active",
    valid_from: "2020-01-01T00:00:00.000Z",
    valid_to: null,
    revoked_at: null,
  };
}

const base = (seq: number, type: string, payload: Record<string, unknown>): EventDraft =>
  ({
    event_id: `evt_${String(seq).padStart(12, "0")}`,
    project_id: "prj_0000000001",
    type,
    type_version: 1,
    occurred_at: "2026-10-07T10:00:00.000Z",
    recorded_at: new Date().toISOString(),
    actor: ACTOR,
    artifact_id: null,
    payload,
  }) as EventDraft;

async function smallChain(): Promise<StoredEvent[]> {
  const g = await appendEvent(null, base(0, "project.created", { external_ref: "x" }));
  const e1 = await appendEvent(g, base(1, "ai.use_declared", { tool: "T", purpose: "editing" }));
  return [g, e1];
}

describe("signer core", () => {
  it("signs a checkpoint that verifies with the public key alone", async () => {
    const signer = await createSigner(await testKeyJwk());
    const chain = await smallChain();
    const { body } = await buildCheckpoint(chain, new Date().toISOString());
    const { checkpoint, signature } = await signer.signCheckpoint(body);
    expect(checkpoint.body).toEqual(body);
    expect(
      await verifyCheckpointSignature(checkpoint, signature, record(signer.publicKey())),
    ).toEqual({
      valid: true,
      code: null,
    });
  });

  it("a tampered checkpoint fails verification", async () => {
    const signer = await createSigner(await testKeyJwk());
    const { body } = await buildCheckpoint(await smallChain(), new Date().toISOString());
    const { checkpoint, signature } = await signer.signCheckpoint(body);
    const forged = { ...checkpoint, body: { ...checkpoint.body, head_hash: H("a") } };
    expect(
      (await verifyCheckpointSignature(forged, signature, record(signer.publicKey()))).valid,
    ).toBe(false);
  });

  it("refuses anything that is not a checkpoint body or a signature-required event", async () => {
    const signer = await createSigner(await testKeyJwk());
    const now = new Date().toISOString();
    const goodBody = {
      schema: CHECKPOINT_SCHEMA,
      project_id: "prj_0000000001",
      head_seq: 0,
      head_hash: H("a"),
      event_count: 1,
      issued_at: now,
    };
    const refusals: Array<[unknown, string]> = [
      ["sign these bytes please", "NOT_A_CHECKPOINT"],
      [new Uint8Array(32), "NOT_A_CHECKPOINT"],
      [{ digest: H("a") }, "NOT_A_CHECKPOINT"],
      [{ ...goodBody, extra: 1 }, "NOT_A_CHECKPOINT"],
      [{ ...goodBody, event_count: 2 }, "NOT_A_CHECKPOINT"],
    ];
    for (const [input, code] of refusals) {
      await expect(signer.signCheckpoint(input)).rejects.toMatchObject({ code });
    }
    const [, ordinary] = await smallChain();
    await expect(signer.signEvent(ordinary)).rejects.toMatchObject({
      code: "SIGNATURE_NOT_ALLOWED",
    });
    await expect(signer.signEvent("bytes")).rejects.toMatchObject({ code: "NOT_AN_EVENT" });
  });

  it("refuses backdated or future-dated checkpoints", async () => {
    const signer = await createSigner(await testKeyJwk());
    const chain = await smallChain();
    for (const offset of [-(MAX_CLOCK_SKEW_MS + 60_000), MAX_CLOCK_SKEW_MS + 60_000]) {
      const issued = new Date(Date.now() + offset).toISOString();
      const body = {
        ...(await buildCheckpoint(chain, new Date().toISOString())).body,
        issued_at: issued,
      };
      await expect(signer.signCheckpoint(body)).rejects.toMatchObject({ code: "ISSUED_AT_SKEW" });
    }
  });

  it("signs signature-required events only when event_hash matches", async () => {
    const signer = await createSigner(await testKeyJwk());
    const chain = await smallChain();
    const pack = await appendEvent(
      chain.at(-1)!,
      base(2, "evidence_pack.generated", {
        pack_schema: "ozdna.provenance.pack/v1",
        pack_sha256: H("f"),
        checkpoint_seq: 1,
        checkpoint_digest: H("e"),
      }),
    );
    const { event_hash, signature } = await signer.signEvent(pack);
    expect(event_hash).toBe(pack.event_hash);
    expect(signature.key_id).toBe(signer.publicKey().key_id);
    await expect(signer.signEvent({ ...pack, event_hash: H("0") })).rejects.toMatchObject({
      code: "HASH_MISMATCH",
    });
  });

  it('accepts a JWK exported by Node (alg: "Ed25519") or tagged EdDSA, ignoring metadata', async () => {
    // workerd rejects alg "Ed25519" on import (it expects "EdDSA"), but Node 22 exports
    // Ed25519 JWKs with alg "Ed25519" — the format an operator is most likely to produce.
    const jwk = JSON.parse(await testKeyJwk()) as Record<string, unknown>;
    for (const alg of ["Ed25519", "EdDSA", undefined]) {
      const tagged = {
        kty: jwk.kty,
        crv: jwk.crv,
        d: jwk.d,
        x: jwk.x,
        ...(alg ? { alg } : {}),
        key_ops: ["sign"],
        ext: true,
      };
      const signer = await createSigner(JSON.stringify(tagged));
      expect(signer.publicKey().key_id).toMatch(/^ed25519-/);
    }
  });

  it("refuses to start without a valid Ed25519 private key", async () => {
    for (const bad of [
      undefined,
      "",
      "not json",
      JSON.stringify({ kty: "EC", crv: "P-256", d: "x", x: "y" }),
    ]) {
      await expect(createSigner(bad)).rejects.toMatchObject({ code: "SIGNER_NOT_CONFIGURED" });
    }
  });

  it("key_id is derived from the key, so two keys never share one", async () => {
    const a = await createSigner(await testKeyJwk());
    const b = await createSigner(await testKeyJwk());
    expect(a.publicKey().key_id).toMatch(/^ed25519-[0-9a-f]{32}$/);
    expect(a.publicKey().key_id).not.toBe(b.publicKey().key_id);
  });
});

describe("signer Worker", () => {
  it("serves nothing over HTTP", async () => {
    for (const path of ["/", "/sign", "/signCheckpoint", "/publicKey"]) {
      const res = await SELF.fetch(`http://signer${path}`, { method: "POST", body: "x" });
      expect(res.status).toBe(404);
    }
  });

  it("the RPC entrypoint exposes exactly publicKey/signCheckpoint/signEvent", async () => {
    const jwk = await testKeyJwk();
    const entry = new Signer(createExecutionContext(), { SIGNING_KEY_ED25519_JWK: jwk });
    const pub = await entry.publicKey();
    const { body } = await buildCheckpoint(await smallChain(), new Date().toISOString());
    const { checkpoint, signature } = await entry.signCheckpoint(body);
    expect((await verifyCheckpointSignature(checkpoint, signature, record(pub))).valid).toBe(true);
    const methods = Object.getOwnPropertyNames(Signer.prototype)
      .filter((m) => m !== "constructor")
      .sort();
    expect(methods).toEqual(["publicKey", "signCheckpoint", "signEvent"]);
  });
});
