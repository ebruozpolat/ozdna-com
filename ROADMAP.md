# ozDNA Roadmap

Directional plan for **ozDNA** — vertical AI infrastructure plus product lines under the same brand.

**Timelines are estimates** and may shift based on beta feedback, compliance work, and production learnings from [TezMakale](https://tezmakale.com).

Public roadmap page: [ozdna.com/roadmap](https://ozdna.com/roadmap/)

Changelog: [ozdna.com/changelog](https://ozdna.com/changelog/)

---

## Product portfolio

| Product | Focus | Target | Planning docs |
|---------|--------|--------|----------------|
| **ozDNA Platform** | LLM gateway, routing, prompts, RAG, cost | GA Q3–Q4 2026 | `platform/MODULES.md` |
| ComplyDNA | RegTech RAG backend | Q3 2026 | [`COMPLYDNA.md`](./docs/products/COMPLYDNA.md) · [Linear OZD-39](https://linear.app/georiskengine/issue/OZD-39) · `complydna/` |
| **OriginDNA** *(working name)* | Content provenance — C2PA, anchor, DNA registry | Q4 2026 (gate: Sep 30) | [`ORIGINDNA.md`](./docs/products/ORIGINDNA.md) · [Linear OZD-50](https://linear.app/georiskengine/issue/OZD-50) · `plan/` |

OriginDNA planning corpus was authored by a partner (July 2026). It is **not** part of the `platform/` monorepo today; a separate Cloudflare Workers codebase is specified in `plan/02-TECH-STACK.md`.

---

## Platform GA — ten core modules

ozDNA becomes a **Vertical AI Infrastructure Platform** (not only a marketing site) when these modules reach GA:

1. API Gateway  
2. Model Router  
3. Prompt Registry  
4. Usage Analytics  
5. Cost Engine  
6. API Key Management  
7. Organization & Workspace Management  
8. Billing & Quotas  
9. Audit Logs  
10. Admin Dashboard  

**Today (v0.1):** modules 1–6 run in `platform/` on every API request; 7–9 are partial (schema or write-only); 10 is planned Q4 2026.

Details: [`platform/MODULES.md`](./platform/MODULES.md)

---

## Shipped (v0.1)

| Item | Area | Notes |
|------|------|-------|
| Marketing site & docs hub | Site | Landing, pricing, docs, trust, security, legal |
| AI Gateway | Platform | Auth, rate limits, audit, request routing |
| Model Router | Platform | Rule-based cost-aware selection + fallback |
| Prompt Registry | Platform | Versioned prompts per workflow/mode |
| API Keys | Platform | Bearer token validation |
| Usage Analytics | Platform | Per-request event tracking |
| Cost Optimization | Platform | Token-level cost attribution |
| RAG Management | Platform | v0.2 — hybrid retrieval, ingestion, eval |
| Observability | Platform | Structured JSON logs + audit trail |
| Billing (metering) | Platform | Quota enforcement + plan metering |
| Agent knowledge bundle | Site | `llms.txt`, `knowledge/` markdown |
| Illustrative benchmarks | Site | Not production metrics — [benchmarks](https://ozdna.com/benchmarks/) |

---

## Q3 2026

| Item | Status | Description |
|------|--------|-------------|
| ComplyDNA (RegTech) | In progress | 5549 / BDDK / MASAK / KVKK monitoring for fintech and legal |
| API Gateway (hosted) | In progress | Production `api.ozdna.com` hardening |
| Cost Engine | In progress | Workflow-level cost dashboards and alerts |
| Model Routing | In progress | Expanded provider support and routing policies |
| Public measured benchmarks | Planned | Reproducible benchmark harness — replace illustrative numbers |
| Client SDKs (preview) | Planned | Python, Node.js — see [SDK page](https://ozdna.com/sdk/) |

---

## Q4 2026

| Item | Status | Description |
|------|--------|-------------|
| **OriginDNA** — pre-build & gate | Planned | Partner plan: waitlist, Aug 2 PR, **Sep 30 build gate** — see [`docs/products/ORIGINDNA.md`](./docs/products/ORIGINDNA.md) |
| **OriginDNA** — MVP (October) | Planned | C2PA signing, chain anchor, DNA registry, verify page, compliance API — `plan/04-MVP-SPEC.md` |
| Prompt Registry (UI) | Planned | Web console for prompt versioning and rollout |
| Agent Runtime | Planned | Orchestrated multi-step workflows on platform stack |
| Usage Analytics (dashboard) | Planned | Team-facing analytics and export |
| Dashboard UI | Planned | Operator console for keys, quotas, and workflows |
| Stripe billing | Planned | Self-serve subscription and invoicing |
| SDKs (Go, Java) | Planned | Additional language clients |

---

## 2027+

| Item | Status | Description |
|------|--------|-------------|
| **OriginDNA** — expansion | Future | Video/audio signing, TrustMark watermark, C2PA conformance, mobile capture — trigger-based per `plan/08-ROADMAP-GATES.md` |
| Enterprise Governance | Future | Policy engine, approval flows, audit exports |
| Marketplace | Future | Vertical templates and partner integrations |
| Vertical AI Templates | Future | Pre-built RAG + routing packs by industry |
| SOC 2 / ISO 27001 program | Future | Formal certification track — see [Trust Center](https://ozdna.com/trust/) |

---

## Platform module matrix

Current implementation status in `platform/` — see **[platform/MODULES.md](./platform/MODULES.md)** for GA checklists.

| Module | Package | Status |
|--------|---------|--------|
| API Gateway | `@ozdna/gateway` | v0.1 |
| Model Router | `@ozdna/router` | v0.1 (rule-based) |
| Prompt Registry | `@ozdna/prompts` | v0.1 |
| API Key Management | `@ozdna/auth` | v0.1 |
| Usage Analytics | `@ozdna/analytics` | v0.1 |
| Cost Engine | `@ozdna/cost` | v0.1 |
| Organization & Workspace | `@ozdna/db` | v0.1 schema — API Q3 2026 |
| Billing & Quotas | `@ozdna/billing` | v0.1 metering |
| Audit Logs | `@ozdna/observability` | v0.1 write-only |
| Admin Dashboard | — | Q4 2026 |
| RAG (supporting) | `@ozdna/rag` | v0.2 |
| Inference orchestration | `@ozdna/inference` | v0.1 |

---

## How we prioritize

1. **Production proof** — features we depend on internally (TezMakale, Comply) ship first
2. **Regulatory deadlines** — OriginDNA build gate (Sep 30) and Dec 2 EU marking wave
3. **Cost and reliability** — routing, caching, RAG evals, observability
4. **Developer experience** — API stability, OpenAPI, SDKs, docs
5. **Enterprise readiness** — trust, security, governance, compliance

---

## Feedback

- **Early access:** [waitlist on ozdna.com](https://ozdna.com/#waitlist)
- **Issue tracking:** [Linear — ozDNA team](https://linear.app/georiskengine/team/OZD/all)
- **Feature requests:** Linear (projects: Platform GA Q3/Q4, 0 TL Launch)
- **Partnerships:** [partners page](https://ozdna.com/partners/) · hello@ozdna.com

---

*Last updated: July 2026 — aligned with public site v0.1*
