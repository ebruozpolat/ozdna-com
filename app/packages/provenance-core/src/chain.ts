// Per-project hash chain: append and verify. Normative: provenance-event-v1.md §4.
//
// What verifyChain proves: the events are well-formed, registered, contiguous from the
// stated start, each links to the one before, and each event_hash matches its content.
// What it does NOT prove: who wrote the chain. Anyone can build a self-consistent chain
// from scratch; authenticity comes from a signed checkpoint (Phase 3) checked with
// verifyAgainstCheckpoint.

import {
  EVENT_SCHEMA,
  type EventDraft,
  type EventRegistry,
  GENESIS_PREV_HASH,
  isoUtcMs,
  normalizeNfcDeep,
  type StoredEvent,
  type UnhashedEvent,
  type ValidationIssue,
  validateStoredEvent,
  validateUnhashedEvent,
} from "@ozdna/provenance-schema";
import { computeEventHash } from "./hash.js";

export const GENESIS_EVENT_TYPE = "project.created";

/** Default cap on events verified in one call. */
export const DEFAULT_MAX_CHAIN_EVENTS = 100_000;

export type ChainErrorCode =
  | "NOT_AN_ARRAY"
  | "TOO_MANY_EVENTS"
  | "EVENT_INVALID"
  | "PROJECT_MISMATCH"
  | "SEQ_MISMATCH"
  | "PREV_HASH_MISMATCH"
  | "HASH_MISMATCH"
  | "DUPLICATE_EVENT_ID"
  | "GENESIS_TYPE"
  | "GENESIS_REPEATED"
  | "RECORDED_AT_REGRESSION";

export interface ChainError {
  readonly code: ChainErrorCode;
  /** Position in the input array. */
  readonly index: number;
  /** The seq that should be at this position. */
  readonly seq: number;
  readonly message: string;
  readonly issues?: readonly ValidationIssue[];
}

export interface ChainVerification {
  readonly valid: boolean;
  /** Events verified before the first failure (all of them when valid). */
  readonly verified_count: number;
  readonly head_seq: number | null;
  readonly head_hash: string | null;
  /** seq position of the first bad event; null when valid. */
  readonly first_bad_seq: number | null;
  readonly error: ChainError | null;
}

export interface VerifyChainOptions {
  readonly registry?: EventRegistry;
  /** Require every event to belong to this project. Defaults to the first event's project. */
  readonly projectId?: string;
  /**
   * Verify a slice that starts mid-chain. `prevHash` is the event_hash of event seq−1,
   * taken from something you already trust (e.g. a verified checkpoint).
   */
  readonly start?: { readonly seq: number; readonly prevHash: string };
  readonly maxEvents?: number;
}

export async function verifyChain(
  events: readonly unknown[],
  opts: VerifyChainOptions = {},
): Promise<ChainVerification> {
  const startSeq = opts.start?.seq ?? 0;
  let expectedPrev = opts.start?.prevHash ?? GENESIS_PREV_HASH;
  let projectId = opts.projectId ?? null;
  let headHash: string | null = null;
  let lastRecordedAt: string | null = null;
  const seen = new Set<string>();

  const bad = (
    code: ChainErrorCode,
    index: number,
    message: string,
    issues?: readonly ValidationIssue[],
  ) => {
    const error: ChainError = {
      code,
      index,
      seq: startSeq + index,
      message,
      ...(issues ? { issues } : {}),
    };
    return {
      valid: false,
      verified_count: index,
      head_seq: index > 0 ? startSeq + index - 1 : null,
      head_hash: headHash,
      first_bad_seq: startSeq + index,
      error,
    };
  };

  if (!Array.isArray(events)) return bad("NOT_AN_ARRAY", 0, "events must be an array");
  const maxEvents = opts.maxEvents ?? DEFAULT_MAX_CHAIN_EVENTS;
  if (events.length > maxEvents) {
    return bad("TOO_MANY_EVENTS", 0, `${events.length} events exceeds limit ${maxEvents}`);
  }

  for (let i = 0; i < events.length; i++) {
    const seq = startSeq + i;
    const v = validateStoredEvent(events[i], opts.registry ? { registry: opts.registry } : {});
    if (!v.ok) return bad("EVENT_INVALID", i, "event fails schema/registry validation", v.issues);
    const ev = v.event;

    if (projectId === null) projectId = ev.project_id;
    if (ev.project_id !== projectId) {
      return bad("PROJECT_MISMATCH", i, `event belongs to ${ev.project_id}, chain is ${projectId}`);
    }
    if (ev.seq !== seq) return bad("SEQ_MISMATCH", i, `expected seq ${seq}, found ${ev.seq}`);
    if (seq === 0 && ev.type !== GENESIS_EVENT_TYPE) {
      return bad("GENESIS_TYPE", i, `seq 0 must be ${GENESIS_EVENT_TYPE}`);
    }
    if (seq !== 0 && ev.type === GENESIS_EVENT_TYPE) {
      return bad("GENESIS_REPEATED", i, `${GENESIS_EVENT_TYPE} is only valid at seq 0`);
    }
    if (ev.prev_hash !== expectedPrev) {
      return bad("PREV_HASH_MISMATCH", i, "prev_hash does not match the previous event");
    }
    if (seen.has(ev.event_id))
      return bad("DUPLICATE_EVENT_ID", i, `event_id ${ev.event_id} repeats`);
    if (lastRecordedAt !== null && ev.recorded_at < lastRecordedAt) {
      return bad("RECORDED_AT_REGRESSION", i, "recorded_at goes backwards");
    }

    const recomputed = await computeEventHash(ev);
    if (recomputed !== ev.event_hash) {
      return bad("HASH_MISMATCH", i, "event_hash does not match event content");
    }

    seen.add(ev.event_id);
    lastRecordedAt = ev.recorded_at;
    expectedPrev = recomputed;
    headHash = recomputed;
  }

  return {
    valid: true,
    verified_count: events.length,
    head_seq: events.length > 0 ? startSeq + events.length - 1 : null,
    head_hash: headHash,
    first_bad_seq: null,
    error: null,
  };
}

