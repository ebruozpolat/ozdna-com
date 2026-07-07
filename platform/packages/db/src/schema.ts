import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan").notNull().default("developer"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  workspaceId: text("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey(),
  orgId: text("org_id").references(() => organizations.id),
  name: text("name").notNull(),
  description: text("description"),
  system: integer("system", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
});

export const rolePermissions = sqliteTable("role_permissions", {
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissions.id),
});

export const orgMembers = sqliteTable("org_members", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const workspaceMembers = sqliteTable("workspace_members", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  keyPrefix: text("key_prefix").notNull(),
  environment: text("environment").notNull(),
  rateLimitPerMin: integer("rate_limit_per_min").notNull().default(10),
  monthlyQuota: integer("monthly_quota").notNull().default(1000),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
});

export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: integer("version").notNull(),
  mode: text("mode").notNull(),
  workflow: text("workflow").notNull(),
  content: text("content").notNull(),
  hash: text("hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ragCorpora = sqliteTable("rag_corpora", {
  id: text("id").primaryKey(),
  orgId: text("org_id"),
  projectId: text("project_id"),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  description: text("description"),
  documentCount: integer("document_count").notNull().default(0),
  chunkCount: integer("chunk_count").notNull().default(0),
  embeddingModel: text("embedding_model").notNull().default("local-bow"),
  freshnessPolicyDays: integer("freshness_policy_days").notNull().default(30),
  status: text("status").notNull().default("active"),
  lastIngestedAt: integer("last_ingested_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ragDocuments = sqliteTable("rag_documents", {
  id: text("id").primaryKey(),
  corpusId: text("corpus_id")
    .notNull()
    .references(() => ragCorpora.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  metadata: text("metadata"),
  chunkCount: integer("chunk_count").notNull().default(0),
  ingestedAt: integer("ingested_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ragChunks = sqliteTable("rag_chunks", {
  id: text("id").primaryKey(),
  corpusId: text("corpus_id")
    .notNull()
    .references(() => ragCorpora.id),
  documentId: text("document_id")
    .notNull()
    .references(() => ragDocuments.id),
  content: text("content").notNull(),
  chunkIndex: integer("chunk_index").notNull(),
  embedding: text("embedding").notNull(),
  tokenCount: integer("token_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const ragIngestionJobs = sqliteTable("rag_ingestion_jobs", {
  id: text("id").primaryKey(),
  corpusId: text("corpus_id")
    .notNull()
    .references(() => ragCorpora.id),
  status: text("status").notNull(),
  documentsProcessed: integer("documents_processed").notNull().default(0),
  chunksCreated: integer("chunks_created").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  completedAt: integer("completed_at", { mode: "timestamp" }),
});

export const ragEvalRuns = sqliteTable("rag_eval_runs", {
  id: text("id").primaryKey(),
  corpusId: text("corpus_id")
    .notNull()
    .references(() => ragCorpora.id),
  orgId: text("org_id").notNull(),
  query: text("query").notNull(),
  expectedChunkId: text("expected_chunk_id"),
  topChunkId: text("top_chunk_id"),
  topScore: real("top_score"),
  hit: integer("hit", { mode: "boolean" }),
  retrievalMethod: text("retrieval_method").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const usageEvents = sqliteTable("usage_events", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  orgId: text("org_id").notNull(),
  projectId: text("project_id").notNull(),
  apiKeyId: text("api_key_id").notNull(),
  endpoint: text("endpoint").notNull(),
  workflowId: text("workflow_id").notNull(),
  step: text("step").notNull(),
  model: text("model").notNull(),
  mode: text("mode").notNull(),
  tokensIn: integer("tokens_in").notNull().default(0),
  tokensOut: integer("tokens_out").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  orgId: text("org_id").notNull(),
  apiKeyId: text("api_key_id").notNull(),
  action: text("action").notNull(),
  resource: text("resource").notNull(),
  metadata: text("metadata"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const billingAccounts = sqliteTable("billing_accounts", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id)
    .unique(),
  plan: text("plan").notNull(),
  monthlyQuota: integer("monthly_quota").notNull(),
  usedThisMonth: integer("used_this_month").notNull().default(0),
  periodStart: integer("period_start", { mode: "timestamp" }).notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const routingRules = sqliteTable("routing_rules", {
  id: text("id").primaryKey(),
  workflow: text("workflow").notNull(),
  mode: text("mode").notNull(),
  primaryModel: text("primary_model").notNull(),
  fallbackModel: text("fallback_model"),
  maxCostUsd: real("max_cost_usd"),
  priority: integer("priority").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});
