// Source-verification repository (Phase 4c). Same rules as stores.ts: every tenant-data
// statement binds tenant_id from the caller's auth context; writes are returned unexecuted so
// they can be committed atomically.

import type { Write } from "./stores.js";

export interface SourceRow {
  readonly id: string;
  readonly scheme: string;
  readonly value: string;
  readonly reference_canonical: string;
  readonly refresh_after_seconds: number;
  readonly created_at: string;
}

export interface SourceIdentifierRow {
  readonly scheme: string;
  readonly value: string;
  readonly origin: "input" | "provider";
}

export interface ProjectSourceRow {
  readonly project_id: string;
  readonly citation_id: string;
  readonly service_id: string;
}

export interface SnapshotRow {
  readonly id: string;
  readonly provider: string;
  readonly snapshot_sha256: string;
  readonly response_sha256: string;
  readonly payload_store: "r2" | "d1" | "none";
  readonly payload_ref: string | null;
  readonly payload_note: string | null;
  readonly created_at: string;
}

export interface ResultRow {
  readonly id: string;
  readonly snapshot_id: string | null;
  readonly state: string;
  readonly confidence_bp: number;
  readonly components: string;
  readonly reason: string | null;
  readonly failure_reason: string | null;
  readonly verifier_version: string;
  readonly trigger: "request" | "refresh";
  readonly created_at: string;
}

export interface StatusRow {
  readonly seq: number;
  readonly state: string;
  readonly previous_state: string | null;
  readonly result_id: string;
  readonly created_at: string;
}

export interface StaleSource {
  readonly tenant_id: string;
  readonly source_id: string;
}

export interface SourceStore {
  byIdentifier(tenantId: string, scheme: string, value: string): Promise<SourceRow | null>;
  get(tenantId: string, sourceId: string): Promise<SourceRow | null>;
  insert(tenantId: string, row: Omit<SourceRow, "created_at">): Write;
  identifiers(tenantId: string, sourceId: string): Promise<SourceIdentifierRow[]>;
  insertIdentifier(tenantId: string, sourceId: string, row: SourceIdentifierRow): Write;

  link(
    tenantId: string,
    projectId: string,
    citationId: string,
  ): Promise<(ProjectSourceRow & { source_id: string }) | null>;
  insertLink(tenantId: string, row: ProjectSourceRow & { source_id: string }): Write;
  citingProjects(tenantId: string, sourceId: string): Promise<ProjectSourceRow[]>;

  snapshotByHash(tenantId: string, sourceId: string, sha256: string): Promise<SnapshotRow | null>;
  snapshots(tenantId: string, sourceId: string): Promise<SnapshotRow[]>;
  insertSnapshot(
    tenantId: string,
    sourceId: string,
    row: Omit<SnapshotRow, "created_at"> & { snapshot_canonical: string },
  ): Write;
  insertBlob(tenantId: string, sha256: string, bytes: Uint8Array): Write;
  blob(tenantId: string, sha256: string): Promise<Uint8Array | null>;

  latestResult(tenantId: string, sourceId: string): Promise<ResultRow | null>;
  /** created_at of the latest result that had a provider answer (failures excluded). */
  lastAnsweredAt(tenantId: string, sourceId: string): Promise<string | null>;
  results(tenantId: string, sourceId: string, limit: number): Promise<ResultRow[]>;
  insertResult(tenantId: string, sourceId: string, row: ResultRow): Write;

  latestStatus(tenantId: string, sourceId: string): Promise<StatusRow | null>;
  statusHistory(tenantId: string, sourceId: string): Promise<StatusRow[]>;
  insertStatus(tenantId: string, sourceId: string, row: StatusRow): Write;

  /** Sources whose latest result is older than their refresh window (or that have none). */
  stale(nowIso: string, limit: number): Promise<StaleSource[]>;

  /** Not tenant data: outbound provider calls for rate limiting. */
  providerCallsSince(provider: string, sinceMs: number): Promise<number>;
  insertProviderCall(provider: string, atMs: number): Write;
}

const w = (s: D1PreparedStatement) => s as Write;

