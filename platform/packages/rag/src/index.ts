export { chunkText, estimateTokens } from "./chunking.js";
export type { ChunkOptions, TextChunk } from "./chunking.js";

export {
  embedText,
  embedLocal,
  cosineSimilarity,
  serializeEmbedding,
  deserializeEmbedding,
} from "./embeddings.js";

export {
  createCorpus,
  getCorpus,
  listCorpora,
  addDocument,
  listDocuments,
  ingestCorpus,
  getFreshness,
  getIngestionJob,
  listIngestionJobs,
} from "./corpus.js";
export type { CreateCorpusInput, AddDocumentInput } from "./corpus.js";

export { runEval, getEvalSummary } from "./eval.js";
export type { EvalInput, EvalResult } from "./eval.js";

export { retrieveHybrid, retrieve, buildRagContext } from "./retrieve.js";
export type { RetrievalResult, RetrieveOptions } from "./retrieve.js";
