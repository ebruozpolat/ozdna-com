// Repository boundary. Route logic depends ONLY on this interface, never on D1 directly —
// so every handler is unit-testable in node with an in-memory fake (test/fakes.ts) and the
// real D1/drizzle implementation (repo/d1.ts) is swapped in at the Worker edge. Same pattern
// that keeps chain SDKs out of shared code (plan/01 §6): I/O behind a seam.

/** A registry record row, reduced to the fields the v1 verify path needs. */
export interface RecordRow {
  readonly id: string;
  readonly kind: string; // 'ai_generated' | 'claimed_capture' | 'unspecified'
  readonly source: string;
  readonly sha256: string; // 64 hex; the exact-match key (not exposed in the public record view)
  /** Perceptual hash as UNSIGNED 64-bit (D1 stores signed; the repo normalizes on read). */
  readonly phash64: bigint;
  /** PDQ-256, 32 bytes, or null until computed (plan/04 §5 nullable BLOB). */
  readonly pdq256: Uint8Array | null;
  readonly status: string; // 'registered' | 'anchoring' | 'anchored' | 'revoked'
  readonly moderationStatus: string; // 'active' | 'disputed' | 'withdrawn'
  readonly createdAt: string;
  readonly anchorBatchId: string | null;
  readonly leafIndex: number | null;
}

/** Anchor state for a record's batch (drives the verify `anchor` block, §4.4). */
export interface AnchorInfo {
  readonly batchId: string;
  readonly status: string; // 'pending' | 'submitted' | 'confirmed' | 'failed'
  readonly chain: string;
  readonly txHash: string | null;
  readonly blockNumber: number | null;
  readonly confirmedAt: string | null;
}

export interface WaitlistInsert {
  readonly email: string;
  readonly segment: string;
  readonly source: string | null;
  readonly locale: string | null;
  readonly consentAt: string;
  readonly confirmToken: string | null;
}

export interface Repo {
  /** Insert a waitlist signup. Idempotent on email: existing email → { created:false }. */
  insertWaitlist(w: WaitlistInsert): Promise<{ created: boolean }>;

  /** Exact-fingerprint lookup by SHA-256 hex. Non-withdrawn records only. */
  findRecordsBySha256(sha256Hex: string): Promise<RecordRow[]>;

  /**
   * Multi-index candidate retrieval by pHash bands (plan/03 §2.2): return every non-withdrawn
   * record sharing ≥1 of the 4 bands. `radius` is advisory for the impl's probe generation;
   * scoring/ranking by true Hamming distance happens in the pure verify logic.
   */
  findRecordCandidatesByBands(bands: readonly [number, number, number, number], radius: number): Promise<RecordRow[]>;

  /** Anchor state for a record's batch, or null if not yet batched. */
  getAnchorForRecord(record: RecordRow): Promise<AnchorInfo | null>;
}
