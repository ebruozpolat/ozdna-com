import { eq, and } from "drizzle-orm";
import type { VerticalMode } from "@ozdna/core";
import { getDb, ragCorpora, ragDocuments, ragChunks } from "@ozdna/db";
import { embedText, deserializeEmbedding, cosineSimilarity } from "./embeddings.js";
import { getCorpus } from "./corpus.js";

export interface RetrievalResult {
  corpusId: string;
  corpusName: string;
  method: "hybrid" | "vector" | "keyword" | "none";
  chunks: Array<{
    id: string;
    documentId: string;
    title: string;
    content: string;
    score: number;
    vectorScore?: number;
    keywordScore?: number;
  }>;
}

export interface RetrieveOptions {
  mode?: VerticalMode;
  corpusId?: string;
  query: string;
  limit?: number;
  orgId?: string;
}

function keywordScore(query: string, text: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
  if (terms.length === 0) return 0;
  const hay = text.toLowerCase();
  return terms.filter((t) => hay.includes(t)).length / terms.length;
}

export async function retrieveHybrid(opts: RetrieveOptions): Promise<RetrievalResult | null> {
  const db = getDb();
  const limit = opts.limit ?? 5;

  let corpus = opts.corpusId ? getCorpus(opts.corpusId) : null;

  if (!corpus && opts.mode) {
    const corpora = db
      .select()
      .from(ragCorpora)
      .where(and(eq(ragCorpora.mode, opts.mode), eq(ragCorpora.status, "active")))
      .limit(1)
      .all();
    corpus = corpora[0] ?? null;
  }

  if (!corpus) return null;
  if (opts.orgId && corpus.orgId && corpus.orgId !== opts.orgId) return null;

  const storedChunks = db
    .select()
    .from(ragChunks)
    .where(eq(ragChunks.corpusId, corpus.id))
    .all();

  if (storedChunks.length > 0) {
    const { vector: queryVec } = await embedText(opts.query, corpus.embeddingModel);
    const docTitleCache = new Map<string, string>();

    const scored = storedChunks.map((chunk) => {
      const vec = deserializeEmbedding(chunk.embedding);
      const vScore = cosineSimilarity(queryVec, vec);
      let title = docTitleCache.get(chunk.documentId);
      if (!title) {
        const doc = db
          .select()
          .from(ragDocuments)
          .where(eq(ragDocuments.id, chunk.documentId))
          .limit(1)
          .all()[0];
        title = doc?.title ?? "Untitled";
        docTitleCache.set(chunk.documentId, title);
      }
      const kScore = keywordScore(opts.query, `${title} ${chunk.content}`);
      const score = 0.7 * vScore + 0.3 * kScore;
      return {
        id: chunk.id,
        documentId: chunk.documentId,
        title,
        content: chunk.content,
        score,
        vectorScore: vScore,
        keywordScore: kScore,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return {
      corpusId: corpus.id,
      corpusName: corpus.name,
      method: "hybrid",
      chunks: scored.slice(0, limit),
    };
  }

  return retrieveKeywordFallback(corpus.id, corpus.name, opts.query, limit);
}

function retrieveKeywordFallback(
  corpusId: string,
  corpusName: string,
  query: string,
  limit: number,
): RetrievalResult | null {
  const db = getDb();
  const docs = db.select().from(ragDocuments).where(eq(ragDocuments.corpusId, corpusId)).all();

  if (docs.length === 0) return null;

  const scored = docs
    .map((doc) => ({
      id: doc.id,
      documentId: doc.id,
      title: doc.title,
      content: doc.content,
      score: keywordScore(query, `${doc.title} ${doc.content}`),
      keywordScore: keywordScore(query, `${doc.title} ${doc.content}`),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    corpusId,
    corpusName,
    method: "keyword",
    chunks: scored,
  };
}

/** @deprecated use retrieveHybrid — kept for backward compatibility */
export async function retrieve(
  mode: VerticalMode,
  query: string,
  limit = 3,
): Promise<Omit<RetrievalResult, "method"> | null> {
  const result = await retrieveHybrid({ mode, query, limit });
  if (!result) return null;
  const { method: _, ...rest } = result;
  return rest;
}

export function buildRagContext(result: RetrievalResult | null): string {
  if (!result || result.chunks.length === 0) return "";
  const lines = result.chunks.map((c) => `- ${c.title}: ${c.content}`);
  return `\n\nReference context (${result.corpusName}, ${result.method} retrieval):\n${lines.join("\n")}`;
}
