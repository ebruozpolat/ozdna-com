# ozdna.com SEO strategy (October 2026)

**Status:** working draft for the founder.
- **Replaces:** the ozDNA Platform SEO system (LLM cost, RAG, "LiteLLM alternative"), archived in
  `archive/2026-07-platform/`.
- **Search-volume and difficulty columns are blank on purpose.** They need Search Console and a
  keyword tool. Nothing here is estimated.

## 1. Positioning (single source: the homepage)

| Element | Wording to use |
|---|---|
| Brand line | ozDNA — *Claims you can check. It's in the DNA.* |
| Category | **AI verifiability infrastructure** |
| Method | Cite. Sign. Verify. AI output earns trust when the evidence travels with it. |
| ComplyDNA | **Citation-first compliance intelligence** for Turkish financial regulation; every answer links to the regulatory text behind it |
| OriginDNA | **Provenance for AI-generated content**: fingerprint, signature, timestamp, verification |
| Entity | ozDNA is a brand of **Kolaxa** (Kolaxa Yazılım Teknoloji Sanayi ve Ticaret Ltd. Şti., Balıkesir University Teknopark) |

### 1.1 Language rules (titles, descriptions, headings, JSON-LD, llms.txt)

**Do not use:**
- "compliance LLM" / "uyum LLM'i", "trained on Turkish regulation";
- "RAG", "AI gateway", "model routing", "LLM cost optimization", "vertical AI infrastructure";
- "blockchain", "on-chain";
- "guarantee(s) compliance", "trusted Content Credentials", "C2PA certified";
- "Findbelow".

**Use:**
- "citation-first", "statutory citation", "verifiable", "provenance";
- "EU AI Act Article 50", "content marking";
- "MASAK", "5549", "6415", "KVKK".

**Copy rules:**
- Lead with outcomes. Technology (C2PA, hashing, anchoring) is supporting detail and never the
  headline (repo `CLAUDE.md` hard rules 4 and 5).
- `/oversight/` is a separate product line. Its pages must not compete for ComplyDNA / OriginDNA
  queries.

## 2. Keyword clusters → pages

Intent: **C** = commercial, **I** = informational, **N** = navigational/brand. Volume is to be
measured. Fill in from Search Console / a keyword tool before prioritising.

### 2.1 OriginDNA: EU AI Act content marking (primary revenue cluster, EN)

| Query family | Intent | Target page | Status |
|---|---|---|---|
| EU AI Act Article 50 content marking / labelling requirements | I→C | `/products/origin/` (+ future explainer) | page live; explainer **missing** |
| AI-generated image labelling / watermark requirements EU | I | future explainer | missing |
| Article 50 deadline / Dec 2 2026 grace period generative AI | I | `/products/origin/` "why now" | live |
| California SB 942 AI Transparency Act requirements | I | future explainer | missing |
| image provenance API / content provenance for GenAI apps | C | `/products/origin/` | live (waitlist) |
| verify image origin / check if image was modified | C/I | `/verify/` | live (prototype) |
| C2PA signing (must state: not a certified conformance member) | I | `/products/origin/` | live; wording rule 1.1 |

### 2.2 ComplyDNA: Turkish compliance (TR first)

| Query family | Intent | Target page | Status |
|---|---|---|---|
| MASAK şüpheli işlem bildirimi süresi / yükümlülükleri | I | `/tr/products/comply/` + future rehber | rehber **missing** |
| 5549 sayılı kanun yükümlülükleri, 6415 terörün finansmanı | I | future rehber | missing |
| kripto varlık hizmet sağlayıcı MASAK yükümlülükleri | I→C | future rehber | missing |
| uyum yazılımı / AML uyum aracı / mevzuat asistanı | C | `/tr/products/comply/` | live |
| KVKK uyum (secondary; do not dilute the AML focus) | I | — | not targeted yet |
| EN: Turkish AML compliance / MASAK regulation | I→C | `/products/comply/` | live |

### 2.3 Brand and category (N/I)

| Query family | Target page |
|---|---|
| ozDNA, ComplyDNA, OriginDNA, Kolaxa ozDNA | `/`, `/tr/`, product pages |
| AI verifiability, verifiable AI output, citation-first AI | `/` (category page) |

### 2.4 Out of scope for this site's SEO

- LLM cost, RAG reliability, model routing, gateway comparisons: retired narrative, 404 pages.
- Academic / research-integrity queries: tezmakale's audience. Link from the homepage "Research
  integrity" section; do not build pages here until the research-provenance API launches.
- AI oversight (AI Act Art. 9/12/13/14): the `/oversight/` line, with its own plan in
  `docs/oversight/`.

## 3. Technical baseline (state after the Oct 2026 update)

| Item | State |
|---|---|
| `sitemap.xml` | 20 live URLs; 404 pages (`/pricing/`) removed; lastmod updated |
| `robots.txt` | Allows crawlers; internal paths disallowed (unchanged) |
| `llms.txt`, `llms-full.txt`, `ai.txt`, `knowledge/*.md` | Rewritten to the positioning above; publisher Kolaxa |
| JSON-LD | Homepage: Kolaxa Organization, ozDNA Brand, WebSite. Product and legal pages: Organization node → Kolaxa (`#kolaxa`) |
| hreflang | `/` ↔ `/tr/`, product pages EN ↔ TR (unchanged) |
| `seo/site.json`, `seo/sitemap-urls.json` | Kolaxa organization; live URL list only |
| `seo/pages.json` + `scripts/apply-seo.mjs` | Still carry entries for 404 pages; **do not re-run `apply-seo.mjs` on the new homepage** (it has no SEO markers and would be rewritten). Cleanup is §5 item 4 |

## 4. Content queue (proposals, not built)

1. **EU AI Act Article 50 explainer** (EN): what must be marked, who must mark it, the dates,
   and what "machine-readable" means. It links to OriginDNA. Every legal claim is checked against
   the official text first.
2. **MASAK şüpheli işlem bildirimi rehberi** (TR): obligations and deadlines with article
   citations, written in the same citation-first style ComplyDNA promises.
3. **California SB 942 explainer** (EN): only after the text is verified.
4. **Verify page** improvements: an explainer of what each check proves, targeting "verify image
   origin".

Each piece needs a primary-source check before publication. The forbidden-word gate
(`oversight/scripts/check-forbidden.sh`) currently scans only `index.html`, `oversight/` and
`verify/`. Extending it to `products/` is §5 item 3.

## 5. Open items (founder)

1. Measure: connect Search Console for ozdna.com and export the current query set. Fill in the
   volume columns in §2.
2. Legal pages: the body text of `/privacy/` and `/terms/` still names "ozDNA" as the contracting
   party / data controller and describes "the ozDNA platform API". Updating it to Kolaxa needs
   legal review. Only meta descriptions were changed.
3. Extend the forbidden-word gate to `products/**` and `tr/products/**` with the §1.1 list.
4. Prune `seo/pages.json` to live pages and add SEO markers to the new homepage (or retire
   `apply-seo.mjs`).
5. OriginDNA status lines ("MVP ships October 2026") are now time-sensitive. Confirm before the
   next crawl.
