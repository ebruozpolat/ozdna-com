---
title: ozDNA Platform Overview
tags: [overview, b2b, infrastructure, findbelow-ventures]
related: [ecosystem.md, pricing.md, model-strategy.md]
---

# ozDNA — Vertical AI Infrastructure

**ozdna.com** is Findbelow Ventures' B2B infrastructure layer (PaaS). It helps vertical AI startups reduce LLM/API costs, stabilize production RAG, and design token economics that protect margins.

## Positioning

> **Horizontal LLM gateways optimize calls. ozDNA optimizes vertical AI business economics.**

- **Primary:** Vertical AI business economics platform
- **Audience:** Founders, CTOs/ML engineers, investors (Phase 1)
- **Status:** Private beta — early access invite only
- **Language:** English first; Turkish hreflang planned

## OzDNA GPT (shared engine)

Phase 1: OpenAI API wrapped with prompts, RAG, and (roadmap) routing/caching/cost optimization. Not a standalone model — an infrastructure layer. Phase 2 target: hybrid own-model + frontier fallback — see [model-strategy.md](./model-strategy.md).

| Product | Stack role |
|---------|------------|
| tezmakale.com | Live TR academic AI — production token economics |
| OzDNA Academic | Global academic quality (Phase 2) |
| OzDNA Comply | RegTech monitoring — 5549/BDDK/MASAK/KVKK (Phase 2) |
| ozdna.com | B2B API + docs — external infrastructure layer |

## Five pillars

1. **Cost Control** — cost per workflow, not cost per call
2. **Production RAG Reliability** — retrieval governance, freshness, evals
3. **Vertical AI Differentiation** — domain depth vs thin wrappers
4. **Post-Subsidy Margin Resilience** — platform risk from API pricing changes
5. **Tokenomics & Pricing Design** — credits mapped to real token burn

## Differentiation

Horizontal LLM gateways (LiteLLM, Portkey, Helicone) optimize **calls** — routing, observability, and failover at the API layer. ozDNA optimizes **vertical AI business economics** — cost per workflow and outcome, production RAG governance, tokenomics, and margin resilience. Gateways are complementary infrastructure; ozDNA operates above them. Proof: TezMakale and OzDNA Comply in production.

→ Next: [ecosystem.md](./ecosystem.md) · [integration.md](./integration.md)
