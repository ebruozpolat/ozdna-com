// Event and checkpoint hashing. Normative: provenance-event-v1.md §4 and §6.
//
//   event_hash        = SHA-256( "ozdna.provenance.event/v1\n"      ‖ cjson(event − event_hash) )
//   checkpoint_digest = SHA-256( "ozdna.provenance.checkpoint/v1\n" ‖ cjson(checkpoint body) )
//
// The schema string doubles as a domain-separation prefix, so an event preimage can never
// be replayed as a checkpoint preimage (or vice versa), even if their JSON coincided.

import {
  CHECKPOINT_SCHEMA,
  type CheckpointBody,
  canonicalize,
  EVENT_SCHEMA,
  MAX_EVENT_BYTES,
  MAX_EVENT_DEPTH,
  type StoredEvent,
  type UnhashedEvent,
} from "@ozdna/provenance-schema";

const encoder = new TextEncoder();

export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

/** SHA-256 via Web Crypto (Node 22, Workers, browsers). Lowercase hex. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as BufferSource);
  return toHex(new Uint8Array(digest));
}

/** The exact bytes hashed for an event (exposed for independent verifiers and tests). */
export function eventPreimage(event: UnhashedEvent | StoredEvent): Uint8Array {
  const { event_hash: _ignored, ...unhashed } = event as StoredEvent;
  const body = canonicalize(unhashed, { maxBytes: MAX_EVENT_BYTES, maxDepth: MAX_EVENT_DEPTH });
  return encoder.encode(`${EVENT_SCHEMA}\n${body}`);
}

/** event_hash for an event; any event_hash field already present is ignored. */
export async function computeEventHash(event: UnhashedEvent | StoredEvent): Promise<string> {
  return sha256Hex(eventPreimage(event));
}

/** The exact bytes hashed for a checkpoint body. */
export function checkpointPreimage(body: CheckpointBody): Uint8Array {
  return encoder.encode(`${CHECKPOINT_SCHEMA}\n${canonicalize(body)}`);
}

export async function computeCheckpointDigest(body: CheckpointBody): Promise<string> {
  return sha256Hex(checkpointPreimage(body));
}
