-- 0002_events.sql — append-only event chain, artifacts, idempotency keys.
-- The chain itself is the canonical JSON in events.canonical; the other columns are
-- denormalised for lookup and are never trusted by /verify.

PRAGMA foreign_keys = ON;

CREATE TABLE events (
  tenant_id    TEXT NOT NULL REFERENCES tenants(id),
  project_id   TEXT NOT NULL REFERENCES projects(id),
  seq          INTEGER NOT NULL CHECK (seq >= 0),
  event_id     TEXT NOT NULL,
  type         TEXT NOT NULL,
  artifact_id  TEXT,
  event_hash   TEXT NOT NULL,
  canonical    TEXT NOT NULL,                      -- ozdna-cjson/v1 of the stored event
  recorded_at  TEXT NOT NULL,
  PRIMARY KEY (project_id, seq),                   -- concurrent appends race here
  UNIQUE (project_id, event_id)
);
CREATE INDEX idx_events_tenant ON events(tenant_id, project_id, seq);

CREATE TABLE artifacts (
  id              TEXT PRIMARY KEY,                -- art_<random>
  tenant_id       TEXT NOT NULL REFERENCES tenants(id),
  project_id      TEXT NOT NULL REFERENCES projects(id),
  kind            TEXT NOT NULL,
  content_sha256  TEXT NOT NULL,
  byte_length     INTEGER NOT NULL,
  media_type      TEXT NOT NULL,
  registered_seq  INTEGER NOT NULL,                -- seq of its artifact.registered event
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_artifacts_project ON artifacts(tenant_id, project_id);

CREATE TABLE idempotency_keys (
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  project_id    TEXT NOT NULL REFERENCES projects(id),
  key           TEXT NOT NULL,
  request_hash  TEXT NOT NULL,                     -- sha256 of the canonical request body
  seq           INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (tenant_id, project_id, key)
);

-- Append-only: state changes are new events, never edits.
CREATE TRIGGER events_no_update BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TRIGGER events_no_delete BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT, 'events are append-only'); END;
CREATE TRIGGER artifacts_no_update BEFORE UPDATE ON artifacts
BEGIN SELECT RAISE(ABORT, 'artifacts are append-only'); END;
CREATE TRIGGER artifacts_no_delete BEFORE DELETE ON artifacts
BEGIN SELECT RAISE(ABORT, 'artifacts are append-only'); END;
CREATE TRIGGER idempotency_no_update BEFORE UPDATE ON idempotency_keys
BEGIN SELECT RAISE(ABORT, 'idempotency keys are append-only'); END;
CREATE TRIGGER idempotency_no_delete BEFORE DELETE ON idempotency_keys
BEGIN SELECT RAISE(ABORT, 'idempotency keys are append-only'); END;
