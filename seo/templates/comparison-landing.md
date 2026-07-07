# Comparison Landing — Authoring Template

**Use for:** `/compare/{slug}/` pages  
**Publish path:** Copy fields into `scripts/ozdna-seo-phase2-data.json` → `comparisons[]` → run generator.

---

## Frontmatter (required)

```yaml
slug: litellm-alternative          # URL: /compare/{slug}/
competitor: LiteLLM                # Display name (exact brand spelling)
keyword: LiteLLM alternative       # Primary SEO target
title: LiteLLM Alternative — LLM Cost + RAG Governance | ozDNA
description: Compare LiteLLM vs ozDNA for vertical AI teams. Gateways route requests; ozDNA adds workflow cost control, RAG governance, and token economics.
tagline: LiteLLM alternative       # H1 first line
parentPillar: cost-control         # internal-links.json pillar slug
utm_campaign: litellm-alternative    # waitlist CTA
```

### Meta checklist

| Field | Max length | Rule |
|-------|------------|------|
| `title` | ~60 chars | Competitor name first; pipe `ozDNA` |
| `description` | ~155 chars | "Compare X vs ozDNA" + differentiation line |
| `h1` line 1 | — | `{tagline}` |
| `h1` line 2 | — | `for vertical AI teams` (accent span in HTML) |

---

## Page structure

### 1. Hero (`page-hero`)

**Section label:** `Comparison`

**H1:**
```
{tagline}
for vertical AI teams
```

**Lead paragraph (2–3 sentences):**
- Sentence 1: What the competitor does well (fair, specific).
- Sentence 2: Where vertical AI teams outgrow a gateway-only stack.
- Sentence 3: ozDNA positioning — *"Gateways route requests; ozDNA adds RAG governance + cost optimization for vertical AI products."*

**Example (LiteLLM):**
> LiteLLM is a strong open-source proxy for multi-provider routing. ozDNA is built for teams shipping **vertical AI products** — where RAG reliability, token economics, and production margin matter as much as model failover.

---

### 2. Feature comparison (`compare-section`)

**Section label:** `Feature comparison`  
**H2:** `Gateway vs vertical AI infrastructure`  
**Desc:** Fair comparison framing + link to live proof ([TezMakale](https://tezmakale.com)).

#### Feature table rows (customize per competitor)

| Capability | {Competitor} | ozDNA |
|------------|--------------|-------|
| Multi-provider LLM routing | Yes | Yes |
| Fallback / retry across models | Yes / Partial | Yes |
| Cost per request / workflow | Basic / Varies | First-class cost engine |
| Usage economics (credits → spend) | — | Built-in |
| Production RAG layer | — | RAG operating layer |
| Vertical modes (academic, legal, financial) | — | Prompt + corpus per mode |
| Live production vertical AI proof | Varies | [TezMakale](https://tezmakale.com) |
| Deployment model | Self-host / SaaS | Managed PaaS (private beta) |

**Cell values:** `Yes` · `Partial` / `Varies` · `—` (em dash for not applicable)

**JSON shape for generator:**
```json
{
  "featureRows": [
    { "capability": "Multi-provider LLM routing", "competitor": "yes", "ozdna": "yes" },
    { "capability": "Cost per request / workflow", "competitor": "partial", "competitorLabel": "Basic logging", "ozdna": "yes", "ozdnaLabel": "First-class cost engine" }
  ]
}
```

---

### 3. When ozDNA wins (`pillars` section)

**Section label:** `When ozDNA wins`  
**H2:** `You need more than a routing proxy.`

Three cards:

| # | Title | Body |
|---|-------|------|
| 01 | Margin-aware AI SaaS | Map user credits to real inference cost. Route cheap models for bulk, premium for quality-critical steps. |
| 02 | RAG that survives launch | Chunking, freshness, hybrid retrieval, eval hooks — not vector search bolted onto a gateway. |
| 03 | Vertical depth | Academic AI at TezMakale. RegTech at ComplyDNA. Same stack, different corpora. |

---

### 4. Production proof (`partner-strip`)

**Section label:** `Production proof`  
**H2:** `Not a fork — a live product on ozDNA`  
**Body:** TezMakale handles real traffic: detection, reports, token limits, peak-season spikes.  
**Actions:** Case study link + TezMakale external link.

---

### 5. CTA (`cta-section`)

**H2:** `Switching from {Competitor}?`  
**Body:** Join early access — mention {Competitor} on the waitlist.  
**Primary button:** `Get Early Access`  
**URL:** `/#waitlist?utm_source=compare&utm_medium=seo&utm_campaign={slug}`  
**Secondary:** Docs, Pricing ghost buttons.

---

### 6. Footer disclaimer (required)

> © 2026 Findbelow Ventures · {Competitor} is a separate project; this page compares product fit, not affiliation.

---

## Competitor-specific notes

### LiteLLM
- **Strength:** OSS, self-host, huge provider matrix, community adoption.
- **Gap:** No RAG ops layer, no vertical modes, no credit economics.
- **Tone:** Respectful — many teams start here.

### Portkey
- **Strength:** Gateway + observability, enterprise polish.
- **Gap:** Vertical RAG governance, token economics for SaaS pricing.
- **Tone:** "When routing + observability fit is enough vs when you ship vertical products."

### Helicone
- **Strength:** Observability, logging, cost visibility.
- **Gap:** Full vertical stack (RAG + routing policy + margin controls).
- **Tone:** "Observability vs vertical AI infrastructure."

### OpenRouter
- **Strength:** Model marketplace, easy multi-model access.
- **Gap:** Production RAG, workflow attribution, vertical corpora.
- **Tone:** "Model access vs production vertical AI operating layer."

---

## JSON entry template

Copy into `scripts/ozdna-seo-phase2-data.json`:

```json
{
  "slug": "COMPETITOR-alternative",
  "competitor": "CompetitorName",
  "keyword": "CompetitorName alternative",
  "title": "CompetitorName Alternative — ozDNA for Vertical AI Teams",
  "description": "Compare CompetitorName vs ozDNA: gateways route requests; ozDNA adds RAG governance, token economics, and vertical AI proof.",
  "tagline": "CompetitorName alternative",
  "parentPillar": "cost-control",
  "competitorStrengths": "One sentence on what they do well.",
  "ozdnaPositioning": "One sentence on vertical AI differentiation.",
  "featureRows": [],
  "whenOzdnaWins": [
    { "title": "Margin-aware AI SaaS", "body": "..." },
    { "title": "RAG that survives launch", "body": "..." },
    { "title": "Vertical depth", "body": "..." }
  ]
}
```

---

## Publish workflow

```bash
# 1. Fill JSON from this template
# 2. Generate HTML + update pages.json + sitemap
node scripts/generate-ozdna-seo-phase2.mjs

# 3. Inject meta + JSON-LD
node scripts/apply-seo.mjs

# 4. (Optional) TR mirror
node scripts/build-tr-site.mjs
```

See [`CONTENT-WORKFLOW.md`](../CONTENT-WORKFLOW.md) for full runbook.

---

*Findbelow Ventures — Internal template | July 2026*
