# Lighthouse measurement — 2026-07-27 (closes ledger A8 + marketing surfaces)

**Tool:** Lighthouse 12.8.2 · Chrome headless  
**Method:** `python3 -m http.server` on repo root → `http://127.0.0.1:8765/…`  
**Why not deploy-preview:** Netlify preview responses include `x-robots-tag: noindex`, which fails `is-crawlable` and drops SEO to ~66 regardless of page quality.

## Spec target (`docs/oversight/website-spec.md`)

| URL | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/oversight/` | **100** | **100** | **100** | **100** |
| `/oversight/tr/` | **100** | **100** | **100** | **100** |

Criterion **Lighthouse ≥95**: met for the oversight site (all four categories).

### Oversight fixes
1. `--dim` `#6b7480` → `#7d8796`
2. `--accent-dim` `#2f6f66` → `#3d9a8c`
3. Body links keep underline (`link-in-text-block`)

## Marketing / product surfaces (same bar, measured + fixed)

`website-spec.md` only binds `/oversight/`. Home, verify, and ComplyDNA were **also** measured and brought to the same ≥95 bar so we do not silently carve them out.

| URL | Performance | Accessibility | Best Practices | SEO |
|---|---|---|---|---|
| `/` | **100** | **100** | **100** | **100** |
| `/tr/` | **100** | **100** | **100** | **100** |
| `/verify/` | **100** | **100** | **100** | **100** |
| `/tr/verify/` | **100** | **100** | **100** | **100** |
| `/products/comply/` | **100** | **100** | **100** | **100** |
| `/tr/products/comply/` | **100** | **100** | **100** | **100** |

### Marketing fixes
1. Light-theme `--accent` `#E23D0E` → `#B52F0B`; `--muted` `#6F6A5C` → `#5C574C` (AA on paper/card)
2. Home heading order: product titles `h3→h2`, principle/why-now cells `h4→h3` (EN + TR)
3. Verify illustrative row: `.check.dim` no longer uses `opacity:0.6` (killed text contrast)
