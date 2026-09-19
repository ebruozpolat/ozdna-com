import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const dbDir = await mkdtemp(join(tmpdir(), "ozdna-rag-auth-"));
process.env.OZDNA_DB_PATH = join(dbDir, "test.db");

const { app } = await import("../dist/index.js");
const {
  getDb,
  initSchema,
  organizations,
  projects,
  apiKeys,
  ragCorpora,
  ragDocuments,
  ragChunks,
  ragIngestionJobs,
  ragEvalRuns,
} = await import("../../../packages/db/dist/index.js");

function hashKey(raw) {
  return createHash("sha256").update(raw).digest("hex");
}

function authHeaders(rawKey) {
  return { Authorization: `Bearer ${rawKey}` };
}

async function apiRequest(path, rawKey, init = {}) {
  return app.request(path, {
    ...init,
    headers: {
      ...authHeaders(rawKey),
      ...(init.headers ?? {}),
    },
  });
}

initSchema();
const db = getDb();
const now = new Date();

const orgA = "org_rag_owner";
const orgB = "org_rag_intruder";
const projectA = "proj_rag_owner";
const projectB = "proj_rag_intruder";
const keyA = "ozdna_sk_test_owner_rag_auth_boundary";
const keyB = "ozdna_sk_test_intruder_rag_auth_boundary";
const corpusA = "cor_rag_owner";
const docA = "doc_rag_owner";
const chunkA = "chk_rag_owner";
const jobA = "ing_rag_owner";
const evalA = "eval_rag_owner";

db.insert(organizations).values([
  { id: orgA, name: "Owner Org", plan: "developer", createdAt: now },
  { id: orgB, name: "Intruder Org", plan: "developer", createdAt: now },
]).run();

db.insert(projects).values([
  { id: projectA, orgId: orgA, name: "Owner Project", createdAt: now },
  { id: projectB, orgId: orgB, name: "Intruder Project", createdAt: now },
]).run();

db.insert(apiKeys).values([
  {
    id: "key_rag_owner",
    projectId: projectA,
    orgId: orgA,
    name: "Owner Key",
    keyHash: hashKey(keyA),
    keyPrefix: keyA.slice(0, 20),
    environment: "test",
    rateLimitPerMin: 60,
    monthlyQuota: 1000,
    active: true,
    createdAt: now,
  },
  {
    id: "key_rag_intruder",
    projectId: projectB,
    orgId: orgB,
    name: "Intruder Key",
    keyHash: hashKey(keyB),
    keyPrefix: keyB.slice(0, 20),
    environment: "test",
    rateLimitPerMin: 60,
    monthlyQuota: 1000,
    active: true,
    createdAt: now,
  },
]).run();

db.insert(ragCorpora).values({
  id: corpusA,
  orgId: orgA,
  projectId: projectA,
  name: "Owner Corpus",
  mode: "legal",
  description: "Private owner corpus",
  documentCount: 1,
  chunkCount: 1,
  embeddingModel: "local-bow",
  freshnessPolicyDays: 30,
  status: "active",
  lastIngestedAt: now,
  createdAt: now,
}).run();

db.insert(ragDocuments).values({
  id: docA,
  corpusId: corpusA,
  title: "Private Document",
  content: "tenant A confidential content",
  metadata: null,
  chunkCount: 1,
  ingestedAt: now,
  createdAt: now,
}).run();

db.insert(ragChunks).values({
  id: chunkA,
  corpusId: corpusA,
  documentId: docA,
  content: "tenant A confidential content",
  chunkIndex: 0,
  embedding: JSON.stringify(Array.from({ length: 32 }, () => 0)),
  tokenCount: 4,
  createdAt: now,
}).run();

db.insert(ragIngestionJobs).values({
  id: jobA,
  corpusId: corpusA,
  status: "failed",
  documentsProcessed: 0,
  chunksCreated: 0,
  errorMessage: "owner-only diagnostic",
  startedAt: now,
  completedAt: now,
}).run();

db.insert(ragEvalRuns).values({
  id: evalA,
  corpusId: corpusA,
  orgId: orgA,
  query: "owner private query",
  expectedChunkId: chunkA,
  topChunkId: chunkA,
  topScore: 1,
  hit: true,
  retrievalMethod: "hybrid",
  createdAt: now,
}).run();

test("owner can read its own corpus documents", async () => {
  const response = await apiRequest(`/v1/rag/corpora/${corpusA}/documents`, keyA);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.documents[0].content, "tenant A confidential content");
});

test("RAG corpus routes reject a different tenant's API key", async () => {
  const routes = [
    [`/v1/rag/corpora/${corpusA}`, { method: "GET" }],
    [`/v1/rag/corpora/${corpusA}/documents`, { method: "GET" }],
    [`/v1/rag/corpora/${corpusA}/freshness`, { method: "GET" }],
    [`/v1/rag/ingest/${jobA}`, { method: "GET" }],
    [`/v1/rag/corpora/${corpusA}/eval-summary`, { method: "GET" }],
    [`/v1/rag/corpora/${corpusA}/ingest`, { method: "POST" }],
    [
      "/v1/rag/eval",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ corpus_id: corpusA, query: "confidential" }),
      },
    ],
  ];

  for (const [path, init] of routes) {
    const response = await apiRequest(path, keyB, init);
    assert.equal(response.status, 403, `${init.method} ${path}`);
    const body = await response.json();
    assert.equal(body.error, "forbidden");
  }
});

test("cross-tenant ingest denial does not create an ingestion job", async () => {
  const jobs = db.select().from(ragIngestionJobs).all();
  assert.deepEqual(jobs.map((job) => job.id), [jobA]);
});
