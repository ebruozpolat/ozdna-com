// Load a project's stored chain for verification or checkpointing. Only the canonical text is
// read; denormalised columns are never trusted.

import type { StoredEvent } from "@ozdna/provenance-schema";
import { HttpError } from "../errors.js";
import type { Stores } from "../repo/stores.js";
import { parseStoredRow } from "./append.js";

/** Most events one call will load; longer chains need incremental verification. */
export const MAX_CHAIN_EVENTS = 100_000;
const PAGE = 1000;

export interface LoadedChain {
  /** Parsed events up to (not including) the first row that is not canonical. */
  readonly events: StoredEvent[];
  readonly rowCount: number;
  readonly unparsable: { readonly index: number; readonly seq: number } | null;
}

export async function loadChain(
  stores: Stores,
  tenantId: string,
  projectId: string,
): Promise<LoadedChain> {
  const events: StoredEvent[] = [];
  let unparsable: LoadedChain["unparsable"] = null;
  let rowCount = 0;
  let afterSeq = -1;
  while (rowCount < MAX_CHAIN_EVENTS) {
    const rows = await stores.events.list(tenantId, projectId, { afterSeq, limit: PAGE });
    for (const row of rows) {
      if (unparsable === null) {
        try {
          events.push(parseStoredRow(row));
        } catch {
          unparsable = { index: rowCount, seq: row.seq };
        }
      }
      rowCount++;
    }
    if (rows.length < PAGE) break;
    afterSeq = rows.at(-1)!.seq;
  }
  if (rowCount >= MAX_CHAIN_EVENTS) {
    throw new HttpError(
      422,
      "invalid_request",
      "CHAIN_TOO_LONG",
      `Chains over ${MAX_CHAIN_EVENTS} events need incremental verification.`,
    );
  }
  return { events, rowCount, unparsable };
}
