---
title: Phase 2 Model Strategy
tags: [model, phase-2, fine-tuning, alignment, infrastructure, findbelow-ventures]
related: [overview.md, ecosystem.md, integration.md]
---

# Phase 2 Model Strategy

How ozDNA moves from **"built on ozDNA"** (gateway + RAG + economics) to **"powered by ozDNA's own model"** without sacrificing vertical product quality or margin discipline.

## Current state (Phase 1)

OzDNA GPT is an infrastructure layer: OpenAI API wrapped with prompts, RAG, and (roadmap) routing, caching, and cost optimization. It is **not** a standalone foundation model.

| Layer | Role today |
|-------|------------|
| Inference | Third-party APIs (OpenAI primary) |
| Differentiation | RAG, vertical modes, token economics, workflow cost control |
| Products | tezmakale.com (live), OzDNA Academic / Comply (Phase 2) |
| B2B story | Vertical AI business economics — not call-level gateway parity |

Phase 1 is the correct focus: prove economics, RAG reliability, and vertical depth before owning model weights.

## Strategic goal (Phase 2–3)

Own **domain-tuned model weights** for high-volume, privacy-sensitive, or margin-critical workflows — while keeping frontier models as **fallback** for hard general reasoning.

Target positioning shift:

| Before | After |
|--------|-------|
| Built on ozDNA | Powered by ozDNA's own model |
| API cost pass-through risk | Inference cost partially under ozDNA control |
| Data leaves customer trust boundary | On-prem / dedicated GPU option becomes credible |
| White-label = prompts + API key | White-label = branded model + infra |

This does **not** require training a foundation model from scratch on day one.

## Reference: train-llm-from-scratch

