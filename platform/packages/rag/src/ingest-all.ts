import { initSchema } from "@ozdna/db";
import { listCorpora, ingestCorpus } from "./corpus.js";

initSchema();

const corpora = listCorpora();
let totalChunks = 0;

for (const corpus of corpora) {
  if (corpus.chunkCount > 0) {
    console.log(`  Skip ${corpus.name} — already ingested (${corpus.chunkCount} chunks)`);
    continue;
  }
  const result = await ingestCorpus(corpus.id);
  totalChunks += result.chunksCreated;
  console.log(`  Ingested ${corpus.name}: ${result.chunksCreated} chunks`);
}

console.log(`\n✓ RAG Phase 2 ingest complete — ${totalChunks} total chunks\n`);
