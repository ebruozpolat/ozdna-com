// Append one event to a project chain, safely under concurrency.
//
// Each attempt: (idempotency check) → read head → appendEvent (pure core: validates the
// draft against the registry, re-verifies the head, links and hashes) → commit the event
// plus any companion writes in ONE batch. Two concurrent appends both read head n; the
// loser's INSERT hits PRIMARY KEY (project_id, seq) and the whole batch rolls back, so it
// retries on the new head. Attempts are bounded.

import { appendEvent, ProvenanceAppendError } from "@ozdna/provenance-core";
import {
  canonicalize,
  type EventDraft,
  MAX_EVENT_BYTES,
  parseCanonical,
  type StoredEvent,
} from "@ozdna/provenance-schema";
import { HttpError } from "../errors.js";
import type { EventRow, Stores, Write } from "../repo/stores.js";

export const MAX_APPEND_ATTEMPTS = 5;

export interface AppendInput {
  readonly tenantId: string;
  readonly projectId: string;
  /** Draft minus the fields the service owns (event_id, project_id, recorded_at). */
  readonly draft: Omit<EventDraft, "event_id" | "project_id" | "recorded_at">;
  readonly eventId: string;
  /** True only for project creation: the chain must be empty. */
  readonly genesis?: boolean;
  /** Companion writes committed atomically with the event (project row, artifact row). */
  readonly extraWrites?: (event: StoredEvent) => readonly Write[];
  readonly idempotency?: { readonly key: string; readonly requestHash: string };
  /** Server clock, injected (appendEvent clamps it to be non-decreasing). */
  readonly now: () => string;
}

export interface AppendResult {
  readonly event: StoredEvent;
  readonly replay: boolean;
}

/** Parse a stored row; a row that is not canonical means the chain is corrupt. */
export function parseStoredRow(row: EventRow): StoredEvent {
  try {
    return parseCanonical(row.canonical, { maxBytes: MAX_EVENT_BYTES }) as StoredEvent;
  } catch {
    throw new HttpError(
      409,
      "conflict",
      "CHAIN_CORRUPT",
      `Stored event at seq ${row.seq} is not canonical.`,
    );
  }
}

function isUniqueViolation(e: unknown, columns: string): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("UNIQUE constraint failed") && msg.includes(columns);
}

async function replayOrConflict(stores: Stores, input: AppendInput): Promise<AppendResult | null> {
  if (!input.idempotency) return null;
  const prior = await stores.idempotency.get(
    input.tenantId,
    input.projectId,
    input.idempotency.key,
  );
  if (!prior) return null;
  if (prior.request_hash !== input.idempotency.requestHash) {
    throw new HttpError(
      409,
      "conflict",
      "IDEMPOTENCY_KEY_REUSED",
      "This Idempotency-Key was already used with a different request body.",
    );
  }
  const row = await stores.events.getBySeq(input.tenantId, input.projectId, prior.seq);
  if (!row) throw new HttpError(409, "conflict", "CHAIN_CORRUPT", "Idempotent event is missing.");
  return { event: parseStoredRow(row), replay: true };
}

export async function appendWithRetry(stores: Stores, input: AppendInput): Promise<AppendResult> {
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    const replay = await replayOrConflict(stores, input);
    if (replay) return replay;

    let prev: StoredEvent | null = null;
    if (!input.genesis) {
      const head = await stores.events.head(input.tenantId, input.projectId);
      if (!head)
        throw new HttpError(409, "conflict", "CHAIN_CORRUPT", "Project has no genesis event.");
      prev = parseStoredRow(head);
    }

    let event: StoredEvent;
    try {
      event = await appendEvent(prev, {
        ...input.draft,
        event_id: input.eventId,
        project_id: input.projectId,
        recorded_at: input.now(),
      } as EventDraft);
    } catch (e) {
      if (e instanceof ProvenanceAppendError) {
        if (e.code === "PREV_INVALID" || e.code === "HASH_MISMATCH") {
          throw new HttpError(
            409,
            "conflict",
            "CHAIN_CORRUPT",
            "The stored chain head is invalid.",
          );
        }
        throw new HttpError(422, "invalid_request", "EVENT_INVALID", e.message, e.issues);
      }
      throw e;
    }

    // Companion rows first: events.project_id references projects(id).
    const writes: Write[] = [
      ...(input.extraWrites?.(event) ?? []),
      stores.events.insert(
        input.tenantId,
        event,
        canonicalize(event, { maxBytes: MAX_EVENT_BYTES }),
      ),
    ];
    if (input.idempotency) {
      writes.push(
        stores.idempotency.insert(
          input.tenantId,
          input.projectId,
          input.idempotency.key,
          input.idempotency.requestHash,
          event.seq,
        ),
      );
    }

    try {
      await stores.uow.commit(writes);
      return { event, replay: false };
    } catch (e) {
      // Lost the race for this seq, or for this idempotency key: re-read and try again.
      if (isUniqueViolation(e, "events.project_id, events.seq")) continue;
      if (isUniqueViolation(e, "idempotency_keys.")) continue;
      if (isUniqueViolation(e, "projects.tenant_id, projects.external_ref")) {
        throw new HttpError(
          409,
          "conflict",
          "PROJECT_EXISTS",
          "A project with this external_ref exists.",
        );
      }
      throw e;
    }
  }
  throw new HttpError(
    503,
    "unavailable",
    "APPEND_CONTENTION",
    "Too many concurrent appends; retry.",
  );
}
