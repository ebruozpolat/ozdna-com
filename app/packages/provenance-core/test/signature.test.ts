import type { Checkpoint, PublicKeyRecord } from "@ozdna/provenance-schema";
import { describe, expect, it } from "vitest";
import { appendEvent } from "../src/chain.js";
import { buildCheckpoint } from "../src/checkpoint.js";
import { checkpointPreimage, computeCheckpointDigest, eventPreimage } from "../src/hash.js";
import {
  fromBase64Url,
  keyIdFor,
  toBase64Url,
  verifyCheckpointSignature,
  verifyEventSignature,
} from "../src/signature.js";
import { buildChain, clone, draft, fixedDrafts, H } from "./helpers.js";

const ISSUED = "2026-10-07T12:00:00.000Z";

/** A test-only key, generated per run — never a committed key. */
async function testKey(validFrom = "2026-01-01T00:00:00.000Z") {
  const kp = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const record: PublicKeyRecord = {
    key_id: await keyIdFor(raw),
    algorithm: "Ed25519",
    public_key: toBase64Url(raw),
    status: "active",
    valid_from: validFrom,
    valid_to: null,
    revoked_at: null,
  };
  const sign = async (msg: Uint8Array) => ({
    alg: "Ed25519" as const,
    key_id: record.key_id,
    sig: toBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          kp.privateKey,
          msg as unknown as BufferSource,
        ),
      ),
    ),
  });
  return { record, sign };
}

async function signedCheckpoint() {
  const chain = await buildChain(fixedDrafts());
  const checkpoint = await buildCheckpoint(chain, ISSUED);
  const key = await testKey();
  const signature = await key.sign(checkpointPreimage(checkpoint.body));
  return { chain, checkpoint, key, signature };
}

describe("base64url", () => {
  it("round-trips all lengths", () => {
    for (let n = 0; n < 70; n++) {
      const bytes = Uint8Array.from({ length: n }, (_, i) => (i * 37 + n) & 0xff);
      expect([...fromBase64Url(toBase64Url(bytes))]).toEqual([...bytes]);
    }
  });

  it("rejects padding, standard-alphabet characters and non-canonical trailing bits", () => {
    for (const bad of ["AAA=", "AA+A", "AA/A", "A", "AB"]) {
      expect(() => fromBase64Url(bad), bad).toThrow();
    }
  });
});

describe("keyIdFor", () => {
  it("is a stable fingerprint of the key bytes", async () => {
    const raw = new Uint8Array(32).fill(1);
    expect(await keyIdFor(raw)).toMatch(/^ed25519-[0-9a-f]{32}$/);
    expect(await keyIdFor(raw)).toBe(await keyIdFor(new Uint8Array(32).fill(1)));
    await expect(keyIdFor(new Uint8Array(31))).rejects.toThrow();
  });
});

describe("verifyCheckpointSignature", () => {
  it("verifies with the public key record alone", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    expect(await verifyCheckpointSignature(checkpoint, signature, key.record)).toEqual({
      valid: true,
      code: null,
    });
  });

  it("fails for a tampered checkpoint body (digest and signature)", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    const edited = clone(checkpoint) as Checkpoint;
    (edited.body as { head_seq: number; event_count: number }).head_seq = 3;
    (edited.body as { event_count: number }).event_count = 4;
    expect((await verifyCheckpointSignature(edited, signature, key.record)).code).toBe(
      "OBJECT_INVALID",
    );
    // Even with a recomputed digest, the signature no longer matches.
    edited.digest = await computeCheckpointDigest(edited.body);
    expect((await verifyCheckpointSignature(edited, signature, key.record)).code).toBe(
      "BAD_SIGNATURE",
    );
  });

  it("fails with another key, and a record cannot relabel another key's bytes", async () => {
    const { checkpoint, signature } = await signedCheckpoint();
    const other = await testKey();
    expect((await verifyCheckpointSignature(checkpoint, signature, other.record)).code).toBe(
      "KEY_MISMATCH",
    );
    const relabelled = { ...other.record, key_id: signature.key_id };
    expect((await verifyCheckpointSignature(checkpoint, signature, relabelled)).code).toBe(
      "KEY_MISMATCH",
    );
  });

  it("revoked key: every signature by it is distrusted", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    const revoked = {
      ...key.record,
      status: "revoked" as const,
      revoked_at: "2027-01-01T00:00:00.000Z",
    };
    expect((await verifyCheckpointSignature(checkpoint, signature, revoked)).code).toBe(
      "KEY_REVOKED",
    );
  });

  it("rotated (retired) key: checkpoints issued before valid_to stay valid, later ones do not", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    const retired = {
      ...key.record,
      status: "retired" as const,
      valid_to: "2026-12-31T00:00:00.000Z",
    };
    expect((await verifyCheckpointSignature(checkpoint, signature, retired)).valid).toBe(true);
    const retiredEarly = { ...retired, valid_to: "2026-10-01T00:00:00.000Z" };
    expect((await verifyCheckpointSignature(checkpoint, signature, retiredEarly)).code).toBe(
      "KEY_EXPIRED",
    );
  });

  it("a key cannot vouch for checkpoints issued before it existed", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    const late = { ...key.record, valid_from: "2027-01-01T00:00:00.000Z" };
    expect((await verifyCheckpointSignature(checkpoint, signature, late)).code).toBe(
      "KEY_NOT_YET_VALID",
    );
  });

  it("rejects malformed signatures and key records", async () => {
    const { checkpoint, key, signature } = await signedCheckpoint();
    for (const bad of [
      null,
      { ...signature, alg: "ES256" },
      { ...signature, sig: "x" },
      { ...signature, extra: 1 },
    ]) {
      expect((await verifyCheckpointSignature(checkpoint, bad, key.record)).code).toBe(
        "SIGNATURE_MALFORMED",
      );
    }
    expect(
      (await verifyCheckpointSignature(checkpoint, signature, { ...key.record, algorithm: "RSA" }))
        .code,
    ).toBe("KEY_MALFORMED");
  });

  it("a signature over the digest bytes instead of the preimage does not verify", async () => {
    const { checkpoint, key } = await signedCheckpoint();
    const wrong = await key.sign(new TextEncoder().encode(checkpoint.digest));
    expect((await verifyCheckpointSignature(checkpoint, wrong, key.record)).code).toBe(
      "BAD_SIGNATURE",
    );
  });
});

describe("verifyEventSignature", () => {
  it("verifies a signature-required event and refuses ordinary ones", async () => {
    const chain = await buildChain(fixedDrafts());
    const key = await testKey();
    const packEvent = await appendEvent(
      chain.at(-1)!,
      draft(
        "evidence_pack.generated",
        {
          pack_schema: "ozdna.provenance.pack/v1",
          pack_sha256: H("f"),
          checkpoint_seq: 4,
          checkpoint_digest: H("e"),
        },
        { artifact_id: null, recorded_at: "2026-10-07T13:00:00.000Z" },
      ),
    );
    const sig = await key.sign(eventPreimage(packEvent));
    expect(await verifyEventSignature(packEvent, sig, key.record)).toEqual({
      valid: true,
      code: null,
    });

    const tampered = { ...packEvent, payload: { ...packEvent.payload, pack_sha256: H("0") } };
    expect((await verifyEventSignature(tampered, sig, key.record)).code).toBe("OBJECT_INVALID");

    const ordinary = chain[1]!;
    const ordinarySig = await key.sign(eventPreimage(ordinary));
    expect((await verifyEventSignature(ordinary, ordinarySig, key.record)).code).toBe(
      "OBJECT_INVALID",
    );
  });
});
