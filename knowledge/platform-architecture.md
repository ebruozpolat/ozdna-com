---
title: Platform Architecture
tags: [architecture, platform, infrastructure]
related: [overview.md, integration.md]
---

# ozDNA Platform Architecture

ozDNA is a **Vertical AI Infrastructure platform** — not a landing page with API docs, but a runnable system with nine core modules.

## Module Map

| Module | Package | Responsibility |
|--------|---------|----------------|
| AI Gateway | `@ozdna/gateway` | Single entry point: auth, rate limits, audit, error handling |
| Model Router | `@ozdna/router` | Route workflows to cheapest capable model with fallback |
| Prompt Registry | `@ozdna/prompts` | Versioned prompts per workflow + vertical mode |
| API Keys | `@ozdna/auth` | Bearer token validation, scoped keys per project |
| Usage Analytics | `@ozdna/analytics` | Per-request events: tokens, latency, model, cost |
| Cost Optimization | `@ozdna/cost` | Token-level USD attribution, workflow cost metrics |
| RAG Management | `@ozdna/rag` | Corpus management + retrieval per vertical mode |
| Observability | `@ozdna/observability` | Structured JSON logs + immutable audit trail |
| Billing | `@ozdna/billing` | Plan quotas, usage metering, quota enforcement |

## Request Flow

```
Client → AI Gateway (auth, rate limit, quota check)
       → Model Router (select model for workflow + mode)
       → Prompt Registry (resolve versioned prompt)
       → RAG Management (retrieve vertical context)
       → LLM Provider (OpenAI or sandbox mock)
       → Cost Optimization (calculate USD)
       → Usage Analytics (record event)
       → Observability (audit log)
       → Billing (increment usage)
       → Response
```

## Repository Layout

- **`/`** — Marketing site (Netlify static)
- **`/platform/`** — Runnable infrastructure (TypeScript monorepo)

## Running Locally

```bash
cd platform && npm install && npm run db:seed && npm run dev
```

API: `http://localhost:8787` · OpenAPI: `/openapi.json` · Status: `/v1/platform/status`

→ See [platform/README.md](../platform/README.md) for full developer guide.
