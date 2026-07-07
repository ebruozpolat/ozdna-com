# OriginDNA

**Working product name** (placeholder until brand review) · under the [ozDNA](https://ozdna.com) umbrella

| | |
|---|---|
| **Codename** | OriginDNA |
| **Tagline** | Proof of Origin |
| **Category** | Content provenance infrastructure (SaaS) |
| **Status** | Pre-build — planning corpus in `plan/`, strategy in `docs/BLUEPRINT.md` |
| **Owner corpus** | Received from partner (July 2026); ratified decisions in `docs/ACTION_PLAN.md` |
| **Target MVP** | October 2026 (4-week build, Cloudflare-first) |
| **Linear** | [OriginDNA — Provenance](https://linear.app/georiskengine/project/origindna-provenance-f6ba59a34e95) · Epic [OZD-50](https://linear.app/georiskengine/issue/OZD-50) |
| **Build gate** | September 30, 2026 — see `plan/07-GTM-SEO-PR.md` §2.3 |

---

## One line

Every image gets a DNA — a cryptographic signature at creation, a timestamp no one can backdate, and a perceptual fingerprint that survives when platforms strip metadata.

**v1 scope:** images only (JPG/PNG). No AI detection, no token, no user custody.

---

## Relationship to ozDNA

| Product | Focus | Phase |
|---------|--------|-------|
| **ozDNA Platform** | Vertical AI infrastructure — gateway, routing, prompts, RAG, cost | Live (v0.1) |
| **ComplyDNA** | RegTech — 5549 / BDDK / MASAK / KVKK monitoring | Q3 2026 |
| **OriginDNA** | EU AI Act / SB 942 content marking & provenance registry | Q4 2026 (pending G1 gate) |

OriginDNA is a **separate product line**, not an extension of the LLM gateway. It shares the ozDNA brand and Findbelow Ventures entity only.

---

## Where to read

| Document | Purpose |
|----------|---------|
| [`docs/BLUEPRINT.md`](../BLUEPRINT.md) | Why — market, wedges, architecture thesis |
| [`docs/ACTION_PLAN.md`](../ACTION_PLAN.md) | Live checklist + decisions log |
| [`plan/00-INDEX.md`](../../plan/00-INDEX.md) | How — full pre-implementation corpus |
| [`plan/04-MVP-SPEC.md`](../../plan/04-MVP-SPEC.md) | API, schema, October build scope |
| [`CLAUDE.md`](../../CLAUDE.md) | Agent ground truth + hard rules |

---

## Hard rules (summary)

Full list in `CLAUDE.md`. Non-negotiable for OriginDNA:

1. No token in the core story  
2. Never touch user funds / no custody  
3. No AI detection classifiers in v1  
4. Pitch as “content provenance infrastructure with SaaS revenue” — not “AI × Blockchain”  
5. Never overclaim C2PA trusted status until conformance is achieved  
6. Images only in v1; Cloudflare-first hosting for revenue MVP  

---

## Regulatory clock (why it matters)

| Date | Event |
|------|--------|
| Aug 2, 2026 | EU AI Act Art. 50 + California SB 942 |
| Dec 2, 2026 | Marking grace expires for existing GenAI systems |
| Feb 2, 2027 | Interoperable detection required |

---

*Last updated: July 7, 2026*
