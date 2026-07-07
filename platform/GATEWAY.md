# ozDNA AI Gateway — LLM Proxy

Unified entry for inference workloads. Every request passes through the same gateway layer before upstream providers or local fallbacks.

---

## Endpoints

| Method | Path | Upstream / fallback | Notes |
|--------|------|---------------------|--------|
| `POST` | `/v1/chat` | OpenAI `/v1/chat/completions` | Model router overrides `model` when omitted |
| `POST` | `/v1/completion` | OpenAI `/v1/completions` | Legacy completion API |
| `POST` | `/v1/embeddings` | OpenAI `/v1/embeddings` or `local-bow` | **Cached** 60s per org+input |
| `POST` | `/v1/rerank` | Local hybrid (embed + cosine) | Body: `{ query, documents[], top_n?, mode? }` |
| `POST` | `/v1/moderation` | OpenAI `/v1/moderations` or rules fallback | Body: `{ input }` or `{ text }` |
| `POST` | `/v1/detect` | ozDNA workflow (existing) | Vertical AI detection |

All routes require `Authorization: Bearer ozdna_sk_...`.

Optional headers: `X-Request-Id` (idempotency trace).

Response headers: `X-Request-Id`, `X-OzDNA-Model`, `X-OzDNA-Cost-USD`, `X-OzDNA-Cache: HIT` (embeddings cache).

---

## Gateway pipeline

Every `POST /v1/*` request:

```
Client
  │
  ▼
┌─────────────────────────────────────────┐
│ 1. Authentication    Bearer API key     │
│ 2. Quotas            billing_accounts   │
│ 3. Rate limits       per-key bucket     │
│ 4. Audit + logging   request start      │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│ 5. Model router      workflow + mode    │
│ 6. Cache lookup      embeddings only    │
│ 7. Upstream call     with retries       │
│ 8. Usage + cost      analytics record   │
│ 9. Audit complete    quota increment    │
└─────────────────────────────────────────┘
```

| Feature | Package | Status |
|---------|---------|--------|
| **Authentication** | `@ozdna/auth` + `@ozdna/gateway` | ✅ Bearer keys |
| **Quotas** | `@ozdna/billing` | ✅ Monthly quota check |
| **Retries** | `@ozdna/gateway/proxy` | ✅ 429/502/503/504 · 3 attempts |
| **Caching** | `@ozdna/gateway/proxy` | ✅ Embeddings · 60s TTL |
| **Logging** | `@ozdna/observability` | ✅ Structured logs + audit trail |

---

## Example — chat

```bash
curl -X POST http://localhost:8787/v1/chat \
  -H "Authorization: Bearer $OZDNA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "academic",
    "messages": [
      { "role": "user", "content": "Summarize token economics for vertical AI." }
    ]
  }'
```

Without `OPENAI_API_KEY` on the server, chat returns a **preview stub** (routing + metering still run).

---

## Example — rerank

```bash
curl -X POST http://localhost:8787/v1/rerank \
  -H "Authorization: Bearer $OZDNA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "AML suspicious transaction reporting",
    "documents": [
      "MASAK STR filing requirements",
      "BDDK capital adequacy ratios",
      "KVKK breach notification timeline"
    ],
    "top_n": 2
  }'
```

---

## Vertical modes

Pass `"mode": "academic" | "legal" | "financial" | "general"` on any LLM proxy body to influence router defaults (cost ceiling, model selection).

---

## Related

- [MODULES.md](./MODULES.md) — Module 1 API Gateway GA criteria
- [IAM.md](./IAM.md) — Org/project key scope
- Public docs: `/docs/` · `/docs/tr/`
