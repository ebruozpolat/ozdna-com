import type { VerticalMode } from "@ozdna/core";
import { generateId } from "@ozdna/core";
import { eq, desc } from "drizzle-orm";
import { getDb, ragCorpora, ragDocuments, ragChunks, ragIngestionJobs } from "@ozdna/db";
import { chunkText } from "./chunking.js";
import { embedText, serializeEmbedding } from "./embeddings.js";

export interface CreateCorpusInput {
  orgId?: string;
  projectId?: string;
  name: string;
  mode: VerticalMode;
  description?: string;
  freshnessPolicyDays?: number;
  embeddingModel?: string;
}

export interface AddDocumentInput {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export function createCorpus(input: CreateCorpusInput) {
  const db = getDb();
  const id = generateId("cor");
  const now = new Date();

  db.insert(ragCorpora)
    .values({
      id,
      orgId: input.orgId ?? null,
      projectId: input.projectId ?? null,
      name: input.name,
      mode: input.mode,
      description: input.description ?? null,
      documentCount: 0,
      chunkCount: 0,
      embeddingModel: input.embeddingModel ?? "local-bow",
      freshnessPolicyDays: input.freshnessPolicyDays ?? 30,
      status: "active",
      createdAt: now,
    })
    .run();

  return getCorpus(id);
}

export function getCorpus(corpusId: string) {
  const db = getDb();
  return db.select().from(ragCorpora).where(eq(ragCorpora.id, corpusId)).limit(1).all()[0] ?? null;
}

export function listCorpora(orgId?: string) {
  const db = getDb();
  const rows = db.select().from(ragCorpora).all();
  if (!orgId) return rows;
  return rows.filter((c) => c.orgId === orgId);
}

export function addDocument(corpusId: string, input: AddDocumentInput) {
  const db = getDb();
  const corpus = getCorpus(corpusId);
  if (!corpus) throw new Error("Corpus not found");

  const id = generateId("doc");
  const now = new Date();

  db.insert(ragDocuments)
    .values({
      id,
      corpusId,
      title: input.title,
      content: input.content,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      chunkCount: 0,
      createdAt: now,
    })
    .run();

  db.update(ragCorpora)
    .set({ documentCount: corpus.documentCount + 1 })
    .where(eq(ragCorpora.id, corpusId))
    .run();

  return db.select().from(ragDocuments).where(eq(ragDocuments.id, id)).limit(1).all()[0];
}

export function listDocuments(corpusId: string) {
  const db = getDb();
  return db.select().from(ragDocuments).where(eq(ragDocuments.corpusId, corpusId)).all();
}

export async function ingestCorpus(corpusId: string): Promise<{
  jobId: string;
  documentsProcessed: number;
  chunksCreated: number;
}> {
  const db = getDb();
  const corpus = getCorpus(corpusId);
  if (!corpus) throw new Error("Corpus not found");

  const jobId = generateId("ing");
  const startedAt = new Date();

  db.insert(ragIngestionJobs)
    .values({ id: jobId, corpusId, status: "running", startedAt })
    .run();

  let documentsProcessed = 0;
  let chunksCreated = 0;

  try {
    const docs = listDocuments(corpusId);

    for (const doc of docs) {
      db.delete(ragChunks).where(eq(ragChunks.documentId, doc.id)).run();

      const chunks = chunkText(doc.content);
      for (const chunk of chunks) {
        const { vector } = await embedText(`${doc.title}\n${chunk.content}`, corpus.embeddingModel);
        db.insert(ragChunks)
          .values({
            id: generateId("chk"),
            corpusId,
            documentId: doc.id,
            content: chunk.content,
            chunkIndex: chunk.index,
            embedding: serializeEmbedding(vector),
            tokenCount: chunk.tokenCount,
            createdAt: new Date(),
          })
          .run();
        chunksCreated++;
      }

      db.update(ragDocuments)
        .set({ chunkCount: chunks.length, ingestedAt: new Date() })
        .where(eq(ragDocuments.id, doc.id))
        .run();

      documentsProcessed++;
    }

    const now = new Date();
    db.update(ragCorpora)
      .set({ chunkCount: chunksCreated, lastIngestedAt: now })
      .where(eq(ragCorpora.id, corpusId))
      .run();

    db.update(ragIngestionJobs)
      .set({
        status: "completed",
        documentsProcessed,
        chunksCreated,
        completedAt: now,
      })
      .where(eq(ragIngestionJobs.id, jobId))
      .run();
  } catch (err) {
    db.update(ragIngestionJobs)
      .set({
        status: "failed",
        documentsProcessed,
        chunksCreated,
        errorMessage: err instanceof Error ? err.message : "Unknown error",
        completedAt: new Date(),
      })
      .where(eq(ragIngestionJobs.id, jobId))
      .run();
    throw err;
  }

  return { jobId, documentsProcessed, chunksCreated };
}

export function getFreshness(corpusId: string) {
  const corpus = getCorpus(corpusId);
  if (!corpus) return null;

  const now = Date.now();
  const lastIngest = corpus.lastIngestedAt?.getTime() ?? 0;
  const ageDays = lastIngest ? (now - lastIngest) / 86_400_000 : null;
  const stale = ageDays !== null && ageDays > corpus.freshnessPolicyDays;

  return {
    corpus_id: corpusId,
    last_ingested_at: corpus.lastIngestedAt?.toISOString() ?? null,
    age_days: ageDays !== null ? Math.round(ageDays * 10) / 10 : null,
    freshness_policy_days: corpus.freshnessPolicyDays,
    status: stale ? "stale" : ageDays === null ? "never_ingested" : "fresh",
    document_count: corpus.documentCount,
    chunk_count: corpus.chunkCount,
  };
}

export function getIngestionJob(jobId: string) {
  const db = getDb();
  return db.select().from(ragIngestionJobs).where(eq(ragIngestionJobs.id, jobId)).limit(1).all()[0] ?? null;
}

export function listIngestionJobs(corpusId: string) {
  const db = getDb();
  return db
    .select()
    .from(ragIngestionJobs)
    .where(eq(ragIngestionJobs.corpusId, corpusId))
    .orderBy(desc(ragIngestionJobs.startedAt))
    .all();
}
