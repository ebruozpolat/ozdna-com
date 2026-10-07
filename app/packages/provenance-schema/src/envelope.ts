// Provenance event envelope v1. Normative: app/docs/schemas/provenance-event-v1.md §2.
//
// The envelope is strict: unknown top-level keys are rejected, never stripped — a stored
// event must hash exactly as it is read back.

import { z } from "zod";
import { isoUtcMs, prefixedId, safeText, sha256Hex } from "./primitives.js";

/** Schema/version string. Also the hash domain-separation prefix (see provenance-core). */
export const EVENT_SCHEMA = "ozdna.provenance.event/v1" as const;

/** prev_hash of the first event (seq 0) in every project chain. */
export const GENESIS_PREV_HASH = "0".repeat(64);

/** Hard cap on one serialised event (canonical UTF-8 bytes, including event_hash). */
export const MAX_EVENT_BYTES = 64 * 1024;

/** Max nesting depth inside an event (envelope root = 1). */
export const MAX_EVENT_DEPTH = 12;

export const ACTOR_KINDS = ["person", "service", "ai_system"] as const;

/**
 * Who did it. Asserted by the calling platform (`asserted_by` = that platform's service
 * id); ozDNA records the assertion, it does not authenticate end users.
 */
export const actorSchema = z
  .object({
    kind: z.enum(ACTOR_KINDS),
    id: safeText(128),
    asserted_by: prefixedId("svc"),
  })
  .strict();

const typeName = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,31}(\.[a-z][a-z0-9_]{0,31}){1,3}$/, "expected dotted lowercase type");

const envelopeShape = {
  schema: z.literal(EVENT_SCHEMA),
  event_id: prefixedId("evt"),
  project_id: prefixedId("prj"),
  seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  prev_hash: sha256Hex,
  type: typeName,
  type_version: z.number().int().min(1).max(1000),
  /** When the platform says it happened (asserted, not trusted). */
  occurred_at: isoUtcMs,
  /** When ozDNA appended it (assigned by the append service, passed in — never read here). */
  recorded_at: isoUtcMs,
  actor: actorSchema,
  artifact_id: prefixedId("art").nullable(),
  /** Validated per (type, type_version) by the registry. */
  payload: z.record(z.string(), z.unknown()),
};

/** Event as stored: envelope + event_hash. */
export const storedEventSchema = z.object({ ...envelopeShape, event_hash: sha256Hex }).strict();

/** Envelope without event_hash — the hash preimage. */
export const unhashedEventSchema = z.object(envelopeShape).strict();

export type StoredEvent = z.infer<typeof storedEventSchema>;
export type UnhashedEvent = z.infer<typeof unhashedEventSchema>;
export type Actor = z.infer<typeof actorSchema>;

/** What a caller supplies to append; seq/prev_hash/schema/event_hash are filled in by core. */
export type EventDraft = Omit<UnhashedEvent, "schema" | "seq" | "prev_hash">;
