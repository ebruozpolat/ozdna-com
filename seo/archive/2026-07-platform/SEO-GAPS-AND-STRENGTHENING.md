# SEO Gaps & Strengthening Plan — ozdna.com

**Findbelow Ventures | July 2026**  
Companion to [`docs/ozdna_SEO_Keyword_Plani.md`](../docs/ozdna_SEO_Keyword_Plani.md)

---

## Executive summary

Phase 2 SEO structure (blog, pillars, comparisons) is live in code. Remaining gaps are **operational** — internal linking discipline, sitemap completeness, TR mirror coverage, and pillar depth — not missing page types.

| Area | Status | Priority |
|------|--------|----------|
| Blog cluster (12 posts) | ✅ Generated | Maintain |
| Pillar landings (5) | ⚠️ Thin body copy | P1 — expand Pillar 1 first |
| Comparison landings (4) | ⚠️ LiteLLM hand-crafted; others template-thin | P2 — align to template |
| Internal linking matrix | ❌ Was implicit | **P0 — now in `internal-links.json`** |
| Sitemap | ❌ Phase-2 generator overwrote core URLs | **P0 — fixed via `sitemap-urls.json`** |
| TR hreflang mirror | ⚠️ Partial (`/tr/pillars/*`, most compares missing) | P2 |
| GPU Bill Bodyguard UTM funnel | ⚠️ Inconsistent across CTAs | P1 |
| Primary keyword cannibalization | ⚠️ Homepage vs Pillar 1 overlap | P1 — hierarchy doc below |
| Markdown authoring layer | ❌ JSON-only generator | P3 — templates in `seo/templates/` |

---

## 1. Internal linking matrix (was missing)

**Problem:** Blog posts, pillars, and comparisons linked ad hoc. Authority did not flow predictably from long-tail → pillar → conversion.

**Fix:** Canonical link rules live in [`internal-links.json`](./internal-links.json).

| Source | Must link to |
|--------|----------------|
| Every blog post | Parent pillar + 1 sibling blog + waitlist CTA |
| Every pillar | All cluster blogs + relevant comparison + architecture |
| Every comparison | Parent pillar(s) + case study + waitlist with `utm_campaign` |
| Homepage | All 5 pillars (footer or hub section) |

**Generator enforcement:** `scripts/generate-ozdna-seo-phase2.mjs` reads `internal-links.json` and injects "Related reading" blocks into blog and pillar HTML.

---

## 2. Primary keyword cannibalization (homepage vs Pillar 1)

**Problem:** Both target `LLM cost optimization`, `LLM routing`, `LLM gateway`.

**Hierarchy (do not change without intent):**

| Page | Role | Primary keywords |
|------|------|------------------|
| `/` (homepage) | Brand hub + platform positioning | `AI cost optimization platform`, `LLM gateway`, `vertical AI infrastructure` |
| `/pillars/cost-control/` | Deep dive — cost & routing | `LLM cost optimization`, `LLM routing`, `AI inference cost reduction` |
| `/compare/*` | Competitor intent capture | `[Competitor] alternative`, `LLM gateway` (secondary) |

**Rules:**
- Homepage H1 stays product-level ("Vertical AI infrastructure"), not "LLM cost optimization" alone.
- Pillar 1 H1 is problem-specific ("Control token burn before it becomes structural").
- Blog titles carry long-tail; they link **up** to pillar, never compete on exact homepage H1 phrasing.

---

## 3. Sitemap completeness

**Problem:** `generate-ozdna-seo-phase2.mjs` replaced `sitemap.xml` with only Phase 2 URLs — dropping `/compare/litellm-alternative/`, `/architecture/`, `/pricing/`, etc.

**Fix:** Master URL list in [`sitemap-urls.json`](./sitemap-urls.json). Generator merges Phase 2 URLs without removing core pages.

**Ongoing:** When adding any new `index.html`, append to `sitemap-urls.json` and run:

```bash
node scripts/generate-ozdna-seo-phase2.mjs
node scripts/apply-seo.mjs
```

---

## 4. Pillar page depth

**Problem:** Generated pillars were ~150 words — insufficient for long-term primary keyword ranking.

**Fix:**
- Full copy + meta for Pillar 1: [`content/pillar-1-cost-control.md`](./content/pillar-1-cost-control.md)
- Generator `pillarBody()` extended with problem framing, capability cards, blog cluster, comparison strip.

**Remaining:** Pillars 2–5 still use short template. Expand using same pattern when Pillar 1 proves stable.

---

