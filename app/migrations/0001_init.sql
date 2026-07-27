-- 0001_init.sql
-- Source of truth: plan/04-MVP-SPEC.md §5 (reproduced verbatim). D1 is SQLite.
-- Conventions: TEXT ISO-8601 UTC timestamps; prefixed-ULID TEXT primary keys;
-- booleans as INTEGER 0/1; `PRAGMA foreign_keys = ON` per connection.

CREATE TABLE users (
  id                  TEXT PRIMARY KEY,                    -- usr_<ULID>
  email               TEXT NOT NULL UNIQUE COLLATE NOCASE,
  email_verified_at   TEXT,
  display_name        TEXT,                                -- public on records if set
  plan                TEXT NOT NULL DEFAULT 'free'
                        CHECK (plan IN ('free','starter','growth','scale')),
  is_flagship         INTEGER NOT NULL DEFAULT 0,          -- fact-checkers: free-forever raised limits
  billing_customer_id TEXT,                                -- provider customer id (→ 02)
  billing_sub_id      TEXT,
  plan_renews_at      TEXT,
  segment             TEXT,                                -- ai_company|seller_creator|fact_checker|other
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  deleted_at          TEXT                                 -- soft delete; purge job hard-deletes after 30d
);

CREATE TABLE api_keys (
  id           TEXT PRIMARY KEY,                           -- key_<ULID>
  user_id      TEXT NOT NULL REFERENCES users(id),
  name         TEXT NOT NULL DEFAULT 'default',
  key_hash     TEXT NOT NULL UNIQUE,                       -- sha256 hex of full secret; secret never stored
  key_prefix   TEXT NOT NULL,                              -- e.g. 'ozdna_live_k8Qw' for display
  mode         TEXT NOT NULL DEFAULT 'live' CHECK (mode IN ('live','test')),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_used_at TEXT,
  revoked_at   TEXT
);
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

CREATE TABLE records (
  id               TEXT PRIMARY KEY,                       -- rec_<ULID>
  user_id          TEXT REFERENCES users(id),              -- NULL only after GDPR detach
  kind             TEXT NOT NULL
                     CHECK (kind IN ('ai_generated','claimed_capture','unspecified')),
  source           TEXT NOT NULL
                     CHECK (source IN ('web_sign','api_mark','api_registration')),
  sha256           TEXT NOT NULL,                          -- 64 hex, hash of FINAL signed/marked bytes
  phash64          INTEGER NOT NULL,                       -- OzDNA-pHash-v1 as SIGNED 64-bit int
  pdq256           BLOB,                                   -- 32 bytes; secondary confirmation hash, NULL until computed
  band0            INTEGER NOT NULL,                       -- (phash >> 48) & 0xFFFF
  band1            INTEGER NOT NULL,                       -- (phash >> 32) & 0xFFFF
  band2            INTEGER NOT NULL,                       -- (phash >> 16) & 0xFFFF
  band3            INTEGER NOT NULL,                       --  phash        & 0xFFFF
  title            TEXT,                                   -- optional, public, ≤120 chars
  manifest_key     TEXT,                                   -- R2 object key (NULL if none stored)
  manifest_sha256  TEXT,                                   -- integrity cross-check only (deliberately unindexed)
  file_mime        TEXT NOT NULL,
  file_bytes       INTEGER,
  thumb_key        TEXT,                                   -- R2 key, only if user opted in
  status           TEXT NOT NULL DEFAULT 'registered'
                     CHECK (status IN ('registered','anchoring','anchored','revoked')),
  moderation_status TEXT NOT NULL DEFAULT 'active'
                     CHECK (moderation_status IN ('active','disputed','withdrawn')),
  anchor_batch_id  TEXT REFERENCES anchor_batches(id),
  leaf_index       INTEGER,
  is_test          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  anchored_at      TEXT
);
CREATE UNIQUE INDEX idx_records_sha256 ON records(sha256) WHERE is_test = 0;
CREATE INDEX idx_records_band0 ON records(band0) WHERE is_test = 0;
CREATE INDEX idx_records_band1 ON records(band1) WHERE is_test = 0;
CREATE INDEX idx_records_band2 ON records(band2) WHERE is_test = 0;
CREATE INDEX idx_records_band3 ON records(band3) WHERE is_test = 0;
CREATE INDEX idx_records_user ON records(user_id, created_at DESC);
CREATE INDEX idx_records_batch ON records(anchor_batch_id);
CREATE INDEX idx_records_pending_anchor ON records(status) WHERE status = 'registered' AND is_test = 0;

CREATE TABLE anchor_batches (
  id            TEXT PRIMARY KEY,                          -- bat_<ULID>
  chain         TEXT NOT NULL DEFAULT 'base-mainnet',
  merkle_root   TEXT,                                      -- 0x-hex
  record_count  INTEGER NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','submitted','confirmed','failed')),
  tx_hash       TEXT,
  block_number  INTEGER,
  gas_wei       TEXT,                                      -- stringified bigint, for cost tracking
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  confirmed_at  TEXT
);
CREATE INDEX idx_batches_status ON anchor_batches(status);

CREATE TABLE usage_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users(id),
  api_key_id  TEXT REFERENCES api_keys(id),                -- NULL for web-session actions
  event_type  TEXT NOT NULL
                CHECK (event_type IN ('mark','registration','verify_file','sign_digest')),
  record_id   TEXT,
  billable    INTEGER NOT NULL DEFAULT 1,                  -- 0 for test mode / flagship
  month       TEXT NOT NULL,                               -- 'YYYY-MM' written by app (quota key)
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_usage_quota ON usage_events(user_id, month, event_type, billable);

CREATE TABLE waitlist (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  email              TEXT NOT NULL UNIQUE COLLATE NOCASE,
  segment            TEXT NOT NULL
                       CHECK (segment IN ('ai_company','seller_creator','fact_checker','other')),
  source             TEXT,                                 -- utm/referrer blob
  locale             TEXT,                                 -- 'en'|'tr'|…
  consent_at         TEXT NOT NULL,                        -- KVKK/GDPR explicit consent timestamp
  confirm_token      TEXT,                                 -- double-opt-in token; cleared once confirmed
  confirmed_at       TEXT,                                 -- set when the recipient clicks the confirmation link
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  converted_user_id  TEXT REFERENCES users(id)
);
CREATE INDEX idx_waitlist_segment ON waitlist(segment);
