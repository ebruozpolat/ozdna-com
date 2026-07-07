# SEO Content Workflow — ozdna.com

End-to-end runbook for adding or updating blog posts, pillar pages, and comparison landings.

---

## Prerequisites

- Node.js 18+
- Repo root: `ozdna/` (static HTML site)
- Config: `seo/site.json`, `seo/pages.json`, `seo/internal-links.json`

---

## Quick reference

| Content type | Authoring | Data file | Output path |
|--------------|-----------|-----------|-------------|
| Blog | `ozdna-seo-phase2-data.json` → `blogs[]` | `scripts/ozdna-seo-phase2-data.json` | `/blog/{slug}/index.html` |
| Pillar | `seo/content/pillar-{n}-*.md` + JSON `pillars[]` | same | `/pillars/{slug}/index.html` |
| Comparison | `seo/templates/comparison-landing.md` → JSON | same | `/compare/{slug}/index.html` |
| Meta / JSON-LD | Registry | `seo/pages.json` | Injected by `apply-seo.mjs` |
| Sitemap | Master list | `seo/sitemap-urls.json` | `/sitemap.xml` |

---

## Add a new blog post

1. Add entry to `scripts/ozdna-seo-phase2-data.json` → `blogs[]`:
   ```json
   {
     "slug": "my-new-post",
     "title": "Post Title",
     "description": "155-char meta description",
     "pillar": "Pillar 1 · Cost Control",
     "date": "July 2026",
     "datePublished": "2026-07-15",
     "keyword": "target long-tail keyword"
   }
   ```

2. Map links in `seo/internal-links.json`:
   - `blogToPillar.my-new-post` → pillar slug
   - `blogSiblingLinks.my-new-post` → related post slug
   - Add slug to `pillars.{slug}.blogs[]`

3. Generate and apply SEO:
   ```bash
   node scripts/generate-ozdna-seo-phase2.mjs
   node scripts/apply-seo.mjs
   ```

4. Verify: blog index card, sitemap entry, canonical, Article schema.

---

## Update Pillar 1 (or expand other pillars)

1. Edit copy source: `seo/content/pillar-1-cost-control.md`
2. Sync structured fields in `scripts/ozdna-seo-phase2-data.json` → `pillars[]` entry for `cost-control`
3. Regenerate:
   ```bash
   node scripts/generate-ozdna-seo-phase2.mjs
   node scripts/apply-seo.mjs
   ```

---

## Add or refresh a comparison page

1. Fill `seo/templates/comparison-landing.md` sections
2. Copy JSON block into `comparisons[]` in phase2 data
3. Add to `seo/internal-links.json` under relevant pillar's `comparisons[]`
4. Append URL to `seo/sitemap-urls.json` if not covered by phase2 pattern
5. Generate + apply SEO (commands above)

**Note:** LiteLLM page was originally hand-crafted. It is now also in JSON so regeneration stays consistent.

---

## Full publish pipeline

```bash
# From repo root
node scripts/generate-ozdna-seo-phase2.mjs   # HTML, pages.json, sitemap merge
node scripts/apply-seo.mjs                   # title, meta, OG, JSON-LD

# Optional — Turkish mirror (only when i18n chunks exist)
node scripts/build-i18n.mjs
node scripts/build-tr-site.mjs
node scripts/update-sitemap-i18n.mjs
```

---

## UTM conventions

| Page type | Query string |
|-----------|--------------|
| Blog | `?utm_source=blog&utm_medium=seo&utm_campaign=gpu-bill-bodyguard&utm_content={slug}` |
| Pillar | `?utm_source=pillar&utm_medium=seo&utm_campaign=gpu-bill-bodyguard&utm_content={slug}` |
| Compare | `?utm_source=compare&utm_medium=seo&utm_campaign={slug}` |

Defined in `seo/internal-links.json` → `utm`.

---

## Quality checklist (before deploy)

- [ ] Unique `title` and `description` in `pages.json`
- [ ] Blog links to parent pillar + sibling post
- [ ] Pillar lists full blog cluster
- [ ] Comparison has footer disclaimer
- [ ] No VaultScope or unreleased lab references
- [ ] `sitemap.xml` includes new URL
- [ ] hreflang TR alternate only if `/tr/` page exists
- [ ] Run `node scripts/apply-seo.mjs` after any manual HTML edit (re-injects meta block)

---

## Related docs

- Keyword plan: `docs/ozdna_SEO_Keyword_Plani.md`
- Gaps & strengthening: `seo/SEO-GAPS-AND-STRENGTHENING.md`
- Technical audit: `seo/TECHNICAL-SEO-AUDIT.md`
- Comparison template: `seo/templates/comparison-landing.md`

---

*Findbelow Ventures — Internal | July 2026*
