// Raw provider payloads, stored by reference (ADR-004 §7): an R2 bucket when RAW_PAYLOADS is
// bound, otherwise a content-addressed, size-capped D1 blob. Over the cap, only hashes are kept.

import type { Env } from "../env.js";
import type { SourceStore } from "../repo/sources.js";
import type { Write } from "../repo/stores.js";
import { sha256Bytes } from "./recorder.js";
import { redactRetractionWatch } from "./snapshot.js";

export const D1_PAYLOAD_CAP = 256 * 1024;

export interface StoredPayload {
  readonly store: "r2" | "d1" | "none";
  readonly ref: string | null;
  readonly note: string | null;
  /** D1 blob insert, committed with the snapshot row; null otherwise. */
  readonly write: Write | null;
}

export async function storePayload(
  env: Env,
  sources: SourceStore,
  tenantId: string,
  original: Uint8Array | null,
): Promise<StoredPayload> {
  if (original === null) return { store: "none", ref: null, note: "NOT_CAPTURED", write: null };
  const redacted = await redactRetractionWatch(original);
  const bytes = redacted ?? original;
  const note = redacted ? "RETRACTION_WATCH_REDACTED" : null;
  const sha = await sha256Bytes(bytes);
  if (env.RAW_PAYLOADS) {
    const key = `provider-payloads/${tenantId}/${sha}`;
    await env.RAW_PAYLOADS.put(key, bytes, {
      httpMetadata: { contentType: "application/json" },
      customMetadata: { sha256: sha },
    });
    return { store: "r2", ref: key, note, write: null };
  }
  if (bytes.byteLength > D1_PAYLOAD_CAP) {
    return { store: "none", ref: null, note: "TOO_LARGE_FOR_D1", write: null };
  }
  return { store: "d1", ref: sha, note, write: sources.insertBlob(tenantId, sha, bytes) };
}
