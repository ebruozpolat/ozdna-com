---
title: RAG Management — Phase 2
tags: [rag, retrieval, embeddings, platform]
related: [platform-architecture.md, overview.md]
---

# RAG Management — Phase 2

Phase 2 upgrades keyword-only retrieval to a **production RAG operating layer**.

## Capabilities

| Feature | Description |
|---------|-------------|
| **Chunking pipeline** | Configurable chunk size + overlap on document ingest |
| **Vector embeddings** | OpenAI `text-embedding-3-small` when `OPENAI_API_KEY` set; local bag-of-words fallback |
| **Hybrid retrieval** | 70% vector similarity + 30% keyword score |
| **Corpus API** | Create corpora, add documents, trigger ingest |
| **Freshness tracking** | Stale detection vs `freshness_policy_days` |
| **Eval hooks** | Run retrieval evals, track hit rate per corpus |

## API Endpoints

```
GET  /v1/rag/corpora
POST /v1/rag/corpora
GET  /v1/rag/corpora/:id
POST /v1/rag/corpora/:id/documents
GET  /v1/rag/corpora/:id/documents
POST /v1/rag/corpora/:id/ingest
GET  /v1/rag/corpora/:id/freshness
GET  /v1/rag/corpora/:id/eval-summary
GET  /v1/rag/ingest/:jobId
POST /v1/rag/retrieve
POST /v1/rag/eval
```

## Ingest Flow

1. `POST /v1/rag/corpora` — create corpus scoped to org/project
2. `POST /v1/rag/corpora/:id/documents` — add source documents
3. `POST /v1/rag/corpora/:id/ingest` — chunk, embed, store in `rag_chunks`
4. Inference (`/v1/detect`) automatically uses hybrid retrieval

## Local Setup

```bash
cd platform
npm run db:seed    # seeds + ingests chunks
npm run rag:ingest # re-ingest existing corpora
```

→ [platform-architecture.md](./platform-architecture.md)
