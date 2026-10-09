// Detached signatures and public-key records (Phase 3). Normative: provenance-event-v1.md §8.
//
// What is signed is never a caller-chosen byte string: it is the domain-separated preimage of
// a checkpoint ("ozdna.provenance.checkpoint/v1\n" ‖ cjson(body)) or of a signature-required
// event ("ozdna.provenance.event/v1\n" ‖ cjson(event − event_hash)).

import { z } from "zod";
import { isoUtcMs } from "./primitives.js";

export const SIGNATURE_ALG = "Ed25519" as const;

const base64url = (bytes: number) =>
  z
    .string()
    .length(Math.ceil((bytes * 4) / 3))
    .regex(/^[A-Za-z0-9_-]+$/, "expected unpadded base64url");

/** key_id = "ed25519-" + first 32 hex chars of SHA-256(raw 32-byte public key). */
export const keyIdSchema = z.string().regex(/^ed25519-[0-9a-f]{32}$/, "expected ed25519-<32 hex>");

export const signatureSchema = z
  .object({
    alg: z.literal(SIGNATURE_ALG),
    key_id: keyIdSchema,
    /** 64-byte Ed25519 signature, base64url without padding. */
    sig: base64url(64),
  })
  .strict();

export type DetachedSignature = z.infer<typeof signatureSchema>;

export const KEY_STATUSES = ["active", "retired", "revoked"] as const;

/**
 * A published public key. Rotation retires a key (valid_to set): its earlier signatures stay
 * valid. Revocation (compromise) distrusts every signature by that key, because whoever holds
 * a compromised key can backdate issued_at.
 */
export const publicKeyRecordSchema = z
  .object({
    key_id: keyIdSchema,
    algorithm: z.literal(SIGNATURE_ALG),
    /** Raw 32-byte public key, base64url without padding. */
    public_key: base64url(32),
    status: z.enum(KEY_STATUSES),
    valid_from: isoUtcMs,
    valid_to: isoUtcMs.nullable(),
    revoked_at: isoUtcMs.nullable(),
  })
  .strict();

export type PublicKeyRecord = z.infer<typeof publicKeyRecordSchema>;
