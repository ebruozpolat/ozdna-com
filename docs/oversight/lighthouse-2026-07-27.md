# Lighthouse measurement — 2026-07-27 (closes ledger A8)

**Tool:** Lighthouse 12.8.2 · Chrome headless  
**Method:** `python3 -m http.server` on repo root → `http://127.0.0.1:8765/…`  
**Why not deploy-preview:** Netlify preview responses include `x-robots-tag: noindex`, which fails `is-crawlable` and drops SEO to ~66 regardless of page quality.

## Spec target (`docs/oversight/website-spec.md`)

| URL | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/oversight/` | **100** | **100** | **100** | **100** |
| `/oversight/tr/` | **100** | **100** | **100** | **100** |

Criterion **Lighthouse ≥95**: met for the oversight site (all four categories).

## Fixes applied this pass (so a11y could reach ≥95)

1. `--dim` `#6b7480` → `#7d8796` (≥4.5:1 on `--bg`/`--panel-2`)
2. `--accent-dim` `#2f6f66` → `#3d9a8c` (≥4.5:1 on `--panel` for `.card .n`)
3. Body links keep underline (non-color distinguisher for `link-in-text-block`); nav/CTA/brand exempt

## Out of oversight scope (measured for honesty, not the website-spec gate)

| URL | Notes (local, pre-comply/verify contrast pass) |
|---|---|
| `/` (home) | Preview SEO tanked by noindex; a11y had color-contrast fails on marketing labels |
| `/verify/` | Same; a11y ~95 with remaining contrast items |
| `/products/comply/` | Same; a11y ~96 with remaining contrast items |

Those marketing/verify surfaces are **not** claimed ≥95 here — only oversight was the website-spec acceptance criterion.
