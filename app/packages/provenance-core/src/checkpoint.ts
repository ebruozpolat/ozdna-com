// Checkpoints: commit to a chain prefix, and check a chain against one.
// Normative: provenance-event-v1.md §6. Signing the digest is Phase 3 (apps/signer).

import {
  CHECKPOINT_SCHEMA,
  type Checkpoint,
  type CheckpointBody,
  checkpointBodySchema,
  checkpointSchema,
  type EventRegistry,
} from "@ozdna/provenance-schema";
import { type ChainVerification, verifyChain } from "./chain.js";
import { computeCheckpointDigest } from "./hash.js";

export interface BuildCheckpointOptions {
  readonly registry?: EventRegistry;
}

/**
 * Checkpoint covering every event in `events` (a full chain from seq 0).
 * Throws if the chain is empty or invalid — a checkpoint must never vouch for bad data.
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
  const first = events[0] as { project_id: string };
  const parsed = checkpointBodySchema.safeParse({
    schema: CHECKPOINT_SCHEMA,
    project_id: first.project_id,
    head_seq: chain.head_seq,
    head_hash: chain.head_hash,
    event_count: chain.head_seq + 1,
    issued_at: issuedAt,
  });
  if (!parsed.success) throw new Error(`invalid checkpoint body: ${parsed.error.message}`);
  const body: CheckpointBody = parsed.data;
  return { body, digest: await computeCheckpointDigest(body) };
}

export type CheckpointErrorCode =
  | "CHECKPOINT_INVALID"
  | "CHECKPOINT_DIGEST_MISMATCH"
  | "CHAIN_INVALID"
  | "CHECKPOINT_BEYOND_CHAIN"
  | "CHECKPOINT_HEAD_MISMATCH";

export interface CheckpointVerification {
  readonly valid: boolean;
  readonly code: CheckpointErrorCode | null;
  readonly message: string | null;
  readonly chain: ChainVerification | null;
  /** Events covered by the checkpoint (head_seq + 1) when valid. */
  readonly covered_count: number;
  /** Valid events after the checkpoint head — integrity-checked but not yet attested. */
  readonly unattested_count: number;
  readonly first_bad_seq: number | null;
}

export interface VerifyCheckpointOptions {
  readonly registry?: EventRegistry;
}

/**
 * Check a full chain (from seq 0) against a checkpoint: the digest recomputes, the chain is
 * valid, it reaches the checkpoint head, and the event at head_seq has head_hash.
 * Detects rewriting (head mismatch), truncation/rollback (chain shorter than checkpoint)
 * and cross-project substitution. Does NOT check the signature — that needs the key
 * registry (Phase 3); the caller must verify the signature over `digest` separately.
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
  ): CheckpointVerification => ({
    valid: false,
    code,
    message,
    chain,
    covered_count: 0,
    unattested_count: 0,
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
  const atHead = events[body.head_seq] as { event_hash: string };
  if (atHead.event_hash !== body.head_hash) {
    return result(
      "CHECKPOINT_HEAD_MISMATCH",
      "event at checkpoint head_seq has a different hash — history was rewritten",
      chain,
      body.head_seq,
    );
  }

  return {
    valid: true,
    code: null,
    message: null,
    chain,
    covered_count: body.event_count,
    unattested_count: chain.verified_count - body.event_count,
    first_bad_seq: null,
  };
}
