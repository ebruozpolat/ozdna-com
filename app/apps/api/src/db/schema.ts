/**
 * Drizzle schema — TypeScript twin of plan/04-MVP-SPEC.md §5 / migrations/0001_init.sql.
 *
 * Applied migration source of truth remains `migrations/0001_init.sql` (wrangler D1).
 * `npm run db:generate` writes to `apps/api/drizzle/` for diff checks only — do NOT
 * overwrite 0001 casually. See drizzle.config.ts and TOOLCHAIN.md.
 */

import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerifiedAt: text("email_verified_at"),
  displayName: text("display_name"),
  plan: text("plan").notNull().default("free"),
  isFlagship: integer("is_flagship").notNull().default(0),
  billingCustomerId: text("billing_customer_id"),
  billingSubId: text("billing_sub_id"),
  planRenewsAt: text("plan_renews_at"),
  segment: text("segment"),
  createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  deletedAt: text("deleted_at"),
});

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull().default("default"),
    keyHash: text("key_hash").notNull().unique(),
    keyPrefix: text("key_prefix").notNull(),
    mode: text("mode").notNull().default("live"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    lastUsedAt: text("last_used_at"),
    revokedAt: text("revoked_at"),
  },
  (t) => [index("idx_api_keys_user").on(t.userId)],
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
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    confirmedAt: text("confirmed_at"),
  },
  (t) => [index("idx_batches_status").on(t.status)],
);

export const records = sqliteTable(
  "records",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => users.id),
    kind: text("kind").notNull(),
    source: text("source").notNull(),
    sha256: text("sha256").notNull(),
    phash64: integer("phash64").notNull(),
    pdq256: blob("pdq256"),
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
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    anchoredAt: text("anchored_at"),
  },
  (t) => [
    uniqueIndex("idx_records_sha256").on(t.sha256),
    index("idx_records_band0").on(t.band0),
    index("idx_records_band1").on(t.band1),
    index("idx_records_band2").on(t.band2),
    index("idx_records_band3").on(t.band3),
    index("idx_records_user").on(t.userId, t.createdAt),
    index("idx_records_batch").on(t.anchorBatchId),
  ],
);

export const usageEvents = sqliteTable(
  "usage_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    apiKeyId: text("api_key_id").references(() => apiKeys.id),
    eventType: text("event_type").notNull(),
    recordId: text("record_id"),
    billable: integer("billable").notNull().default(1),
    month: text("month").notNull(),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (t) => [index("idx_usage_quota").on(t.userId, t.month, t.eventType, t.billable)],
);

export const waitlist = sqliteTable(
  "waitlist",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    email: text("email").notNull().unique(),
    segment: text("segment").notNull(),
    source: text("source"),
    locale: text("locale"),
    consentAt: text("consent_at").notNull(),
    confirmToken: text("confirm_token"),
    confirmedAt: text("confirmed_at"),
    createdAt: text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    convertedUserId: text("converted_user_id").references(() => users.id),
  },
  (t) => [index("idx_waitlist_segment").on(t.segment)],
);