export function d1SourceStore(db: D1Database): SourceStore {
  const all = async <T>(s: D1PreparedStatement) => (await s.all<T>()).results ?? [];
  return {
    byIdentifier: (tenantId, scheme, value) =>
      db
        .prepare(
          `SELECT id, scheme, value, reference_canonical, refresh_after_seconds, created_at
           FROM sources WHERE tenant_id = ? AND scheme = ? AND value = ? LIMIT 1`,
        )
        .bind(tenantId, scheme, value)
        .first<SourceRow>(),
    get: (tenantId, sourceId) =>
      db
        .prepare(
          `SELECT id, scheme, value, reference_canonical, refresh_after_seconds, created_at
           FROM sources WHERE tenant_id = ? AND id = ? LIMIT 1`,
        )
        .bind(tenantId, sourceId)
        .first<SourceRow>(),
    insert: (tenantId, r) =>
      w(
        db
          .prepare(
            `INSERT INTO sources (id, tenant_id, scheme, value, reference_canonical, refresh_after_seconds)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .bind(r.id, tenantId, r.scheme, r.value, r.reference_canonical, r.refresh_after_seconds),
      ),
    identifiers: (tenantId, sourceId) =>
      all<SourceIdentifierRow>(
        db
          .prepare(
            `SELECT scheme, value, origin FROM source_identifiers
             WHERE tenant_id = ? AND source_id = ? ORDER BY created_at, scheme, value`,
          )
          .bind(tenantId, sourceId),
      ),
    insertIdentifier: (tenantId, sourceId, r) =>
      w(
        db
          .prepare(
            `INSERT OR IGNORE INTO source_identifiers (tenant_id, source_id, scheme, value, origin)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(tenantId, sourceId, r.scheme, r.value, r.origin),
      ),

    link: (tenantId, projectId, citationId) =>
      db
        .prepare(
          `SELECT project_id, citation_id, service_id, source_id FROM project_sources
           WHERE tenant_id = ? AND project_id = ? AND citation_id = ? LIMIT 1`,
        )
        .bind(tenantId, projectId, citationId)
        .first<ProjectSourceRow & { source_id: string }>(),
    insertLink: (tenantId, r) =>
      w(
        db
          .prepare(
            `INSERT INTO project_sources (tenant_id, project_id, source_id, citation_id, service_id)
             VALUES (?, ?, ?, ?, ?)`,
          )
          .bind(tenantId, r.project_id, r.source_id, r.citation_id, r.service_id),
      ),
    citingProjects: (tenantId, sourceId) =>
      all<ProjectSourceRow>(
        db
          .prepare(
            `SELECT project_id, citation_id, service_id FROM project_sources
             WHERE tenant_id = ? AND source_id = ? ORDER BY project_id, citation_id`,
          )
          .bind(tenantId, sourceId),
      ),

    snapshotByHash: (tenantId, sourceId, sha256) =>
      db
        .prepare(
          `SELECT id, provider, snapshot_sha256, response_sha256, payload_store, payload_ref,
                  payload_note, created_at
           FROM source_metadata_snapshots WHERE tenant_id = ? AND source_id = ? AND snapshot_sha256 = ?`,
        )
        .bind(tenantId, sourceId, sha256)
        .first<SnapshotRow>(),
    snapshots: (tenantId, sourceId) =>
      all<SnapshotRow>(
        db
          .prepare(
            `SELECT id, provider, snapshot_sha256, response_sha256, payload_store, payload_ref,
                    payload_note, created_at
             FROM source_metadata_snapshots WHERE tenant_id = ? AND source_id = ?
             ORDER BY created_at, id`,
          )
          .bind(tenantId, sourceId),
      ),
    insertSnapshot: (tenantId, sourceId, r) =>
      w(
        db
          .prepare(
            `INSERT INTO source_metadata_snapshots
               (id, tenant_id, source_id, provider, snapshot_sha256, snapshot_canonical,
                response_sha256, payload_store, payload_ref, payload_note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            r.id,
            tenantId,
            sourceId,
            r.provider,
            r.snapshot_sha256,
            r.snapshot_canonical,
            r.response_sha256,
            r.payload_store,
            r.payload_ref,
            r.payload_note,
          ),
      ),
    insertBlob: (tenantId, sha256, bytes) =>
      w(
        db
          .prepare(
            `INSERT OR IGNORE INTO provider_payload_blobs (tenant_id, sha256, byte_length, bytes)
             VALUES (?, ?, ?, ?)`,
          )
          .bind(tenantId, sha256, bytes.byteLength, bytes),
      ),
    async blob(tenantId, sha256) {
      const row = await db
        .prepare("SELECT bytes FROM provider_payload_blobs WHERE tenant_id = ? AND sha256 = ?")
        .bind(tenantId, sha256)
        .first<{ bytes: ArrayBuffer | number[] }>();
      if (!row) return null;
      return row.bytes instanceof ArrayBuffer
        ? new Uint8Array(row.bytes)
        : Uint8Array.from(row.bytes);
    },

    latestResult: (tenantId, sourceId) =>
      db
        .prepare(
          `SELECT id, snapshot_id, state, confidence_bp, components, reason, failure_reason,
                  verifier_version, trigger, created_at
           FROM source_verification_results WHERE tenant_id = ? AND source_id = ?
           ORDER BY created_at DESC, rowid DESC LIMIT 1`,
        )
        .bind(tenantId, sourceId)
        .first<ResultRow>(),
    async lastAnsweredAt(tenantId, sourceId) {
      const row = await db
        .prepare(
          `SELECT MAX(created_at) AS last FROM source_verification_results
           WHERE tenant_id = ? AND source_id = ? AND failure_reason IS NULL`,
        )
        .bind(tenantId, sourceId)
        .first<{ last: string | null }>();
      return row?.last ?? null;
    },
    results: (tenantId, sourceId, limit) =>
      all<ResultRow>(
        db
          .prepare(
            `SELECT id, snapshot_id, state, confidence_bp, components, reason, failure_reason,
                    verifier_version, trigger, created_at
             FROM source_verification_results WHERE tenant_id = ? AND source_id = ?
             ORDER BY created_at, rowid LIMIT ?`,
          )
          .bind(tenantId, sourceId, limit),
      ),
    insertResult: (tenantId, sourceId, r) =>
      w(
        db
          .prepare(
            `INSERT INTO source_verification_results
               (id, tenant_id, source_id, snapshot_id, state, confidence_bp, components, reason,
                failure_reason, verifier_version, trigger, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            r.id,
            tenantId,
            sourceId,
            r.snapshot_id,
            r.state,
            r.confidence_bp,
            r.components,
            r.reason,
            r.failure_reason,
            r.verifier_version,
            r.trigger,
            r.created_at,
          ),
      ),

    latestStatus: (tenantId, sourceId) =>
      db
        .prepare(
          `SELECT seq, state, previous_state, result_id, created_at FROM source_status_events
           WHERE tenant_id = ? AND source_id = ? ORDER BY seq DESC LIMIT 1`,
        )
        .bind(tenantId, sourceId)
        .first<StatusRow>(),
    statusHistory: (tenantId, sourceId) =>
      all<StatusRow>(
        db
          .prepare(
            `SELECT seq, state, previous_state, result_id, created_at FROM source_status_events
             WHERE tenant_id = ? AND source_id = ? ORDER BY seq`,
          )
          .bind(tenantId, sourceId),
      ),
    insertStatus: (tenantId, sourceId, r) =>
      w(
        db
          .prepare(
            `INSERT INTO source_status_events
               (tenant_id, source_id, seq, state, previous_state, result_id, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(tenantId, sourceId, r.seq, r.state, r.previous_state, r.result_id, r.created_at),
      ),

    stale: (nowIso, limit) =>
      all<StaleSource>(
        db
          .prepare(
            `SELECT s.tenant_id, s.id AS source_id FROM sources s
             LEFT JOIN (SELECT source_id, MAX(created_at) AS last FROM source_verification_results
                        WHERE failure_reason IS NULL GROUP BY source_id) r ON r.source_id = s.id
             WHERE r.last IS NULL
                OR strftime('%s', r.last) + s.refresh_after_seconds <= strftime('%s', ?)
             ORDER BY r.last LIMIT ?`,
          )
          .bind(nowIso, limit),
      ),

    async providerCallsSince(provider, sinceMs) {
      const row = await db
        .prepare("SELECT COUNT(*) AS n FROM provider_calls WHERE provider = ? AND called_at >= ?")
        .bind(provider, sinceMs)
        .first<{ n: number }>();
      return row?.n ?? 0;
    },
    insertProviderCall: (provider, atMs) =>
      w(
        db
          .prepare("INSERT INTO provider_calls (provider, called_at) VALUES (?, ?)")
          .bind(provider, atMs),
      ),
  };
}
