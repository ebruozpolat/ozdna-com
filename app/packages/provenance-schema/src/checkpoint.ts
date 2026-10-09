// Checkpoint v1 — a commitment to a chain prefix. Normative: provenance-event-v1.md §6.
// Phase 3 signs checkpoint_digest; Slice 1 only defines and recomputes it.

import { z } from "zod";
import { isoUtcMs, prefixedId, sha256Hex } from "./primitives.js";

export const CHECKPOINT_SCHEMA = "ozdna.provenance.checkpoint/v1" as const;

export const checkpointBodySchema = z
  .object({
    schema: z.literal(CHECKPOINT_SCHEMA),
    project_id: prefixedId("prj"),
    /** seq of the last event covered. */
    head_seq: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    /** event_hash of that event. */
    head_hash: sha256Hex,
    /** Always head_seq + 1 (chains start at seq 0); explicit so readers need not infer it. */
    event_count: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    /** Supplied by the issuer (Phase 3 signer); never read from a clock here. */
    issued_at: isoUtcMs,
  })
  .strict()
  .refine((b) => b.event_count === b.head_seq + 1, {
    message: "event_count must equal head_seq + 1",
    path: ["event_count"],
  });

export type CheckpointBody = z.infer<typeof checkpointBodySchema>;

export const checkpointSchema = z
  .object({ body: checkpointBodySchema, digest: sha256Hex })
  .strict();

export type Checkpoint = z.infer<typeof checkpointSchema>;