## 5. Comparison page consistency

**Problem:** LiteLLM comparison is hand-crafted (rich). Portkey, Helicone, OpenRouter are generator-thin (~5 table rows).

**Fix:**
- Authoring template: [`templates/comparison-landing.md`](./templates/comparison-landing.md)
- Add LiteLLM entry to `ozdna-seo-phase2-data.json` so regeneration does not diverge.
- Regenerate thin comparisons from template fields (`competitorStrengths`, `ozdnaWins`, `featureRows`).

**Google-safe comparison rules:**
- Competitor name in `<title>` and meta description ✅
- "What [X] does well" section before criticism ✅
- Disclaimer in footer (no affiliation) ✅
- No unsubstantiated "better/worse" claims — use capability matrix ✅

---

## 6. GPU Bill Bodyguard campaign alignment

**Problem:** Blog posts mention the series in body copy, but CTAs use inconsistent UTM parameters.

**Standard CTA pattern:**

```
/#waitlist?utm_source=blog&utm_medium=seo&utm_campaign=gpu-bill-bodyguard&utm_content={slug}
```

| Page type | `utm_source` | `utm_campaign` |
|-----------|--------------|------------------|
| Blog | `blog` | `gpu-bill-bodyguard` |
| Pillar | `pillar` | `gpu-bill-bodyguard` |
| Compare | `compare` | `{competitor-slug}` |

---

## 7. Turkish (`/tr/`) mirror gaps

**Problem:** hreflang alternates reference `/tr/pillars/*` and most `/tr/compare/*` but pages do not exist yet.

**Risk:** hreflang to 404 hurts crawl trust.

**Options (pick one):**
1. **Short term:** Remove TR alternates for pages without TR mirror (generator sets `alternateLanguages` only when `tr/` file exists).
2. **Medium term:** Run `build-tr-site.mjs` after adding pillar/compare chunks to `i18n/page-chunks/`.

**Current partial TR coverage:** 4 problem-aware blogs, litellm compare, core product pages. Missing: 8 long-tail blogs, 3 compares, all pillars.

---

## 8. E-E-A-T proof points (VaultScope out of scope)

**Allowed production proof:**
- [TezMakale](https://tezmakale.com) — live vertical AI, peak traffic, token limits
- [ComplyDNA](/products/comply/) — RegTech vertical on ozDNA stack
- [Case study](/case-studies/tezmakale/) — structured narrative

**Do not reference:** VaultScope, personal lab repos, or unreleased eval numbers.

---

## 9. Schema & technical SEO follow-ups

| Item | Status | Action |
|------|--------|--------|
| `FAQPage` on comparisons | ❌ | Add 3–5 FAQs per compare page when copy stabilizes |
| `Article` schema on blogs | ✅ | Via `apply-seo.mjs` |
| `compare` index hub page | ❌ | Optional `/compare/` listing for crawl discovery |
| `pillars` index hub page | ❌ | Optional `/pillars/` listing |
| Blog `dateModified` | ❌ | Update on substantive edits |
| Core Web Vitals on blog templates | ✅ | Static CSS, no framework bloat |

---

## 10. Content priority queue (next 30 days)

Aligned with keyword plan §5:

1. ✅ Problem-aware blogs (4) — live
2. ✅ Long-tail blogs (8) — live
3. 🔄 Comparison depth — template + regenerate Portkey/Helicone/OpenRouter
4. 🔄 Pillar 1 depth — **this sprint**
5. ⏳ Pillars 2–5 depth — next sprint
6. ⏳ TR mirror for pillars + compares — after EN copy frozen

---

## File map (SEO code structure)

```
seo/
├── site.json                  # Global org + SoftwareApplication
├── pages.json                 # Per-page meta (apply-seo.mjs)
├── internal-links.json        # Blog ↔ pillar ↔ compare matrix
├── sitemap-urls.json          # Master sitemap (all public URLs)
├── SEO-GAPS-AND-STRENGTHENING.md   # This file
├── CONTENT-WORKFLOW.md        # Publish runbook
├── content/
│   └── pillar-1-cost-control.md    # Pillar 1 copy + meta source
└── templates/
    └── comparison-landing.md       # Comparison authoring template

scripts/
├── ozdna-seo-phase2-data.json      # Blogs, comparisons, pillars data
├── generate-ozdna-seo-phase2.mjs   # HTML + pages.json + sitemap
└── apply-seo.mjs                   # Meta + JSON-LD injection
```

---

*Findbelow Ventures — Internal | July 2026*
