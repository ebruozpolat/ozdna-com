import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export * from "./schema.js";

const DEFAULT_PATH = process.env.OZDNA_DB_PATH ?? new URL("../../../data/ozdna.db", import.meta.url).pathname;

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDbPath(): string {
  return DEFAULT_PATH;
}

export function createDb(path = DEFAULT_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export function getDb() {
  if (!_db) _db = createDb();
  return _db;
}

export function initSchema(db = getDb()) {
  const sqlite = (db as unknown as { session: { client: Database.Database } }).session.client;
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL DEFAULT 'developer',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id),
      org_id TEXT NOT NULL REFERENCES organizations(id), name TEXT NOT NULL,
      key_hash TEXT NOT NULL UNIQUE, key_prefix TEXT NOT NULL, environment TEXT NOT NULL,
      rate_limit_per_min INTEGER NOT NULL DEFAULT 10, monthly_quota INTEGER NOT NULL DEFAULT 1000,
      active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, last_used_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL, mode TEXT NOT NULL,
      workflow TEXT NOT NULL, content TEXT NOT NULL, hash TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rag_corpora (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, mode TEXT NOT NULL, description TEXT,
      document_count INTEGER NOT NULL DEFAULT 0, last_ingested_at INTEGER, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rag_documents (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL REFERENCES rag_corpora(id),
      title TEXT NOT NULL, content TEXT NOT NULL, metadata TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS usage_events (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL, org_id TEXT NOT NULL, project_id TEXT NOT NULL,
      api_key_id TEXT NOT NULL, endpoint TEXT NOT NULL, workflow_id TEXT NOT NULL, step TEXT NOT NULL,
      model TEXT NOT NULL, mode TEXT NOT NULL, tokens_in INTEGER NOT NULL DEFAULT 0,
      tokens_out INTEGER NOT NULL DEFAULT 0, cost_usd REAL NOT NULL DEFAULT 0,
      latency_ms INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL, org_id TEXT NOT NULL, api_key_id TEXT NOT NULL,
      action TEXT NOT NULL, resource TEXT NOT NULL, metadata TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS billing_accounts (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL UNIQUE REFERENCES organizations(id),
      plan TEXT NOT NULL, monthly_quota INTEGER NOT NULL, used_this_month INTEGER NOT NULL DEFAULT 0,
      period_start INTEGER NOT NULL, stripe_customer_id TEXT, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY, workflow TEXT NOT NULL, mode TEXT NOT NULL,
      primary_model TEXT NOT NULL, fallback_model TEXT, max_cost_usd REAL,
      priority INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1
    );
  `);
  runPhase2Migrations(sqlite);
  runIamMigrations(sqlite);
}

function runIamMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
      name TEXT NOT NULL, slug TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY, org_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL, description TEXT, system INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY, key TEXT NOT NULL UNIQUE, description TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL REFERENCES roles(id),
      permission_id TEXT NOT NULL REFERENCES permissions(id),
      PRIMARY KEY (role_id, permission_id)
    );
    CREATE TABLE IF NOT EXISTS org_members (
      id TEXT PRIMARY KEY, org_id TEXT NOT NULL REFERENCES organizations(id),
      user_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id),
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id),
      user_id TEXT NOT NULL REFERENCES users(id), role_id TEXT NOT NULL REFERENCES roles(id),
      created_at INTEGER NOT NULL
    );
  `);

  const projectCols = sqlite.prepare("PRAGMA table_info(projects)").all() as Array<{ name: string }>;
  if (!projectCols.some((c) => c.name === "workspace_id")) {
    try {
      sqlite.exec("ALTER TABLE projects ADD COLUMN workspace_id TEXT REFERENCES workspaces(id)");
    } catch { /* exists */ }
  }
}

function runPhase2Migrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL REFERENCES rag_corpora(id),
      document_id TEXT NOT NULL REFERENCES rag_documents(id),
      content TEXT NOT NULL, chunk_index INTEGER NOT NULL,
      embedding TEXT NOT NULL, token_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_corpus ON rag_chunks(corpus_id);
    CREATE TABLE IF NOT EXISTS rag_ingestion_jobs (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL REFERENCES rag_corpora(id),
      status TEXT NOT NULL, documents_processed INTEGER NOT NULL DEFAULT 0,
      chunks_created INTEGER NOT NULL DEFAULT 0, error_message TEXT,
      started_at INTEGER NOT NULL, completed_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS rag_eval_runs (
      id TEXT PRIMARY KEY, corpus_id TEXT NOT NULL REFERENCES rag_corpora(id),
      org_id TEXT NOT NULL, query TEXT NOT NULL,
      expected_chunk_id TEXT, top_chunk_id TEXT, top_score REAL,
      hit INTEGER, retrieval_method TEXT NOT NULL, created_at INTEGER NOT NULL
    );
  `);

  const corpusCols = sqlite.prepare("PRAGMA table_info(rag_corpora)").all() as Array<{ name: string }>;
  const colNames = new Set(corpusCols.map((c) => c.name));
  const addCol = (sql: string) => {
    try { sqlite.exec(sql); } catch { /* column exists */ }
  };
  if (!colNames.has("org_id")) addCol("ALTER TABLE rag_corpora ADD COLUMN org_id TEXT");
  if (!colNames.has("project_id")) addCol("ALTER TABLE rag_corpora ADD COLUMN project_id TEXT");
  if (!colNames.has("chunk_count")) addCol("ALTER TABLE rag_corpora ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0");
  if (!colNames.has("embedding_model")) addCol("ALTER TABLE rag_corpora ADD COLUMN embedding_model TEXT NOT NULL DEFAULT 'local-bow'");
  if (!colNames.has("freshness_policy_days")) addCol("ALTER TABLE rag_corpora ADD COLUMN freshness_policy_days INTEGER NOT NULL DEFAULT 30");
  if (!colNames.has("status")) addCol("ALTER TABLE rag_corpora ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");

  const docCols = sqlite.prepare("PRAGMA table_info(rag_documents)").all() as Array<{ name: string }>;
  const docColNames = new Set(docCols.map((c) => c.name));
  if (!docColNames.has("chunk_count")) addCol("ALTER TABLE rag_documents ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0");
  if (!docColNames.has("ingested_at")) addCol("ALTER TABLE rag_documents ADD COLUMN ingested_at INTEGER");
}
