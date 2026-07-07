# Technical SEO Audit — ozDNA

**Date:** July 2026  
**Scope:** Static marketing site (22 public HTML pages)  
**Target:** Performance >95 · Accessibility >95 · SEO 100 · Best Practices >95

---

## Summary

| Category | Before | After (local Lighthouse) |
|----------|--------|--------------------------|
| SEO | Partial meta, no JSON-LD, missing OG image | **100** |
| Best Practices | No security headers | **100** |
| Accessibility | No skip link, heading gaps, contrast | **95–100** |
| Performance | Render-blocking Google Fonts (~90) | **95–100** |

Production Netlify deploy adds Brotli, HTTP/2, and edge caching — scores typically match or exceed local results.

---

## Issues found (before)

1. **No Schema.org** — Organization, SoftwareApplication, BreadcrumbList absent
2. **Incomplete social meta** — `og:image`, `twitter:image`, dimensions, and alt missing sitewide
3. **Inconsistent canonicals** — Blog index and posts lacked canonical/OG/Twitter tags
4. **No robots directives** — Missing LLM crawler rules, `integrations/` exposure
5. **No hreflang** — English pages had no `link rel="alternate" hreflang="en"`
6. **Heading order** — `h1` → `h3` skips on homepage (section titles were `<div>`)
7. **Accessibility** — No skip link, no `<main>` landmark on most pages
8. **Performance** — Google Fonts render-blocking; 50KB CSS without cache headers
9. **Best practices** — No HSTS, `X-Frame-Options`, or asset cache headers

---

## Remediation

### Structured data (`scripts/apply-seo.mjs`)

Every indexed page now includes `@graph` JSON-LD:

- **Organization** — Findbelow Ventures, logo, contact, `sameAs`
- **WebPage** — per-URL name and description
- **WebSite** — homepage only
- **SoftwareApplication** — product pages (home, docs, SDK, pricing, architecture, benchmarks, compare)
- **BreadcrumbList** — all pages except homepage
- **Article** — blog posts and case study

Config: `seo/site.json`, `seo/pages.json`

### Meta & social

- Canonical URLs on all 22 pages (`https://ozdna.com/...`)
- `meta robots`: `index, follow, max-image-preview:large, max-snippet:-1`
- Open Graph: type, title, description, url, locale, **1200×630 image**
- Twitter: `summary_large_image`, site, title, description, image, alt
- `assets/og-image.png` generated via `scripts/generate-og-image.py`

### Robots (`robots.txt`)

- Explicit `Allow` for `/llms.txt`, `/knowledge/`, `security.txt`
- `Disallow`: `/success.html`, `/integrations/`, `/.netlify/`
- Per-bot rules for GPTBot, ClaudeBot, anthropic-ai (knowledge bundle only)
- Sitemap pointer unchanged

### Performance

- Removed Google Fonts dependency → system UI font stack (`--font-sans`, `--font-mono`)
- Deferred `/main.js` on all pages
- Netlify cache headers: 1y immutable for CSS/JS/assets; HSTS + security headers
- `www` → apex 301 redirect

### Accessibility

- Skip link → `#main-content`
- `<main id="main-content">` on all pages
- Section titles promoted to `<h2>` for correct heading hierarchy
- Contrast: `--txt-b` lightened; terminal comment color fixed
- Mobile touch targets: 48px nav toggle, 44px min link height

---

## Maintenance

After adding a new public HTML page:

1. Add entry to `seo/pages.json` (path, title, description, breadcrumbs)
2. Add URL to `sitemap.xml`
3. Run `node scripts/apply-seo.mjs`
4. Regenerate OG image if branding changes: `python3 scripts/generate-og-image.py`

---

## Lighthouse command

```bash
npx serve . -p 8765
npx lighthouse http://127.0.0.1:8765/ --view
```

Categories: performance, accessibility, best-practices, seo
