// In-memory Repo + fixed RouteDeps for node unit tests. The candidate provider deliberately
// returns ALL non-withdrawn records and lets the pure verify logic filter by true Hamming
// distance — band/radius pigeonhole correctness is a D1-query concern (repo/probe.ts test),
// not the route logic's.

import type { RouteDeps } from "../src/http.js";
import type { AnchorInfo, RecordRow, Repo, WaitlistInsert } from "../src/repo/types.js";

export const fixedDeps: RouteDeps = { now: () => "2026-07-27T12:00:00.000Z", newToken: () => "tok_fixed" };

export class FakeRepo implements Repo {
  readonly waitlistEmails = new Set<string>();
  readonly records: RecordRow[] = [];
  readonly anchors = new Map<string, AnchorInfo>(); // keyed by batchId

  async insertWaitlist(w: WaitlistInsert): Promise<{ created: boolean }> {
    const key = w.email.toLowerCase();
    if (this.waitlistEmails.has(key)) return { created: false };
    this.waitlistEmails.add(key);
    return { created: true };
  }

  async findRecordsBySha256(sha256Hex: string): Promise<RecordRow[]> {
    return this.records
      .filter((r) => r.sha256 === sha256Hex.toLowerCase() && r.moderationStatus !== "withdrawn")
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async findRecordCandidatesByBands(): Promise<RecordRow[]> {
    return this.records.filter((r) => r.moderationStatus !== "withdrawn");
  }

  async getAnchorForRecord(record: RecordRow): Promise<AnchorInfo | null> {
    if (!record.anchorBatchId) return null;
    return this.anchors.get(record.anchorBatchId) ?? null;
  }
}

/** Build a RecordRow with sensible defaults for tests. */
export function makeRecord(over: Partial<RecordRow> & Pick<RecordRow, "id" | "sha256" | "phash64">): RecordRow {
  return {
    kind: "claimed_capture",
    source: "web_sign",
    pdq256: null,
    status: "registered",
    moderationStatus: "active",
    createdAt: "2026-07-01T00:00:00.000Z",
    anchorBatchId: null,
    leafIndex: null,
    ...over,
  };
}
