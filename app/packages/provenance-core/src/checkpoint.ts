// Checkpoints: commit to a chain prefix, and check a chain against one.
// Normative: provenance-event-v1.md §6. Signing the digest is Phase 3 (apps/signer).

import {
  CHECKPOINT_SCHEMA,
  type Checkpoint,
  type CheckpointBody,
  checkpointBodySchema,
  checkpointSchema,
  type EventRegistry,
  type StoredEvent,
  validateStoredEvent,
} from "@ozdna/provenance-schema";
import { type ChainVerification, verifyChain } from "./chain.js";
import { computeCheckpointDigest, computeEventHash } from "./hash.js";

export interface BuildCheckpointOptions {
  readonly registry?: EventRegistry;
}

/**
 * Validated snapshot of events[seq] with its recomputed hash. Only call after verifyChain
 * accepted `events`; reading the caller's objects directly could see different values than
 * the ones that were verified.
 */
async function verifiedEventAt(
  events: readonly unknown[],
  seq: number,
  registry: EventRegistry | undefined,
): Promise<{ event: StoredEvent; hash: string }> {
  const v = validateStoredEvent(events[seq], registry ? { registry } : {});
  if (!v.ok) throw new Error(`event at seq ${seq} changed after verification`);
  return { event: v.event, hash: await computeEventHash(v.event) };
}

/**
 * Checkpoint covering every event in `events` (a full chain from seq 0).
 * Throws if the chain is empty or invalid, or if issuedAt predates the head event's
 * recorded_at: a checkpoint must never vouch for bad data or be backdated.
 */
export async function buildCheckpoint(
  events: readonly unknown[],
  issuedAt: string,
  opts: BuildCheckpointOptions = {},
): Promise<Checkpoint> {
  const chain = await verifyChain(events, opts.registry ? { registry: opts.registry } : {});
  if (!chain.valid) {
    throw new Error(
      `cannot checkpoint an invalid chain: ${chain.error?.code} at seq ${chain.first_bad_seq}`,
    );
  }
  if (chain.head_seq === null || chain.head_hash === null) {
    throw new Error("cannot checkpoint an empty chain");
  }
  const head = await verifiedEventAt(events, chain.head_seq, opts.registry);
  const parsed = checkpointBodySchema.safeParse({
    schema: CHECKPOINT_SCHEMA,
    project_id: head.event.project_id,
    head_seq: chain.head_seq,
    head_hash: head.hash,
    event_count: chain.head_seq + 1,
    issued_at: issuedAt,
  });
  if (!parsed.success) throw new Error(`invalid checkpoint body: ${parsed.error.message}`);
  const body: CheckpointBody = parsed.data;
  if (body.issued_at < head.event.recorded_at) {
    throw new Error("checkpoint issued_at predates the head event's recorded_at");
  }
  return { body, digest: await computeCheckpointDigest(body) };
}

export type CheckpointErrorCode =
  | "CHECKPOINT_INVALID"
  | "CHECKPOINT_DIGEST_MISMATCH"
  | "CHAIN_INVALID"
  | "CHECKPOINT_BEYOND_CHAIN"
  | "CHECKPOINT_HEAD_MISMATCH"
  | "CHECKPOINT_PREDATES_HEAD"
  | "UNATTESTED_EVENTS";

export interface CheckpointVerification {
  readonly valid: boolean;
  readonly code: CheckpointErrorCode | null;
  readonly message: string | null;
  readonly chain: ChainVerification | null;
  /** Events covered by the checkpoint (head_seq + 1) once the head matched. */
  readonly covered_count: number;
  /** Integrity-checked events after the checkpoint head that no checkpoint attests yet. */
  readonly unattested_count: number;
  readonly first_bad_seq: number | null;
}

export interface VerifyCheckpointOptions {
  readonly registry?: EventRegistry;
  /**
   * Accept events after the checkpoint head (reported in unattested_count). Off by default:
   * anyone can append a self-consistent tail, so `valid` must not cover it unless the
   * caller explicitly asks for that and handles unattested_count.
   */
  readonly allowUnattested?: boolean;
}

/**
 * Check a full chain (from seq 0) against a checkpoint: the digest recomputes, the chain is
 * valid, it reaches the checkpoint head, the event at head_seq has head_hash, the checkpoint
 * is not backdated, and (by default) nothing follows the head.
 * Detects rewriting (head mismatch), truncation/rollback (chain shorter than checkpoint),
 * cross-project substitution and forged tails. Does NOT check the signature — that needs the
 * key registry (Phase 3); the caller must verify the signature over `digest` separately.
 */
export async function verifyAgainstCheckpoint(
  events: readonly unknown[],
  checkpoint: unknown,
  opts: VerifyCheckpointOptions = {},
): Promise<CheckpointVerification> {
  const result = (
    code: CheckpointErrorCode,
    message: string,
    chain: ChainVerification | null,
    firstBad: number | null,
    counts: { covered: number; unattested: number } = { covered: 0, unattested: 0 },
  ): CheckpointVerification => ({
    valid: false,
    code,
    message,
    chain,
    covered_count: counts.covered,
    unattested_count: counts.unattested,
    first_bad_seq: firstBad,
  });

  const cp = checkpointSchema.safeParse(checkpoint);
  if (!cp.success) return result("CHECKPOINT_INVALID", cp.error.message, null, null);
  const { body, digest } = cp.data;

  if ((await computeCheckpointDigest(body)) !== digest) {
    return result(
      "CHECKPOINT_DIGEST_MISMATCH",
      "digest does not match checkpoint body",
      null,
      null,
    );
  }

  const chain = await verifyChain(events, {
    projectId: body.project_id,
    ...(opts.registry ? { registry: opts.registry } : {}),
  });
  if (!chain.valid) {
    return result(
      "CHAIN_INVALID",
      chain.error?.message ?? "chain invalid",
      chain,
      chain.first_bad_seq,
    );
  }
  if (chain.head_seq === null || chain.head_seq < body.head_seq) {
    return result(
      "CHECKPOINT_BEYOND_CHAIN",
      `checkpoint covers ${body.event_count} events; chain has ${chain.verified_count}`,
      chain,
      (chain.head_seq ?? -1) + 1,
    );
  }
  const head = await verifiedEventAt(events, body.head_seq, opts.registry);
  if (head.hash !== body.head_hash) {
    return result(
      "CHECKPOINT_HEAD_MISMATCH",
      "event at checkpoint head_seq has a different hash — history was rewritten",
      chain,
      body.head_seq,
    );
  }
  if (body.issued_at < head.event.recorded_at) {
    return result(
      "CHECKPOINT_PREDATES_HEAD",
      "checkpoint issued_at is earlier than the head event's recorded_at",
      chain,
      body.head_seq,
    );
  }

  const counts = {
    covered: body.event_count,
    unattested: chain.verified_count - body.event_count,
  };
  if (counts.unattested > 0 && opts.allowUnattested !== true) {
    return result(
      "UNATTESTED_EVENTS",
      `${counts.unattested} event(s) after the checkpoint head are not attested`,
      chain,
      body.head_seq + 1,
      counts,
    );
  }

  return {
    valid: true,
    code: null,
    message: null,
    chain,
    covered_count: counts.covered,
    unattested_count: counts.unattested,
    first_bad_seq: null,
  };
}
