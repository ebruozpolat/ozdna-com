// Drizzle typed schema — the TYPED accessor for apps/api queries.
// Columns/constraints track plan/04-MVP-SPEC.md §5 (the canonical DDL).
//
// IMPORTANT (plan/04 §4 note + ledger A5): the CANONICAL migration is the hand-written
// `app/migrations/0001_init.sql` (verbatim 04 §5), NOT drizzle-kit-generated — because
// drizzle-kit cannot emit `COLLATE NOCASE` on the email UNIQUE columns (case-insensitive
// email identity is required by 04 §5) and drops it on generate. This file is kept in sync
// with that SQL by hand and used only for type-safe queries. `drizzle.config.ts` can still
// generate a REFERENCE migration into `migrations-drizzle/` to diff, but it is not applied.

import { sql } from "drizzle-orm";
import { blob, check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const nowUtcMs = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull().unique(), // NOTE: 04 §5 adds COLLATE NOCASE (migration only)
    emailVerifiedAt: text("email_verified_at"),
    displayName: text("display_name"),
    plan: text("plan").notNull().default("free"),
    isFlagship: integer("is_flagship").notNull().default(0),
    billingCustomerId: text("billing_customer_id"),
    billingSubId: text("billing_sub_id"),
    planRenewsAt: text("plan_renews_at"),
    segment: text("segment"),
    createdAt: text("created_at").notNull().default(nowUtcMs),
    deletedAt: text("deleted_at"),
  },
  (t) => [check("users_plan_ck", sql`${t.plan} in ('free','starter','growth','scale')`)],
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull().references(() => users.id),
    name: text("name").notNull().default("default"),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    mode: text("mode").notNull().default("live"),
    createdAt: text("created_at").notNull().default(nowUtcMs),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [
    check("api_keys_mode_ck", sql`${t.mode} in ('live','test')`),
    index("idx_api_keys_user").on(t.userId),
  ],
);

export const anchorBatches = sqliteTable(
  "anchor_batches",
  {
    id: text("id").primaryKey(),
    chain: text("chain").notNull().default("base-mainnet"),
    merkleRoot: text("merkle_root"),
    recordCount: integer("record_count").notNull().default(0),
    status: text("status").notNull().default("pending"),
    txHash: text("tx_hash"),
    blockNumber: integer("block_number"),
    gasWei: text("gas_wei"),
    createdAt: text("created_at").notNull().default(nowUtcMs),
    confirmedAt: text("confirmed_at"),
  },
  (t) => [
    check("anchor_batches_status_ck", sql`${t.status} in ('pending','submitted','confirmed','failed')`),
    index("idx_batches_status").on(t.status),
  ],
);

export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    kind: text("kind").notNull(),
    source: text("source").notNull(),
    sha256: text("sha256").notNull(),
    phash64: integer("phash64").notNull(), // signed 64-bit int (03 §2.3)
    pdq256: blob("pdq256"), // 32-byte BLOB, nullable
    band0: integer("band0").notNull(),
    band1: integer("band1").notNull(),
    band2: integer("band2").notNull(),
    band3: integer("band3").notNull(),
    title: text("title"),
    manifestKey: text("manifest_key"),
    manifestSha256: text("manifest_sha256"),
    fileMime: text("file_mime").notNull(),
    fileBytes: integer("file_bytes"),
    thumbKey: text("thumb_key"),
    status: text("status").notNull().default("registered"),
    moderationStatus: text("moderation_status").notNull().default("active"),
    anchorBatchId: text("anchor_batch_id").references(() => anchorBatches.id),
    leafIndex: integer("leaf_index"),
    isTest: integer("is_test").notNull().default(0),
    createdAt: text("created_at").notNull().default(nowUtcMs),
    anchoredAt: text("anchored_at"),
  },
  (t) => [
    check("records_kind_ck", sql`${t.kind} in ('ai_generated','claimed_capture','unspecified')`),
    check("records_source_ck", sql`${t.source} in ('web_sign','api_mark','api_registration')`),
    check("records_status_ck", sql`${t.status} in ('registered','anchoring','anchored','revoked')`),
    check("records_moderation_ck", sql`${t.moderationStatus} in ('active','disputed','withdrawn')`),
    uniqueIndex("idx_records_sha256").on(t.sha256).where(sql`is_test = 0`),
    index("idx_records_band0").on(t.band0).where(sql`is_test = 0`),
    index("idx_records_band1").on(t.band1).where(sql`is_test = 0`),
    index("idx_records_band2").on(t.band2).where(sql`is_test = 0`),
    index("idx_records_band3").on(t.band3).where(sql`is_test = 0`),
    index("idx_records_user").on(t.userId, t.createdAt),
    index("idx_records_batch").on(t.anchorBatchId),
    index("idx_records_pending_anchor").on(t.status).where(sql`status = 'registered' AND is_test = 0`),
  ],
);

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id").notNull().references(() => users.id),
    apiKeyId: text("api_key_id").references(() => apiKeys.id),
    eventType: text("event_type").notNull(),
    recordId: text("record_id"),
    billable: integer("billable").notNull().default(1),
    month: text("month").notNull(),
    createdAt: text("created_at").notNull().default(nowUtcMs),
  },
  (t) => [
    check("usage_events_type_ck", sql`${t.eventType} in ('mark','registration','verify_file','sign_digest')`),
    index("idx_usage_quota").on(t.userId, t.month, t.eventType, t.billable),
  ],
);

export const waitlist = sqliteTable(
  "waitlist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(), // NOTE: 04 §5 adds COLLATE NOCASE (migration only)
    segment: text("segment").notNull(),
    source: text("source"),
    locale: text("locale"),
    consentAt: text("consent_at").notNull(),
    confirmToken: text("confirm_token"),
    confirmedAt: text("confirmed_at"),
    createdAt: text("created_at").notNull().default(nowUtcMs),
    convertedUserId: text("converted_user_id").references(() => users.id),
  },
  (t) => [
    check("waitlist_segment_ck", sql`${t.segment} in ('ai_company','seller_creator','fact_checker','other')`),
    index("idx_waitlist_segment").on(t.segment),
  ],
);
