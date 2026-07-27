-- 0002_webhooks.sql — customer webhook endpoints (plan/04 §5)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id           TEXT PRIMARY KEY,                          -- whe_<ULID>
  user_id      TEXT NOT NULL REFERENCES users(id),
  url          TEXT NOT NULL,
  secret       TEXT NOT NULL,                             -- endpoint signing secret (shown once)
  description  TEXT,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  revoked_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_whe_user ON webhook_endpoints(user_id);