Educational repo: [FareedKhan-dev/train-llm-from-scratch](https://github.com/FareedKhan-dev/train-llm-from-scratch) (~6.4k stars, MIT, actively maintained).

**What it provides:** end-to-end pipeline in pure PyTorch (no `trl` / `peft` / `transformers`) on a custom decoder-only Transformer.

```
Pretrain (Pile) → Base checkpoint
       ↓
SFT (Alpaca, Dolly, GSM8K)
       ↓
Reward Model (HH-RLHF, UltraFeedback)
       ↓
PPO / DPO / GRPO (GSM8K verifier)
```

| Component | Location in repo |
|-----------|------------------|
| Architecture (attention, MLP, blocks) | `src/models/` |
| Pretraining | `scripts/train_transformer.py`, `scripts/pretrain_base.py` |
| Post-training | `src/post_training/` (SFT, RM, PPO, DPO, GRPO) |
| Config | `configs/*.json` |
| Docs | `docs/`, [POST_TRAINING.md](https://github.com/FareedKhan-dev/train-llm-from-scratch/blob/main/POST_TRAINING.md) |

**Realistic scale from repo docs:** ~400M params on 2×H100, multi-day pretrain; 13M runs on Colab/T4 as a teaching demo. Absolute benchmark scores stay modest vs frontier — the value is **pipeline authenticity**, not SOTA quality.

**ozDNA use of this repo:** learn and prototype the alignment chain (SFT → DPO/GRPO). **Do not** treat it as the production inference stack.

## Strategy matrix (honest)

| Path | Cost | B2B narrative | Quality | ozDNA fit |
|------|------|---------------|---------|-----------|
| **A — Scratch pretrain** (this repo, Pile → base) | Very high | Strongest ("own foundation model") | Low–medium | Poor for Phase 2 — overkill, long pole |
| **B — Open-weight fine-tune** (Llama / Qwen / Mistral + SFT/DPO) | Medium | Strong ("ozDNA-tuned model") | High | **Recommended primary path** |
| **C — Gateway + RAG only** (Phase 1) | Low | "Built on ozDNA" | Highest (frontier APIs) | **Current — keep as default** |
| **D — Hybrid B + C** | Medium | "Powered by ozDNA model + frontier fallback" | High | **Phase 2–3 target architecture** |

## Recommended architecture: Hybrid (D)

```
                    ┌─────────────────────────────────┐
  Client request ──►│ ozDNA router (cost + capability) │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
     ozDNA domain model      RAG + vertical modes   Frontier fallback
     (fine-tuned 7B–32B)     (existing pillar)      (GPT-4o / Claude)
              │                    │                    │
              └────────────────────┴────────────────────┘
                                   │
                          Unified API + token economics
```

### Routing rules (draft)

| Signal | Route to |
|--------|----------|
| Vertical mode = academic TR, detect, humanize | ozDNA domain model |
| RegTech query with retrieved 5549/BDDK/MASAK context | ozDNA domain model + RAG |
| Long-context reasoning, novel general task | Frontier fallback |
| Customer contract = data residency / no third-party LLM | ozDNA domain model only |
| Model confidence below threshold | Frontier fallback (logged for eval) |

Routing aligns with existing pillars: **cost per workflow**, not cost per call.

## What we gain

| Gain | Reality | B2B impact |
|------|---------|------------|
| Own-model narrative | Marketing + procurement differentiation | Enterprise: sovereignty, white-label depth |
| Pricing independence | Inference $ partially decoupled from OpenAI list price | Margin resilience (pillar 4) |
| Data privacy claim | Customer payloads can stay on ozDNA GPU boundary | RegTech, fintech (OzDNA Comply) |
| Alignment pipeline knowledge | SFT/DPO/GRPO on domain data | Vertical depth compounds (pillar 3) |
| Cost routing synergy | Small model handles bulk traffic | Pillar 1 — measurable $/workflow |

## What we do not gain (risks)

| Risk | Why it matters | Mitigation |
|------|----------------|------------|
| Frontier parity | 7B fine-tune ≠ GPT-4o on open-ended reasoning | Hybrid fallback + eval gates |
| Scratch pretrain cost | 400M+ pretrain = days on H100; 7B+ = $10k–$100k+ | Skip A; start from open weights |
| Repo ≠ production | No vLLM, quantization, batching in teaching repo | Separate inference layer (vLLM/TGI) |
| Domain ≠ Pile | Vertical edge is **data + workflow**, not base LM | Fine-tune on TezMakale, reg corpora |
| Team load | ML + infra + eval becomes ongoing | Phase gate: one vertical, one model first |
| "Wrapper" label persists | Hard tasks still need frontier | Honest hybrid positioning |

## Phased execution

### Phase 2a — Foundation (no customer-facing model change)

- [ ] Stand up eval harness: vertical benchmarks per product (academic TR, compliance retrieval accuracy)
- [ ] Instrument router: log route decision, latency, cost, quality proxy per request
- [ ] Curate training data from production (with consent/policy): TezMakale workflows, Comply RAG pairs
- [ ] Prototype SFT on open-weight 7B (Qwen 2.5 / Llama 3.x) — use alignment **patterns** from train-llm-from-scratch, implement with `transformers` + `peft` or TRL for speed

### Phase 2b — First ozDNA model (single vertical)

- [ ] Ship **ozDNA Academic 7B** (or internal codename) for detect/humanize high-volume paths on tezmakale.com
- [ ] Deploy inference: vLLM on dedicated GPU (RunPod / Lambda / own metal)
- [ ] A/B vs OpenAI path: quality, cost per workflow, margin
- [ ] Customer-facing copy: "powered by ozDNA model" where route hits own weights

### Phase 2c — Comply + alignment

- [ ] SFT on instruction + citation format for regulatory Q&A
- [ ] DPO from human preference on compliance answers (correctness > fluency)
- [ ] Optional GRPO-style verifier for structured regulatory outputs
- [ ] Enterprise tier: dedicated endpoint, no frontier fallback

### Phase 3 — Scale

- [ ] Multi-model registry (academic, comply, general-small)
- [ ] Distillation from frontier on high-value traces (margin-aware)
- [ ] Evaluate whether custom **small** scratch model (100M–400M) makes sense for edge/on-prem — only if unit economics justify

## Production stack (separate from teaching repo)

| Concern | Teaching repo | ozDNA production |
|---------|---------------|------------------|
| Training | Pure PyTorch scripts | `transformers` + `peft` / TRL, or internal jobs on Modal/Anyscale |
| Inference | `generate_text.py` | vLLM or TGI, OpenAI-compatible server |
| Quantization | None | AWQ/GPTQ for cost |
| Observability | WandB optional | Existing cost-per-request pillar + route logs |
| Gateway | N/A | LiteLLM/Portkey as **complementary** fallback layer |

## Messaging guidelines

**Say:**

- "Powered by ozDNA's domain-tuned model for [academic / compliance] workflows"
- "Hybrid inference: ozDNA model for volume and privacy; frontier when the task requires it"
- "Your data stays on ozDNA inference boundary" (only when contractually true)

**Do not say:**

- "We trained GPT from scratch" (unless literally true at scale)
- "No third-party AI" (hybrid is the honest default)
- "Frontier-quality on all tasks" (eval-backed routing required)

## Success metrics

| Metric | Phase 2 target |
|--------|----------------|
| % traffic on ozDNA weights | ≥60% for tezmakale core workflows |
| Cost per workflow vs OpenAI-only | ≥30% reduction on routed paths |
| Quality parity (eval suite) | ≥95% of OpenAI path on in-vertical tasks |
| Fallback rate | <15% after tuning |
| Enterprise pipeline | ≥1 deal citing data residency / own model |

## Decision log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-06-16 | Hybrid (D) over scratch (A) | Margin, time-to-market, quality floor |
| 2026-06-16 | train-llm-from-scratch = pipeline reference, not prod fork | Educational PyTorch; ozDNA needs vLLM + open weights |
| 2026-06-16 | First ship target: Academic vertical on tezmakale.com | Live production data + token economics proof |
| 2026-06-16 | Budget & co-investment packages documented | Ready for B2G / corporate sovereign-model partners |

## TezMakale: reducing measurable API cost

TezMakale is the live proof surface for ozDNA token economics. Cost work starts **before** own-model Phase 2 — most margin is recoverable with Phase 1 levers. Separate **detect** and **humanize** limits already reflect different cost/quality bars; extend that discipline across every inference call.

### Principle: cost per workflow, not per user session

Tag every call with `workflow`, `step`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `cache_hit`. Without this, optimization is guesswork. Target dashboard: top 3 steps by monthly $ — fix those first.

### TezMakale workflow map (typical)

| Workflow | Steps (example) | Cost driver | Quality bar |
|----------|-----------------|-------------|-------------|
| **Detect** | ingest → chunk/score → aggregate | Input tokens × chunks; repeated scans | High precision, lower creativity need |
| **Humanize** | analyze → rewrite → polish | Output tokens; multi-pass | High — user-visible quality |
| **Advise / Q&A** | retrieve (if any) → generate | Context + output length | Medium–high |

### Phase 1 levers (no own model — implement now)

| # | Lever | Applies to | Expected impact | Effort |
|---|-------|------------|-----------------|--------|
| 1 | **Per-step model routing** | Detect → small/cheap model; Humanize → capable model only on final pass | 25–50% on detect-heavy traffic | Medium |
| 2 | **Eval-gated downgrade** | Build 200–500 real anonymized samples per step; only downgrade when metrics hold | 15–40% on routed steps | Medium |
| 3 | **Single-pass humanize default** | Remove hidden multi-pass unless user pays premium tier | 20–35% on humanize | Low |
| 4 | **Prompt compression** | Audit system prompts; dedupe instructions across steps | 5–15% global | Low |
| 5 | **Structured outputs** | JSON / schema for detect scores, flags — fewer rambling tokens | 10–20% on detect | Low |
| 6 | **Semantic + exact cache** | Repeated paragraphs, boilerplate academic phrases, re-scans | 10–30% on repeat users | Medium |
| 7 | **Chunk budget (detect)** | Cap chunks per document; sample long theses strategically | 15–40% on long inputs | Medium |
| 8 | **Pre-LLM heuristics** | Rule/embedding screen before API — skip obvious non-AI spans | 5–15% | Low–medium |
| 9 | **Retrieval budget** | If RAG used: max chunks, max tokens per chunk | 10–25% on advise flows | Low |
| 10 | **Batch / async tier** | Non-urgent jobs → Batch API or off-peak queue | 10–20% on eligible volume | Medium |
| 11 | **Credit pools by workflow** | Already split detect vs humanize — enforce hard ceilings per pool | Margin protection | Low |
| 12 | **Abuse / retry caps** | Max regenerations per session; block loop patterns | Stops tail-risk burn | Low |

**Realistic Phase 1 stack target:** **30–45% API cost reduction** on tezmakale core workflows without own model — if routing + caching + prompt discipline ship together. Not "80% savings" without quality regression.

### Phase 2 levers (own model + hybrid)

| Lever | When | Expected impact |
|-------|------|-----------------|
| Route detect + bulk humanize to **ozDNA Academic 7B** (quantized) | After 2b eval pass | 40–70% on routed paths vs frontier |
| Frontier fallback only on low confidence | Hybrid router live | Quality floor preserved |
| Distillation from frontier traces | Phase 3 | Further downgrade of fallback rate |

### TezMakale cost metrics (track weekly)

| Metric | Phase 1 target | Phase 2 target |
|--------|----------------|----------------|
| $ / detect workflow | −25% vs baseline | −50% |
| $ / humanize workflow | −15% vs baseline | −35% |
| $ / MAU (blended) | −20% | −40% |
| % calls on cheapest passing model | ≥50% | ≥70% (incl. own weights) |
| Cache hit rate | ≥10% | ≥20% |
| Gross margin per paid user | ↑ quarter-on-quarter | ↑ |

### What not to do on TezMakale

- Downgrade humanize to the same model as detect — NPS and refund risk.
- Optimize globally when one feature (e.g. unlimited re-scan) drives 40% of spend.
- Ship own model without A/B — marketing claim before eval is liability.

---

## Budget & funding

### Budget scenarios (12-month horizon)

Hybrid fine-tune path (recommended). **Not** scratch foundation model.

| Scenario | Scope | USD | TRY (~₺34) | Team shape |
|----------|-------|-----|------------|------------|
| **Lean** | 2a + 2b — Academic / tezmakale only | $45k–80k | 1.5–2.7M ₺ | Founder-heavy + 1 ML contractor |
| **Target** | 2a + 2b + 2c — Academic + Comply MVP | $120k–220k | 4–7.5M ₺ | 1 FT ML + part-time MLOps |
| **Overkill** | Scratch pretrain, multi-model 32B | $400k–1M+ | 13M+ ₺ | Not recommended |

**Planning anchor:** **$60k / ~2M ₺** for first 9 months (Lean → first production model).

### Cost breakdown

#### People (55–70% of total)

| Role | Duration | Monthly | Total |
|------|----------|---------|-------|
| ML engineer (fine-tune, eval, DPO) | 6–9 mo | $4k–7k | $24k–63k |
| MLOps / inference (vLLM, router) | 3–6 mo PT | $2k–4k | $6k–24k |
| RegTech annotator / advisor (2c) | Project | — | $8k–25k |
| KVKK / contracts / data license | One-time | — | $3k–12k |

Turkey contractor lean path: **~$18k–24k** for 6 months ML (quality/speed trade-off).

#### GPU — training (burst)

| Work | GPU hours | Cost |
|------|-----------|------|
| SFT prototype (LoRA 7B, iterations) | 50–150 | $100–400 |
| Production SFT | 100–300 | $300–1,500 |
| DPO / preferences (2c) | 100–400 | $300–2,000 |
| **Training subtotal (12 mo)** | | **$1k–5k** |

#### GPU — inference (recurring)

| Setup | Monthly | 9 mo |
|-------|---------|------|
| 1× L40S/A10, 7B AWQ | $400–900 | $3.6k–8k |
| 2× HA + staging | $800–1,800 | $7k–16k |
| Dedicated Comply endpoint (2c) | +$400–1,000 | +$5k–9k |

Low traffic: serverless burst **$200–500/mo** until SLA requires dedicated.

#### Software & APIs

| Item | Annual |
|------|--------|
| Frontier fallback (still required in hybrid) | $500–5k+ |
| WandB, HF, storage, CI | $1k–3k |
| Eval / labeling | $500–2k |
| Regulatory corpus license (Comply) | $0–15k |

#### Phase cumulative

| Phase | Duration | Increment | Cumulative |
|-------|----------|-----------|------------|
| **2a** Foundation | 2–3 mo | $12k–25k | $12k–25k |
| **2b** First prod model | 3–4 mo | $20k–40k | $32k–65k |
| **2c** Comply | 4–6 mo | $35k–80k | $67k–145k |

### Funding channels (realistic)

| Channel | Amount | Probability | Best narrative |
|---------|--------|-------------|----------------|
| **TÜBİTAK TEYDEB 1501/1512** | 1–3M ₺ grant (up to ~75% eligible) | Medium | KVKK-compliant vertical RegTech AI + cost optimization — **not** "train GPT from scratch" |
| **KOSGEB Ar-Ge** | 200–500k ₺ | Medium | Complementary to TEYDEB |
| **TÜBİTAK 1812** | Limited | Low | Insufficient alone for GPU-heavy Phase 2 |
| **Horizon / Digital Europe** | €100k–500k+ | Medium (high effort) | Consortium; privacy + RegTech |
| **TR pre-seed / angel** | $150k–500k | Medium if tezmakale metrics | Production proof + vertical economics |
| **Strategic corporate pilot** | $20k–100k | Medium (post-Comply MVP) | Fintech / bank / law firm prepay |
| **Cloud credits** | $5k–25k | Low–medium | Training burst offset only |

**Realistic external funding (12 mo, stacked):** **$80k–250k / 2.5–8M ₺** — multi-channel, 6+ month cycles. Do not assume one grant covers full Phase 2.

### Funding narrative — use vs avoid

**Use:**

> "ozDNA builds KVKK-aligned, domain-tuned hybrid inference on a production-proven stack (TezMakale). We cut frontier dependency and per-workflow cost for Turkish academic and RegTech verticals."

**Avoid:**

> "Turkey's OpenAI — training foundation models from scratch."

### Recommended funding sequence

```
1. Bootstrapped Phase 2a ($12–20k, 3 mo) → eval + router + benchmark report
2. Parallel TEYDEB (Comply + sovereign AI + cost)
3. Pre-seed pitch with tezmakale unit economics
4. Comply MVP + 1 fintech pilot LOI → strategic prepay
```

### ROI gate (when to spend)

| Signal | Action |
|--------|--------|
| tezmakale Phase 1 levers shipped; $/workflow measurable | Proceed 2a |
| ≥25% cost cut from routing/cache OR clear enterprise LOI | Proceed 2b |
| Comply data + legal base ready | Proceed 2c |
| MRR cannot cover $600+/mo inference | Delay 2b; optimize Phase 1 first |

---

## Co-investment: sovereign / corporate model development

Ready-to-use structure when a **public institution** (ministry, university, development agency) or **enterprise** (bank, telco, holding) wants to fund a **domain-specific model** built on ozDNA infrastructure — without ozDNA bearing full capex alone.

### What ozDNA brings

| Asset | Description |
|-------|-------------|
| **Production stack** | Router, token economics, RAG patterns, API layer |
| **Live proof** | tezmakale.com — real workload, limits, margin lessons |
| **Training pipeline** | SFT → DPO/GRPO playbook (open-weight path; not scratch) |
| **Vertical modes** | Academic, legal, financial workflow templates |
| **Phase 2 roadmap** | vLLM inference, eval harness, hybrid fallback |
| **Findbelow entity** | Contracting, IP framework, TEYDEB co-application experience (if applicable) |

### What partner brings

| Asset | Typical source |
|-------|----------------|
| **Funding** | Grant co-finance, corporate innovation budget, pilot prepay |
| **Domain data** | Regulatory corpus, internal docs (licensed), anonymized workflows |
| **Distribution** | Captive users — students, compliance officers, citizens |
| **Legal / KVKK** | DPA, data controller role clarity, sector approvals |
| **GPU (optional)** | On-prem or sovereign cloud — especially B2G |

### Package tiers (partner-facing)

#### Tier 1 — Pilot ($25k–60k / 850k–2M ₺ · 3–4 months)

**For:** Single department; proof of domain quality + cost vs frontier.

| Deliverable | Detail |
|-------------|--------|
| Domain eval set | 300–500 curated prompts + golden outputs |
| Fine-tuned adapter | LoRA/SFT on partner-approved open base (7B class) |
| Private endpoint | Dedicated vLLM instance or VPC |
| Benchmark report | Quality vs frontier; $/workflow |
| No exclusivity | Partner domain data stays partner-owned |

ozDNA retains: platform, router, general Academic/Comply improvements.

#### Tier 2 — Co-development ($80k–200k / 2.7–6.8M ₺ · 6–12 months)

**For:** Bank, regulator-tech unit, university consortium, KOSGEB/TEYDEB co-financed project.

| Deliverable | Detail |
|-------------|--------|
| Full hybrid router | Partner-branded route rules + fallback policy |
| SFT + DPO | Preference data from partner reviewers |
| RAG integration | Partner corpus ingestion + freshness pipeline |
| SLA + monitoring | Cost dashboard, quality drift alerts |
| Training run artifacts | Checkpoints on partner infra or escrow |
| **Co-brand option** | "Powered by [Partner] AI, built on ozDNA" |

IP (default term sheet — customize per deal):

- Partner owns **domain dataset** and **partner-specific fine-tuned weights**.
- ozDNA owns **platform, router, non-partner-specific improvements**.
- Mutual license: partner deploys weights; ozDNA may reuse generic techniques, not partner data.

#### Tier 3 — Sovereign deployment ($200k–500k+ / 6.8M+ ₺ · 12–18 months)

**For:** Public sector, critical infrastructure, data-must-not-leave-Turkey requirements.

| Deliverable | Detail |
|-------------|--------|
| On-prem / TR-sovereign cloud | Air-gapped or dedicated region |
| No frontier fallback (optional) | Own model only — eval-gated |
| Multi-model registry | Academic + compliance + internal KB |
| Security package | Audit logs, RBAC, retention policies |
| Operator runbook | Partner IT can operate; ozDNA transition support |
| TEYDEB-aligned reporting | If grant-funded — milestone docs |

### Co-investment budget template (partner pays)

| Line | Tier 1 | Tier 2 | Tier 3 |
|------|--------|--------|--------|
| ML + project lead | $12k–25k | $40k–90k | $90k–200k |
| GPU training | $1k–3k | $3k–10k | $10k–40k |
| GPU inference (annual) | $5k–11k | $10k–22k | $25k–60k |
| Data labeling / domain experts | $3k–10k | $15k–40k | $30k–80k |
| Legal / KVKK | $2k–5k | $5k–15k | $15k–40k |
| ozDNA platform fee | $5k–15k | $15k–40k | $40k–100k |
| **Total** | **$25k–60k** | **$80k–200k** | **$200k–500k+** |

Partner may offset **40–75%** via TEYDEB/KOSGEB if ozDNA + partner joint-apply with R&D project structure.

### Ideal partner profiles

| Segment | Use case | Why they fund |
|---------|----------|---------------|
| **Public university** | Academic integrity, TR thesis tools | National language + education sovereignty |
| **Bank / EMI** | 5549, MASAK, internal compliance Q&A | KVKK, no OpenAI in procurement |
| **Regulator / agency** | Supervisory tech, citizen-facing guidance | Data residency narrative |
| **EdTech / publisher** | Detection, writing assistance B2B | White-label + margin |
| **Defense / critical infra** | Air-gapped assistant | Tier 3 sovereign |

### Procurement hooks (Turkey)

- Align scope with **yerli ve milli** / dijital dönüşüm language — **domain AI**, not generic chatbot.
- KVKK veri işleme sözleşmesi + veri yerelleştirme planı as annex.
- Milestone-based payment: eval pass → pilot → production.
- Open-weight license compliance (Llama/Qwen commercial terms) documented in deliverables.

### Co-investment readiness checklist (ozDNA internal)

- [ ] Tier 1–3 one-pager PDF (TR + EN) from this section
- [ ] Sample MSA + DPA + IP term sheet (lawyer review)
- [ ] TEYDEB project abstract template (RegTech + cost + KVKK)
- [ ] Reference architecture diagram (hybrid router)
- [ ] tezmakale anonymized benchmark summary (when metrics ready)
- [ ] Named contact: hello@ozdna.com — enterprise / public sector lane

### How co-investment feeds Phase 2

Partner revenue **de-risks** ozDNA core Phase 2: partner-funded Tier 2/3 fine-tunes become templates for OzDNA Academic and OzDNA Comply SKUs. tezmakale remains the public margin lab; partner projects fund GPU and ML headcount without diluting product focus.

---

→ Related: [overview.md](./overview.md) · [ecosystem.md](./ecosystem.md) · [integration.md](./integration.md)
