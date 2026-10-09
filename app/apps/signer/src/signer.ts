// The signing core. It signs exactly two kinds of object, each as its domain-separated
// preimage, and refuses everything else — there is no "sign these bytes" operation (contrast
// image-API finding E-01).
//
//   checkpoint: Ed25519( "ozdna.provenance.checkpoint/v1\n" ‖ cjson(body) )
//   event:      Ed25519( "ozdna.provenance.event/v1\n" ‖ cjson(event − event_hash) ),
//               only for registry types marked signatureRequired, with a matching event_hash.
//
// The signer cannot see the chain, so it trusts the provenance API (its only caller) for the
// body's head; it does refuse checkpoints whose issued_at is far from its own clock, so a
// caller cannot obtain backdated or future-dated checkpoints.

import {
  checkpointPreimage,
  computeCheckpointDigest,
  computeEventHash,
  eventPreimage,
  fromBase64Url,
  keyIdFor,
  toBase64Url,
} from "@ozdna/provenance-core";
import {
  type Checkpoint,
  checkpointBodySchema,
  type DetachedSignature,
  validateStoredEvent,
} from "@ozdna/provenance-schema";

/** Max distance between a checkpoint's issued_at and the signer's clock. */
export const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

export class SignerRefusal extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "SignerRefusal";
  }
}

export interface SignerPublicKey {
  readonly key_id: string;
  readonly algorithm: "Ed25519";
  readonly public_key: string;
}

export interface SignerCore {
  publicKey(): SignerPublicKey;
  signCheckpoint(body: unknown): Promise<{ checkpoint: Checkpoint; signature: DetachedSignature }>;
  signEvent(event: unknown): Promise<{ event_hash: string; signature: DetachedSignature }>;
}

export async function createSigner(
  privateKeyJwkJson: string | undefined,
  now: () => number = Date.now,
): Promise<SignerCore> {
  if (!privateKeyJwkJson) throw new SignerRefusal("SIGNER_NOT_CONFIGURED", "no signing key");
  let jwk: JsonWebKey;
  try {
    jwk = JSON.parse(privateKeyJwkJson) as JsonWebKey;
  } catch {
    throw new SignerRefusal("SIGNER_NOT_CONFIGURED", "signing key is not JSON");
  }
  if (
    jwk.kty !== "OKP" ||
    jwk.crv !== "Ed25519" ||
    typeof jwk.d !== "string" ||
    typeof jwk.x !== "string"
  ) {
    throw new SignerRefusal("SIGNER_NOT_CONFIGURED", "signing key must be an Ed25519 private JWK");
  }
  // Import only the fields that define the key. Metadata differs between producers (Node 22
  // exports alg "Ed25519", which workerd rejects; others say "EdDSA") and must not matter.
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "OKP", crv: "Ed25519", d: jwk.d, x: jwk.x },
    { name: "Ed25519" },
    false,
    ["sign"],
  );
  const raw = fromBase64Url(jwk.x);
  const pub: SignerPublicKey = {
    key_id: await keyIdFor(raw),
    algorithm: "Ed25519",
    public_key: toBase64Url(raw),
  };

  const sign = async (message: Uint8Array): Promise<DetachedSignature> => ({
    alg: "Ed25519",
    key_id: pub.key_id,
    sig: toBase64Url(
      new Uint8Array(
        await crypto.subtle.sign(
          { name: "Ed25519" },
          privateKey,
          message as unknown as BufferSource,
        ),
      ),
    ),
  });

  return {
    publicKey: () => pub,

    async signCheckpoint(input) {
      const parsed = checkpointBodySchema.safeParse(input);
      if (!parsed.success)
        throw new SignerRefusal("NOT_A_CHECKPOINT", "body is not a checkpoint/v1 body");
      const body = parsed.data;
      if (Math.abs(Date.parse(body.issued_at) - now()) > MAX_CLOCK_SKEW_MS) {
        throw new SignerRefusal("ISSUED_AT_SKEW", "issued_at is too far from the signer clock");
      }
      return {
        checkpoint: { body, digest: await computeCheckpointDigest(body) },
        signature: await sign(checkpointPreimage(body)),
      };
    },

    async signEvent(input) {
      const v = validateStoredEvent(input);
      if (!v.ok) throw new SignerRefusal("NOT_AN_EVENT", "not a valid stored event");
      if (!v.def.signatureRequired) {
        throw new SignerRefusal(
          "SIGNATURE_NOT_ALLOWED",
          `${v.def.type} is not a signature-required type`,
        );
      }
      if ((await computeEventHash(v.event)) !== v.event.event_hash) {
        throw new SignerRefusal("HASH_MISMATCH", "event_hash does not match the event");
      }
      return { event_hash: v.event.event_hash, signature: await sign(eventPreimage(v.event)) };
    },
  };
}
