import { generateId } from "@ozdna/core";
import { eq, desc } from "drizzle-orm";
import { getDb, ragEvalRuns } from "@ozdna/db";
import { retrieveHybrid, type RetrievalResult } from "./retrieve.js";

export interface EvalInput {
  corpusId: string;
  orgId: string;
  query: string;
  expectedChunkId?: string;
  limit?: number;
}

export interface EvalResult {
  eval_id: string;
  query: string;
  hit: boolean;
  top_score: number;
  top_chunk_id: string | null;
  retrieval_method: string;
  chunks: RetrievalResult["chunks"];
}

export async function runEval(input: EvalInput): Promise<EvalResult> {
  const result = await retrieveHybrid({
    corpusId: input.corpusId,
    query: input.query,
    limit: input.limit ?? 5,
  });

  const top = result?.chunks[0] ?? null;
  const hit = input.expectedChunkId
    ? result?.chunks.some((c) => c.id === input.expectedChunkId) ?? false
    : (top?.score ?? 0) >= 0.5;

  const evalId = generateId("eval");
  const db = getDb();

  db.insert(ragEvalRuns)
    .values({
      id: evalId,
      corpusId: input.corpusId,
      orgId: input.orgId,
      query: input.query,
      expectedChunkId: input.expectedChunkId ?? null,
      topChunkId: top?.id ?? null,
      topScore: top?.score ?? null,
      hit,
      retrievalMethod: result?.method ?? "none",
      createdAt: new Date(),
    })
    .run();

  return {
    eval_id: evalId,
    query: input.query,
    hit,
    top_score: top?.score ?? 0,
    top_chunk_id: top?.id ?? null,
    retrieval_method: result?.method ?? "none",
    chunks: result?.chunks ?? [],
  };
}

export function getEvalSummary(corpusId: string) {
  const db = getDb();
  const runs = db
    .select()
    .from(ragEvalRuns)
    .where(eq(ragEvalRuns.corpusId, corpusId))
    .orderBy(desc(ragEvalRuns.createdAt))
    .limit(100)
    .all();

  if (runs.length === 0) {
    return { corpus_id: corpusId, total_runs: 0, hit_rate: null, avg_top_score: null };
  }

  const hits = runs.filter((r) => r.hit).length;
  const avgScore = runs.reduce((s, r) => s + (r.topScore ?? 0), 0) / runs.length;

  return {
    corpus_id: corpusId,
    total_runs: runs.length,
    hit_rate: Math.round((hits / runs.length) * 1000) / 1000,
    avg_top_score: Math.round(avgScore * 1000) / 1000,
    recent: runs.slice(0, 5).map((r) => ({
      eval_id: r.id,
      query: r.query,
      hit: r.hit,
      top_score: r.topScore,
      created_at: r.createdAt.toISOString(),
    })),
  };
}
