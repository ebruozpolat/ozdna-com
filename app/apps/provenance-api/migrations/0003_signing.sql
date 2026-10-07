-- 0003_signing.sql — public-key registry and signed checkpoints (Phase 3, ADR-007).
-- Private keys never touch this database; only the signer Worker holds one.

PRAGMA foreign_keys = ON;

CREATE TABLE signing_keys (
  key_id      TEXT PRIMARY KEY,                    -- ed25519-<32 hex of sha256(public key)>
  algorithm   TEXT NOT NULL CHECK (algorithm = 'Ed25519'),
  public_key  TEXT NOT NULL UNIQUE,                -- raw 32 bytes, base64url
  status      TEXT NOT NULL CHECK (status IN ('active','retired','revoked')),
  valid_from  TEXT NOT NULL,
  valid_to    TEXT,                                -- set when retired by rotation
  revoked_at  TEXT,                                -- set when revoked (compromise)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
-- At most one key signs new checkpoints.
CREATE UNIQUE INDEX one_active_signing_key ON signing_keys(status) WHERE status = 'active';

CREATE TRIGGER signing_keys_no_delete BEFORE DELETE ON signing_keys
BEGIN SELECT RAISE(ABORT, 'signing keys are never deleted'); END;
CREATE TRIGGER signing_keys_identity BEFORE UPDATE OF key_id, algorithm, public_key, valid_from, created_at ON signing_keys
BEGIN SELECT RAISE(ABORT, 'signing key identity is immutable'); END;
CREATE TRIGGER signing_keys_revoked_final BEFORE UPDATE ON signing_keys WHEN OLD.status = 'revoked'
BEGIN SELECT RAISE(ABORT, 'a revoked key is final'); END;
CREATE TRIGGER signing_keys_transition BEFORE UPDATE OF status ON signing_keys
WHEN NOT (OLD.status = NEW.status
          OR (OLD.status = 'active' AND NEW.status IN ('retired', 'revoked'))
          OR (OLD.status = 'retired' AND NEW.status = 'revoked'))
BEGIN SELECT RAISE(ABORT, 'invalid signing key status transition'); END;
CREATE TRIGGER signing_keys_valid_to_once BEFORE UPDATE OF valid_to ON signing_keys
WHEN OLD.valid_to IS NOT NULL
BEGIN SELECT RAISE(ABORT, 'valid_to is set once'); END;

CREATE TABLE checkpoints (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id),
  project_id  TEXT NOT NULL REFERENCES projects(id),
  head_seq    INTEGER NOT NULL,
  head_hash   TEXT NOT NULL,
  digest      TEXT NOT NULL,
  body        TEXT NOT NULL,                       -- ozdna-cjson/v1 of the checkpoint body
  key_id      TEXT NOT NULL REFERENCES signing_keys(key_id),
  signature   TEXT NOT NULL,                       -- base64url Ed25519 over the checkpoint preimage
  issued_at   TEXT NOT NULL,
  PRIMARY KEY (project_id, head_seq)
);
CREATE INDEX idx_checkpoints_tenant ON checkpoints(tenant_id, project_id, head_seq);

CREATE TRIGGER checkpoints_no_update BEFORE UPDATE ON checkpoints
BEGIN SELECT RAISE(ABORT, 'checkpoints are append-only'); END;
CREATE TRIGGER checkpoints_no_delete BEFORE DELETE ON checkpoints
BEGIN SELECT RAISE(ABORT, 'checkpoints are append-only'); END;
