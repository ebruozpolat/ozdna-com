import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";

const tempDir = mkdtempSync(join(tmpdir(), "ozdna-critical-"));
process.env.OZDNA_DB_PATH = join(tempDir, "test.db");

try {
  const { initSchema, getDb, organizations, workspaces, projects, apiKeys, ragChunks, ragCorpora } =
    await import("@ozdna/db");
  const { hashApiKey } = await import("@ozdna/auth");
  const { listApiKeys } = await import("@ozdna/admin");
  const { createCorpus, addDocument, ingestCorpus } = await import("@ozdna/rag");

  initSchema();
  const db = getDb();
  const now = new Date();

  db.insert(organizations)
    .values({ id: "org_test", name: "Test Org", plan: "developer", createdAt: now })
    .run();
  db.insert(workspaces)
    .values({ id: "ws_test", orgId: "org_test", name: "Workspace", slug: "workspace", createdAt: now })
    .run();
  db.insert(projects)
    .values([
      { id: "proj_a", orgId: "org_test", workspaceId: "ws_test", name: "Project A", createdAt: now },
      { id: "proj_b", orgId: "org_test", workspaceId: "ws_test", name: "Project B", createdAt: now },
    ])
    .run();
  db.insert(apiKeys)
    .values([
      {
        id: "key_a",
        projectId: "proj_a",
        orgId: "org_test",
        name: "Key A",
        keyHash: hashApiKey("ozdna_sk_test_a"),
        keyPrefix: "ozdna_sk_test_a",
        environment: "test",
        rateLimitPerMin: 10,
        monthlyQuota: 1000,
        active: true,
        createdAt: now,
      },
      {
        id: "key_b",
        projectId: "proj_b",
        orgId: "org_test",
        name: "Key B",
        keyHash: hashApiKey("ozdna_sk_test_b"),
        keyPrefix: "ozdna_sk_test_b",
        environment: "test",
        rateLimitPerMin: 10,
        monthlyQuota: 1000,
        active: true,
        createdAt: now,
      },
    ])
    .run();

  assert.throws(
    () =>
      listApiKeys(
        "proj_b",
        {
          requestId: "req_test",
          orgId: "org_test",
          projectId: "proj_a",
          apiKeyId: "key_a",
          plan: "developer",
          environment: "test",
        },
        "req_test",
      ),
    /Access denied to this project/,
  );

  const corpus = createCorpus({
    orgId: "org_test",
    projectId: "proj_a",
    name: "Corpus",
    mode: "legal",
    embeddingModel: "local-bow",
  });
  assert(corpus);
  const document = addDocument(corpus.id, {
    title: "Rule",
    content: "First sentence about compliance. Second sentence about auditability.",
  });
  assert(document);

  await ingestCorpus(corpus.id);
  const originalChunks = db.select().from(ragChunks).where(eq(ragChunks.documentId, document.id)).all();
  assert(originalChunks.length > 0);

  db.update(ragCorpora)
    .set({ embeddingModel: "text-embedding-3-small" })
    .where(eq(ragCorpora.id, corpus.id))
    .run();
  process.env.OPENAI_API_KEY = "test-key";
  globalThis.fetch = async () => ({
    ok: true,
    async json() {
      throw new Error("embedding response parse failed");
    },
  });

  await assert.rejects(() => ingestCorpus(corpus.id), /embedding response parse failed/);

  const chunksAfterFailedReingest = db
    .select()
    .from(ragChunks)
    .where(eq(ragChunks.documentId, document.id))
    .all();
  assert.deepEqual(
    chunksAfterFailedReingest.map((chunk) => chunk.id),
    originalChunks.map((chunk) => chunk.id),
  );
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
