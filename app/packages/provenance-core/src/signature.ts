// Ed25519 signature checks for checkpoints and signature-required events (Phase 3).
// Normative: provenance-event-v1.md §8. Pure apart from Web Crypto: no clock — the key's
// validity window is judged against the signed object's own timestamp (issued_at /
// recorded_at), never against "now".

import {
  type Checkpoint,
  checkpointSchema,
  type DetachedSignature,
  type PublicKeyRecord,
  publicKeyRecordSchema,
  REGISTRY_V1,
  type StoredEvent,
  signatureSchema,
  validateStoredEvent,
} from "@ozdna/provenance-schema";
import {
  checkpointPreimage,
  computeCheckpointDigest,
  computeEventHash,
  eventPreimage,
  sha256Hex,
} from "./hash.js";

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Unpadded base64url. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out += B64URL[n >> 18]! + B64URL[(n >> 12) & 63]! + B64URL[(n >> 6) & 63]! + B64URL[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i]! << 16;
    out += B64URL[n >> 18]! + B64URL[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out += B64URL[n >> 18]! + B64URL[(n >> 12) & 63]! + B64URL[(n >> 6) & 63]!;
  }
  return out;
}

/** Strict unpadded base64url decode; throws on any other character or a bad length. */
export function fromBase64Url(s: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(s) || s.length % 4 === 1) throw new Error("invalid base64url");
  const out = new Uint8Array(Math.floor((s.length * 3) / 4));
  let bits = 0;
  let acc = 0;
  let o = 0;
  for (const ch of s) {
    acc = (acc << 6) | B64URL.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  // Reject non-canonical encodings (leftover bits must be zero), so one signature has one text.
  if ((acc & ((1 << bits) - 1)) !== 0) throw new Error("non-canonical base64url");
  return out;
}

/** key_id for a raw 32-byte Ed25519 public key: "ed25519-" + first 32 hex of its SHA-256. */
export async function keyIdFor(rawPublicKey: Uint8Array): Promise<string> {
  if (rawPublicKey.length !== 32) throw new Error("Ed25519 public key must be 32 bytes");
  return `ed25519-${(await sha256Hex(rawPublicKey)).slice(0, 32)}`;
}

export type SignatureErrorCode =
  | "SIGNATURE_MALFORMED"
  | "KEY_MALFORMED"
  | "KEY_MISMATCH"
  | "KEY_REVOKED"
  | "KEY_NOT_YET_VALID"
  | "KEY_EXPIRED"
  | "OBJECT_INVALID"
  | "BAD_SIGNATURE";

export interface SignatureCheck {
  readonly valid: boolean;
  readonly code: SignatureErrorCode | null;
}

const ok: SignatureCheck = { valid: true, code: null };
const fail = (code: SignatureErrorCode): SignatureCheck => ({ valid: false, code });

async function checkKeyAndSignature(
  signature: unknown,
  key: unknown,
  signedAt: string,
  message: Uint8Array,
): Promise<SignatureCheck> {
  const sig = signatureSchema.safeParse(signature);
  if (!sig.success) return fail("SIGNATURE_MALFORMED");
  const rec = publicKeyRecordSchema.safeParse(key);
  if (!rec.success) return fail("KEY_MALFORMED");
  const k: PublicKeyRecord = rec.data;
  const s: DetachedSignature = sig.data;

  let raw: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    raw = fromBase64Url(k.public_key);
    sigBytes = fromBase64Url(s.sig);
  } catch {
    return fail("SIGNATURE_MALFORMED");
  }
  if (raw.length !== 32 || sigBytes.length !== 64) return fail("SIGNATURE_MALFORMED");
  // The key record must be the key the signature names, and the key_id must be the
  // fingerprint of the key bytes (a registry row cannot relabel another key).
  if (s.key_id !== k.key_id || (await keyIdFor(raw)) !== k.key_id) return fail("KEY_MISMATCH");

  if (k.status === "revoked" || k.revoked_at !== null) return fail("KEY_REVOKED");
  if (signedAt < k.valid_from) return fail("KEY_NOT_YET_VALID");
  if (k.valid_to !== null && signedAt > k.valid_to) return fail("KEY_EXPIRED");

  const publicKey = await crypto.subtle.importKey(
    "raw",
    raw as unknown as BufferSource,
    { name: "Ed25519" },
    false,
    ["verify"],
  );
  const good = await crypto.subtle.verify(
    { name: "Ed25519" },
    publicKey,
    sigBytes as unknown as BufferSource,
    message as unknown as BufferSource,
  );
  return good ? ok : fail("BAD_SIGNATURE");
}

/**
 * Verify a checkpoint's signature with a public-key record alone. Checks the digest, that the
 * key is the one named and not revoked, that body.issued_at lies inside the key's validity
 * window, and the Ed25519 signature over the checkpoint preimage.
 */
export async function verifyCheckpointSignature(
  checkpoint: unknown,
  signature: unknown,
  key: unknown,
): Promise<SignatureCheck> {
  const cp = checkpointSchema.safeParse(checkpoint);
  if (!cp.success) return fail("OBJECT_INVALID");
  const c: Checkpoint = cp.data;
  if ((await computeCheckpointDigest(c.body)) !== c.digest) return fail("OBJECT_INVALID");
  return checkKeyAndSignature(signature, key, c.body.issued_at, checkpointPreimage(c.body));
}

/** Verify the signature on a signature-required event (e.g. evidence_pack.generated). */
export async function verifyEventSignature(
  event: unknown,
  signature: unknown,
  key: unknown,
): Promise<SignatureCheck> {
  const v = validateStoredEvent(event);
  if (!v.ok || !v.def.signatureRequired) return fail("OBJECT_INVALID");
  const e: StoredEvent = v.event;
  if ((await computeEventHash(e)) !== e.event_hash) return fail("OBJECT_INVALID");
  return checkKeyAndSignature(signature, key, e.recorded_at, eventPreimage(e));
}

/** True if the registry marks this (type, version) as signature-required. */
export function isSignatureRequired(type: string, version: number): boolean {
  return REGISTRY_V1.get(type, version)?.signatureRequired === true;
}
