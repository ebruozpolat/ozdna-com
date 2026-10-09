// D1 implementations of the repository interfaces. Every statement that touches tenant
// data has `tenant_id = ?` bound from the caller's auth context.

import type { PublicKeyRecord, StoredEvent } from "@ozdna/provenance-schema";
import type { ArtifactRow, CheckpointRow, EventRow, ProjectRow, Stores, Write } from "./stores.js";

const w = (s: D1PreparedStatement) => s as Write;

export function d1Stores(db: D1Database): Stores {
  return {
    uow: {
      async commit(writes) {
        if (writes.length > 0) await db.batch([...writes]);
      },
    },

    tenants: {
      async createWithKey(r) {
        await db.batch([
          db.prepare("INSERT INTO tenants (id, name) VALUES (?, ?)").bind(r.tenantId, r.name),
          db
            .prepare(
              `INSERT INTO service_keys (id, tenant_id, service_id, key_hash, key_prefix, scopes)
               VALUES (?, ?, ?, ?, ?, ?)`,
            )
            .bind(r.keyId, r.tenantId, r.serviceId, r.keyHash, r.keyPrefix, r.scopes.join(" ")),
        ]);
      },
    },

    projects: {
      insert: (tenantId, row) =>
        w(
          db
            .prepare("INSERT INTO projects (id, tenant_id, external_ref) VALUES (?, ?, ?)")
            .bind(row.id, tenantId, row.externalRef),
        ),
      get: (tenantId, projectId) =>
        db
          .prepare(
            "SELECT id, external_ref, created_at FROM projects WHERE tenant_id = ? AND id = ? LIMIT 1",
          )
          .bind(tenantId, projectId)
          .first<ProjectRow>(),
      async list(tenantId, { limit, afterId }) {
        const r = await db
          .prepare(
            `SELECT id, external_ref, created_at FROM projects
             WHERE tenant_id = ? AND id > ? ORDER BY id LIMIT ?`,
          )
          .bind(tenantId, afterId ?? "", limit)
          .all<ProjectRow>();
        return r.results ?? [];
      },
    },

    events: {
      head: (tenantId, projectId) =>
        db
          .prepare(
            `SELECT seq, canonical FROM events WHERE tenant_id = ? AND project_id = ?
             ORDER BY seq DESC LIMIT 1`,
          )
          .bind(tenantId, projectId)
          .first<EventRow>(),
      getBySeq: (tenantId, projectId, seq) =>
        db
          .prepare(
            "SELECT seq, canonical FROM events WHERE tenant_id = ? AND project_id = ? AND seq = ? LIMIT 1",
          )
          .bind(tenantId, projectId, seq)
          .first<EventRow>(),
      async list(tenantId, projectId, { afterSeq, limit }) {
        const r = await db
          .prepare(
            `SELECT seq, canonical FROM events WHERE tenant_id = ? AND project_id = ? AND seq > ?
             ORDER BY seq LIMIT ?`,
          )
          .bind(tenantId, projectId, afterSeq, limit)
          .all<EventRow>();
        return r.results ?? [];
      },
      insert: (tenantId, e: StoredEvent, canonical) =>
        w(
          db
            .prepare(
              `INSERT INTO events (tenant_id, project_id, seq, event_id, type, artifact_id,
                                   event_hash, canonical, recorded_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              tenantId,
              e.project_id,
              e.seq,
              e.event_id,
              e.type,
              e.artifact_id,
              e.event_hash,
              canonical,
              e.recorded_at,
            ),
        ),
    },

    artifacts: {
      insert: (tenantId, projectId, a) =>
        w(
          db
            .prepare(
              `INSERT INTO artifacts (id, tenant_id, project_id, kind, content_sha256, byte_length,
                                      media_type, registered_seq)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              a.id,
              tenantId,
              projectId,
              a.kind,
              a.content_sha256,
              a.byte_length,
              a.media_type,
              a.registered_seq,
            ),
        ),
      get: (tenantId, projectId, artifactId) =>
        db
          .prepare(
            `SELECT id, kind, content_sha256, byte_length, media_type, registered_seq FROM artifacts
             WHERE tenant_id = ? AND project_id = ? AND id = ? LIMIT 1`,
          )
          .bind(tenantId, projectId, artifactId)
          .first<ArtifactRow>(),
    },

    idempotency: {
      get: (tenantId, projectId, key) =>
        db
          .prepare(
            `SELECT request_hash, seq FROM idempotency_keys
             WHERE tenant_id = ? AND project_id = ? AND key = ? LIMIT 1`,
          )
          .bind(tenantId, projectId, key)
          .first<{ request_hash: string; seq: number }>(),
      insert: (tenantId, projectId, key, requestHash, seq) =>
        w(
          db
            .prepare(
              `INSERT INTO idempotency_keys (tenant_id, project_id, key, request_hash, seq)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(tenantId, projectId, key, requestHash, seq),
        ),
    },

    keys: {
      get: (keyId) =>
        db
          .prepare(
            "SELECT key_id, algorithm, public_key, status, valid_from, valid_to, revoked_at FROM signing_keys WHERE key_id = ? LIMIT 1",
          )
          .bind(keyId)
          .first<PublicKeyRecord>(),
      active: () =>
        db
          .prepare(
            "SELECT key_id, algorithm, public_key, status, valid_from, valid_to, revoked_at FROM signing_keys WHERE status = 'active' LIMIT 1",
          )
          .first<PublicKeyRecord>(),
      async rotateTo(key, at) {
        // Retire first: the partial unique index allows only one active key at a time.
        await db.batch([
          db
            .prepare(
              "UPDATE signing_keys SET status = 'retired', valid_to = ? WHERE status = 'active'",
            )
            .bind(at),
          db
            .prepare(
              `INSERT INTO signing_keys (key_id, algorithm, public_key, status, valid_from)
               VALUES (?, 'Ed25519', ?, 'active', ?)`,
            )
            .bind(key.key_id, key.public_key, at),
        ]);
      },
      async revoke(keyId, at) {
        const r = await db
          .prepare(
            "UPDATE signing_keys SET status = 'revoked', revoked_at = ? WHERE key_id = ? AND status != 'revoked'",
          )
          .bind(at, keyId)
          .run();
        return (r.meta.changes ?? 0) > 0;
      },
    },

    checkpoints: {
      latest: (tenantId, projectId) =>
        db
          .prepare(
            `SELECT head_seq, body, digest, key_id, signature FROM checkpoints
             WHERE tenant_id = ? AND project_id = ? ORDER BY head_seq DESC LIMIT 1`,
          )
          .bind(tenantId, projectId)
          .first<CheckpointRow>(),
      insert: (tenantId, projectId, r) =>
        w(
          db
            .prepare(
              `INSERT INTO checkpoints (tenant_id, project_id, head_seq, head_hash, digest, body,
                                        key_id, signature, issued_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .bind(
              tenantId,
              projectId,
              r.head_seq,
              r.head_hash,
              r.digest,
              r.body,
              r.key_id,
              r.signature,
              r.issued_at,
            ),
        ),
    },
  };
}
