# ozDNA Platform Modules

**Vertical AI Infrastructure** — the modules that turn ozDNA from a marketing site into a platform developers and enterprise customers can run in production.

When all ten modules below reach **GA (generally available)**, ozDNA is a full PaaS: not a landing page with a demo API, but infrastructure teams can depend on.

---

## Module map

| # | Module | Package | v0.1 today | GA criteria |
|---|--------|---------|------------|-------------|
| 1 | **API Gateway** | `@ozdna/gateway` | ✅ Active | Unified entry, auth, rate limits, request IDs, error envelope, OpenAPI |
| 2 | **Model Router** | `@ozdna/router` | ✅ Rule-based | Multi-provider routing, fallback, cost/latency policies, configurable rules |
| 3 | **Prompt Registry** | `@ozdna/prompts` | ✅ Versioned | Versioned prompts per workflow/mode, rollout, rollback, hash verification |
| 4 | **Usage Analytics** | `@ozdna/analytics` | ✅ Event log | Per-request events, workflow breakdown, export API, retention policy |
| 5 | **Cost Engine** | `@ozdna/cost` | ✅ Attribution | Token-level cost, per-workflow totals, alerts, provider price tables |
| 6 | **API Key Management** | `@ozdna/auth` | ✅ Bearer keys | Create/revoke/rotate keys, scopes, env separation (test/live), last-used |
| 7 | **Organization & Workspace** | `@ozdna/admin` + `@ozdna/db` | 🟡 Admin REST API | Org → workspace → project, users, roles, permissions, admin API |
| 8 | **Billing & Quotas** | `@ozdna/billing` | ✅ Metering | Plan tiers, monthly quota enforcement, overage rules, Stripe (optional GA) |
| 9 | **Audit Logs** | `@ozdna/observability` | 🟡 Write-only | Immutable audit trail, query/export API, retention, compliance filters |
| 10 | **Admin Dashboard** | `apps/dashboard` (planned) | 🔜 Not started | Web UI for keys, usage, cost, prompts, quotas, audit — operator + customer |

**Legend:** ✅ = runnable in `platform/` today · 🟡 = partial / backend only · 🔜 = not started

---

## Architecture (target)

```
Client / SDK
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│  API Gateway          auth · rate limits · request routing   │
└────────────────────────────┬────────────────────────────────┘
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
 Model Router          Prompt Registry         API Key Mgmt
 (cost / fallback)     (versioned workflows)   (org / project scope)
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             ▼
                    Inference + RAG (workflows)
                             │
     ┌───────────────────────┼───────────────────────┐
     ▼                       ▼                       ▼
 Usage Analytics        Cost Engine            Audit Logs
     │                       │                       │
     └───────────────────────┼───────────────────────┘
                             ▼
              Billing & Quotas · Org & Workspace
                             │
                             ▼
                    Admin Dashboard (UI)
```

Supporting packages (not in the GA ten, but shipped): `@ozdna/rag`, `@ozdna/inference`, `@ozdna/core`.

---

## Per-module GA definition

### 1. API Gateway
- [x] Bearer authentication on `/v1/*`
- [x] Rate limiting per API key
- [x] Structured error responses
- [x] LLM proxy: `/v1/chat`, `/v1/completion`, `/v1/embeddings`, `/v1/rerank`, `/v1/moderation`
- [x] Gateway: quotas, retries, embeddings cache, audit logging — see [GATEWAY.md](./GATEWAY.md)
- [ ] Hosted production hardening (`api.ozdna.com`, WAF, SLA)
- [ ] Webhook ingress + signed payloads

### 2. Model Router
- [x] Rule-based primary/fallback model selection
- [x] Routing rules in DB (`routing_rules`)
- [ ] Multi-provider adapters (Anthropic, Azure, local)
- [ ] Cost-ceiling and latency SLO policies

### 3. Prompt Registry
- [x] Versioned prompts by workflow + mode
- [x] Content hash for drift detection
- [ ] Admin API: publish, activate, rollback
- [ ] Prompt Registry UI (dashboard)

### 4. Usage Analytics
- [x] `usage_events` table + record on each request
- [x] `GET /v1/metrics/usage`
- [ ] Time-series aggregation API
- [ ] CSV/JSON export for billing reconciliation

### 5. Cost Engine
- [x] Token-level cost attribution
- [x] `GET /v1/metrics/cost`
- [ ] Provider price table updates without deploy
- [ ] Budget alerts per org/workflow

### 6. API Key Management
- [x] Key generation, hash storage, prefix display
- [x] Test vs live key prefixes (`ozdna_sk_test_` / `ozdna_sk_live_`)
- [ ] REST API: list, create, revoke, rotate
- [ ] Key-scoped permissions (read-only, workflow allowlist)

### 7. Organization & Workspace Management
- [x] DB: `organizations`, `workspaces`, `users`, `projects`, `roles`, `permissions`, memberships
- [x] Keys scoped to org + project
- [x] IAM model documented — [IAM.md](./IAM.md) (Admin nav: Orgs, Users, Workspaces, Projects, API Keys, Roles, Permissions)
- [ ] REST API: org / workspace / project CRUD
- [ ] REST API: members, invites, role assignment
- [ ] REST API: API key lifecycle (list, create, revoke)

### 8. Billing & Quotas
- [x] `billing_accounts` + monthly quota enforcement
- [x] Quota check before inference
- [ ] Stripe subscription + invoicing
- [ ] Plan upgrade/downgrade self-serve

### 9. Audit Logs
- [x] `audit()` writes to `audit_logs`
- [x] JSON structured logs (stdout)
- [ ] `GET /v1/audit` query API (filter by org, action, date)
- [ ] Export for compliance (SOC 2 evidence pack)

### 10. Admin Dashboard
- [ ] Operator console (internal)
- [ ] Customer console (org admins)
- [ ] Nav: Organizations · Users · Workspaces · Projects · API Keys · Roles · Permissions
- [ ] Views: usage charts, cost breakdown, prompt versions, audit tail
- [ ] Auth: session + org switcher

---

## Current score

| Status | Count | Modules |
|--------|-------|---------|
| Runnable v0.1 | 6 | Gateway, Router, Prompts, Analytics, Cost, API Keys |
| Partial | 3 | Org/Workspace (schema), Billing (no Stripe), Audit (write-only) |
| Not started | 1 | Admin Dashboard |

**Platform GA gate:** all checkboxes above marked complete + hosted API + documentation + SDK preview.

---

## Implementation order (recommended)

Aligned with production proof at [TezMakale](https://tezmakale.com) and enterprise beta:

1. **Q3 2026** — Harden modules 1–6 on hosted API; add Org/Workspace + Audit **read APIs**
2. **Q4 2026** — Billing (Stripe), Admin Dashboard MVP, Prompt Registry UI
3. **Q1 2027** — Multi-provider router, enterprise RBAC, audit export

See [ROADMAP.md](../ROADMAP.md) and [ozdna.com/roadmap](https://ozdna.com/roadmap/) for public timelines.

---

## Quick start (today)

The six core runtime modules already execute on every `POST /v1/detect`:

```bash
cd platform && npm install && npm run db:push && npm run db:seed && npm run dev
```

```bash
curl -X POST http://localhost:8787/v1/detect \
  -H "Authorization: Bearer $OZDNA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"Sample academic prose for analysis.","mode":"academic","language":"en"}'
```

Platform status: `GET /v1/platform/status`
