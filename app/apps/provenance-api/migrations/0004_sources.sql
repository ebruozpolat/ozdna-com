-- 0004_sources.sql — Phase 4c: source verification storage (IMPLEMENTATION_PLAN.md Phase 4c).
-- Every table is tenant-scoped and append-only: a new verification, snapshot or status is a new
-- row; nothing is updated or deleted. Current state = the latest row.

PRAGMA foreign_keys = ON;

-- One row per (tenant, normalised identifier). The first submitted reference is kept for
-- refreshes (bibliographic metadata of a published work; never manuscript or claim text).
CREATE TABLE sources (
  id                     TEXT PRIMARY KEY,                    -- src_<random>
  tenant_id              TEXT NOT NULL REFERENCES tenants(id),
  scheme                 TEXT NOT NULL,
  value                  TEXT NOT NULL,
  reference_canonical    TEXT NOT NULL,                       -- ozdna-cjson/v1 CitedReference
  refresh_after_seconds  INTEGER NOT NULL CHECK (refresh_after_seconds >= 3600),
  created_at             TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, scheme, value)
);

-- Identifiers known for a source: the one submitted, plus any a provider reported.
CREATE TABLE source_identifiers (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  source_id   TEXT NOT NULL REFERENCES sources(id),
  scheme      TEXT NOT NULL,
  value       TEXT NOT NULL,
  origin      TEXT NOT NULL CHECK (origin IN ('input', 'provider')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (source_id, scheme, value)
);
CREATE INDEX idx_source_identifiers_tenant ON source_identifiers(tenant_id, scheme, value);

-- Which project cites which source, under which citation id; drives status fan-out.
-- service_id is the platform service that linked it (actor.asserted_by for system events).
CREATE TABLE project_sources (
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  project_id   TEXT NOT NULL REFERENCES projects(id),
  source_id    TEXT NOT NULL REFERENCES sources(id),
  citation_id  TEXT NOT NULL,
  service_id   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (project_id, citation_id)
);
CREATE INDEX idx_project_sources_source ON project_sources(tenant_id, source_id);

-- Raw provider payloads when no R2 bucket is bound (ADR-004 §7). Content-addressed and capped;
-- Retraction Watch-sourced entries are redacted to hashes before storage.
CREATE TABLE provider_payload_blobs (
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  sha256       TEXT NOT NULL,                                 -- of the stored (redacted) bytes
  byte_length  INTEGER NOT NULL CHECK (byte_length >= 0 AND byte_length <= 262144),
  bytes        BLOB NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, sha256)
);

-- Normalised provider metadata. snapshot_sha256 hashes the canonical normalised record, so the
-- same provider response always yields the same snapshot hash.
CREATE TABLE source_metadata_snapshots (
  id                TEXT PRIMARY KEY,                         -- snp_<random>
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  source_id         TEXT NOT NULL REFERENCES sources(id),
  provider          TEXT NOT NULL CHECK (provider IN ('crossref', 'datacite', 'doi_ra')),
  snapshot_sha256   TEXT NOT NULL,
  snapshot_canonical TEXT NOT NULL,
  response_sha256   TEXT NOT NULL,                            -- exact bytes the provider sent
  payload_store     TEXT NOT NULL CHECK (payload_store IN ('r2', 'd1', 'none')),
  payload_ref       TEXT,                                     -- R2 key or D1 blob sha256
  payload_note      TEXT,                                     -- e.g. TOO_LARGE_FOR_D1
  created_at        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, source_id, snapshot_sha256)
);

CREATE TABLE source_verification_results (
  id                TEXT PRIMARY KEY,                         -- svr_<random>
  tenant_id         TEXT NOT NULL REFERENCES tenants(id),
  source_id         TEXT NOT NULL REFERENCES sources(id),
  snapshot_id       TEXT REFERENCES source_metadata_snapshots(id),
  state             TEXT NOT NULL,
  confidence_bp     INTEGER NOT NULL CHECK (confidence_bp BETWEEN 0 AND 10000),
  components        TEXT NOT NULL,                            -- canonical JSON {name: bp}
  reason            TEXT,
  failure_reason    TEXT,
  verifier_version  TEXT NOT NULL,
  trigger           TEXT NOT NULL CHECK (trigger IN ('request', 'refresh')),
  created_at        TEXT NOT NULL
);
CREATE INDEX idx_results_source ON source_verification_results(tenant_id, source_id, created_at);