export class ProvenanceAppendError extends Error {
  readonly code: ChainErrorCode | "DRAFT_INVALID" | "PREV_INVALID";
  readonly issues: readonly ValidationIssue[];
  constructor(
    code: ProvenanceAppendError["code"],
    message: string,
    issues: readonly ValidationIssue[] = [],
  ) {
    super(message);
    this.name = "ProvenanceAppendError";
    this.code = code;
    this.issues = issues;
  }
}

export interface AppendOptions {
  readonly registry?: EventRegistry;
}

/**
 * Build the next event of a chain. Pure apart from hashing: every value, including
 * recorded_at, comes from the caller. `prev` is the current head (null for a new chain)
 * and is itself re-validated and re-hashed, so a corrupted head cannot be extended.
 *
 * Strings in the draft are NFC-normalised before hashing. recorded_at is clamped to be
 * no earlier than prev.recorded_at (append services run on clocks that can skew).
 */
export async function appendEvent(
  prevInput: StoredEvent | null,
  draft: EventDraft,
  opts: AppendOptions = {},
): Promise<StoredEvent> {
  const vopts = opts.registry ? { registry: opts.registry } : {};
  // Work from the validated snapshot of prev, never the caller's object.
  let prev: StoredEvent | null = null;
  if (prevInput !== null) {
    const pv = validateStoredEvent(prevInput, vopts);
    if (!pv.ok)
      throw new ProvenanceAppendError("PREV_INVALID", "previous event is invalid", pv.issues);
    prev = pv.event;
    if ((await computeEventHash(prev)) !== prev.event_hash) {
      throw new ProvenanceAppendError(
        "HASH_MISMATCH",
        "previous event_hash does not match its content",
      );
    }
  }

  const normalized = normalizeNfcDeep(draft as unknown as Record<string, unknown>);
  // Clamp only a well-formed timestamp: a malformed one ("0") also sorts first and would
  // otherwise be laundered into prev.recorded_at instead of being rejected.
  const recordedAt =
    prev !== null &&
    isoUtcMs.safeParse(normalized.recorded_at).success &&
    (normalized.recorded_at as string) < prev.recorded_at
      ? prev.recorded_at
      : normalized.recorded_at;

  const candidate: Record<string, unknown> = {
    ...normalized,
    schema: EVENT_SCHEMA,
    seq: prev === null ? 0 : prev.seq + 1,
    prev_hash: prev === null ? GENESIS_PREV_HASH : prev.event_hash,
    recorded_at: recordedAt,
  };

  const v = validateUnhashedEvent(candidate, vopts);
  if (!v.ok) throw new ProvenanceAppendError("DRAFT_INVALID", "event draft is invalid", v.issues);
  const ev: UnhashedEvent = v.event;

  if (prev !== null && ev.project_id !== prev.project_id) {
    throw new ProvenanceAppendError("PROJECT_MISMATCH", "draft project_id differs from the chain");
  }
  if (ev.seq === 0 && ev.type !== GENESIS_EVENT_TYPE) {
    throw new ProvenanceAppendError(
      "GENESIS_TYPE",
      `the first event must be ${GENESIS_EVENT_TYPE}`,
    );
  }
  if (ev.seq !== 0 && ev.type === GENESIS_EVENT_TYPE) {
    throw new ProvenanceAppendError(
      "GENESIS_REPEATED",
      `${GENESIS_EVENT_TYPE} is only valid at seq 0`,
    );
  }

  return { ...ev, event_hash: await computeEventHash(ev) };
}
