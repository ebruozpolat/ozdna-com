// D1-backed Repo (drizzle). This is the production implementation swapped in at the Worker
// edge; the pure route logic never sees it. Retrieval math (bands, radius→neighbors) follows
// plan/03 §2.2 multi-index hashing.
//
// UNVERIFIED IN THIS ENV: there is no workerd/D1 in the session, so this file is NOT covered
// by the node unit tests (which use test/fakes.ts). Two things MUST be checked in `wrangler
// dev` before launch: (1) the 64-bit `phash64` round-trips through D1 without JS-number
// precision loss (D1 may surface INTEGER as a number — schema.ts note); (2) the neighbor-probe
// IN-lists stay within D1's SQL variable limits at r=2 (137 values/band). Tracked in the ledger.

import { and, eq, inArray, ne, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { toUnsignedU64 } from "@ozdna/dna-core";
import { anchorBatches, records, waitlist } from "@ozdna/db";
import { bandNeighbors } from "./probe.js";
import type { AnchorInfo, RecordRow, Repo, WaitlistInsert } from "./types.js";

type Db = ReturnType<typeof drizzle>;

type RecordSelect = typeof records.$inferSelect;

function toRow(r: RecordSelect): RecordRow {
  return {
    id: r.id,
    kind: r.kind,
    source: r.source,
    sha256: r.sha256,
    // signed → unsigned. BigInt(number) is only exact ≤2^53 — see the schema.ts phash64 caveat
    // (64-bit precision through D1 must move to a TEXT-hex read before launch).
    phash64: toUnsignedU64(BigInt(r.phash64)),
    pdq256: r.pdq256 ? new Uint8Array(r.pdq256 as ArrayBuffer) : null,
    status: r.status,
    moderationStatus: r.moderationStatus,
    createdAt: r.createdAt,
    anchorBatchId: r.anchorBatchId,
    leafIndex: r.leafIndex,
  };
}

export class D1Repo implements Repo {
  private readonly db: Db;
  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async insertWaitlist(w: WaitlistInsert): Promise<{ created: boolean }> {
    const inserted = await this.db
      .insert(waitlist)
      .values({
        email: w.email,
        segment: w.segment,
        source: w.source,
        locale: w.locale,
        consentAt: w.consentAt,
        confirmToken: w.confirmToken,
      })
      .onConflictDoNothing({ target: waitlist.email })
      .returning({ id: waitlist.id });
    return { created: inserted.length > 0 };
  }

  async findRecordsBySha256(sha256Hex: string): Promise<RecordRow[]> {
    const rows = await this.db
      .select()
      .from(records)
      .where(and(eq(records.sha256, sha256Hex), ne(records.moderationStatus, "withdrawn")))
      .orderBy(records.createdAt); // earliest registration first — the provenance-relevant one
    return rows.map(toRow);
  }

  async findRecordCandidatesByBands(
    bands: readonly [number, number, number, number],
    radius: number,
  ): Promise<RecordRow[]> {
    const [n0, n1, n2, n3] = [
      bandNeighbors(bands[0], radius),
      bandNeighbors(bands[1], radius),
      bandNeighbors(bands[2], radius),
      bandNeighbors(bands[3], radius),
    ];
    const rows = await this.db
      .select()
      .from(records)
      .where(
        and(
          ne(records.moderationStatus, "withdrawn"),
          or(
            inArray(records.band0, n0),
            inArray(records.band1, n1),
            inArray(records.band2, n2),
            inArray(records.band3, n3),
          ),
        ),
      );
    return rows.map(toRow);
  }

  async getAnchorForRecord(record: RecordRow): Promise<AnchorInfo | null> {
    if (!record.anchorBatchId) return null;
    const rows = await this.db.select().from(anchorBatches).where(eq(anchorBatches.id, record.anchorBatchId)).limit(1);
    const a = rows[0];
    if (!a) return null;
    return {
      batchId: a.id,
      status: a.status,
      chain: a.chain,
      txHash: a.txHash,
      blockNumber: a.blockNumber,
      confirmedAt: a.confirmedAt,
    };
  }
}