-- Status timeline: a row only when the state changes (seq 0 = first result).
CREATE TABLE source_status_events (
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  source_id       TEXT NOT NULL REFERENCES sources(id),
  seq             INTEGER NOT NULL CHECK (seq >= 0),
  state           TEXT NOT NULL,
  previous_state  TEXT,
  result_id       TEXT NOT NULL REFERENCES source_verification_results(id),
  created_at      TEXT NOT NULL,
  PRIMARY KEY (source_id, seq)                                -- concurrent writers race here
);

-- Outbound provider calls, for per-provider rate limiting of the refresh job. Not tenant data.
CREATE TABLE provider_calls (
  provider   TEXT NOT NULL CHECK (provider IN ('doi_ra', 'crossref', 'datacite')),
  called_at  INTEGER NOT NULL                                 -- epoch ms
);
CREATE INDEX idx_provider_calls ON provider_calls(provider, called_at);

CREATE TRIGGER sources_no_update BEFORE UPDATE ON sources
BEGIN SELECT RAISE(ABORT, 'sources are append-only'); END;
CREATE TRIGGER sources_no_delete BEFORE DELETE ON sources
BEGIN SELECT RAISE(ABORT, 'sources are append-only'); END;
CREATE TRIGGER source_identifiers_no_update BEFORE UPDATE ON source_identifiers
BEGIN SELECT RAISE(ABORT, 'source_identifiers are append-only'); END;
CREATE TRIGGER source_identifiers_no_delete BEFORE DELETE ON source_identifiers
BEGIN SELECT RAISE(ABORT, 'source_identifiers are append-only'); END;
CREATE TRIGGER project_sources_no_update BEFORE UPDATE ON project_sources
BEGIN SELECT RAISE(ABORT, 'project_sources are append-only'); END;
CREATE TRIGGER project_sources_no_delete BEFORE DELETE ON project_sources
BEGIN SELECT RAISE(ABORT, 'project_sources are append-only'); END;
CREATE TRIGGER provider_payload_blobs_no_update BEFORE UPDATE ON provider_payload_blobs
BEGIN SELECT RAISE(ABORT, 'provider_payload_blobs are append-only'); END;
CREATE TRIGGER provider_payload_blobs_no_delete BEFORE DELETE ON provider_payload_blobs
BEGIN SELECT RAISE(ABORT, 'provider_payload_blobs are append-only'); END;
CREATE TRIGGER snapshots_no_update BEFORE UPDATE ON source_metadata_snapshots
BEGIN SELECT RAISE(ABORT, 'source_metadata_snapshots are append-only'); END;
CREATE TRIGGER snapshots_no_delete BEFORE DELETE ON source_metadata_snapshots
BEGIN SELECT RAISE(ABORT, 'source_metadata_snapshots are append-only'); END;
CREATE TRIGGER results_no_update BEFORE UPDATE ON source_verification_results
BEGIN SELECT RAISE(ABORT, 'source_verification_results are append-only'); END;
CREATE TRIGGER results_no_delete BEFORE DELETE ON source_verification_results
BEGIN SELECT RAISE(ABORT, 'source_verification_results are append-only'); END;
CREATE TRIGGER status_events_no_update BEFORE UPDATE ON source_status_events
BEGIN SELECT RAISE(ABORT, 'source_status_events are append-only'); END;
CREATE TRIGGER status_events_no_delete BEFORE DELETE ON source_status_events
BEGIN SELECT RAISE(ABORT, 'source_status_events are append-only'); END;
CREATE TRIGGER provider_calls_no_update BEFORE UPDATE ON provider_calls
BEGIN SELECT RAISE(ABORT, 'provider_calls are append-only'); END;
