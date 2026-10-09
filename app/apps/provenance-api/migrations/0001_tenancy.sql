-- 0001_tenancy.sql — research-provenance database (NOT the image DB).
-- Spec: docs/academic-moat/IMPLEMENTATION_PLAN.md Phase 2; ADR-003.
-- Conventions: TEXT ISO-8601 UTC timestamps with ms; prefixed random TEXT ids.

PRAGMA foreign_keys = ON;

CREATE TABLE tenants (
  id          TEXT PRIMARY KEY,                    -- ten_<random>
  name        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- A calling platform (e.g. the Academic Platform) authenticates with a service key.
-- service_id is what ends up in every event's actor.asserted_by.
CREATE TABLE service_keys (
  id          TEXT PRIMARY KEY,                    -- skey_<random>
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  service_id  TEXT NOT NULL,                       -- svc_<random>
  key_hash    TEXT NOT NULL UNIQUE,                -- sha256 hex of the full secret; secret never stored
  key_prefix  TEXT NOT NULL,                       -- first chars, for display
  scopes      TEXT NOT NULL,                       -- space-separated, e.g. "events:append events:read"
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at  TEXT
);
CREATE INDEX idx_service_keys_tenant ON service_keys(tenant_id);

CREATE TABLE projects (
  id            TEXT PRIMARY KEY,                  -- prj_<random>
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  external_ref  TEXT NOT NULL,                     -- the platform's own project id
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (tenant_id, external_ref)
);
CREATE INDEX idx_projects_tenant ON projects(tenant_id, created_at);

-- Projects are immutable once created.
CREATE TRIGGER projects_no_update BEFORE UPDATE ON projects
BEGIN SELECT RAISE(ABORT, 'projects are immutable'); END;
CREATE TRIGGER projects_no_delete BEFORE DELETE ON projects
BEGIN SELECT RAISE(ABORT, 'projects are immutable'); END;
