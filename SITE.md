# ozdna.com — GitHub Pages

Public marketing site for the ozDNA brand. Root `index.html` is the **ComplyDNA** landing; product deep-links and legacy platform pages live under `products/`, `blog/`, etc.

## Hosting

| Surface | Where | Notes |
|---------|--------|--------|
| **ozdna.com** (marketing) | **GitHub Pages** — `ebruozpolat/ozdna-com`, branch `main`, `/ (root)` | Custom domain via `CNAME` |
| **ComplyDNA API / demo** | On-prem / separate host (`complydna/` → `make serve`) | Pages does not run Python |
| **Netlify (`ozdna-614`)** | Not the canonical marketing host | Remove `ozdna.com` from Netlify when Pages DNS is live |

One canonical marketing host: **GitHub Pages**. Avoid dual DNS (Netlify + Pages).

## Static site files (root)

| File | Role |
|------|------|
| `index.html` | ComplyDNA landing (single file, embedded CSS) |
| `og.png` | Social share image (1200×630) |
| `robots.txt` | Search + AI crawler allowlist; `Disallow` for `/plan/`, `/complydna/`, `/platform/`, etc. |
| `sitemap.xml` | Full site URL set (homepage + product/docs/blog paths) |
| `llms.txt` | LLM-oriented product summary (TR/EN) |
| `CNAME` | Custom domain: `ozdna.com` |
| `.nojekyll` | Skip Jekyll processing on Pages |

Monorepo orientation for engineers stays in root `README.md` (OriginDNA / plan corpus). This file is the publish runbook only.

## Publish

1. Merge/push site changes to `main`.
2. GitHub → **Settings → Pages** → Deploy from branch → `main` / **`/ (root)`**.
3. **DNS** (registrar) — GitHub Pages only:

   ```
   A     @    185.199.108.153
   A     @    185.199.109.153
   A     @    185.199.110.153
   A     @    185.199.111.153
   CNAME www  ebruozpolat.github.io
   ```

4. Pages → custom domain `ozdna.com` → **Enforce HTTPS** after DNS propagates.

## Contact CTAs

Landing mailto targets use `hello@ozdna.com`. Until that mailbox exists, replies may bounce — swap the address in `index.html` / `llms.txt` when corporate mail is ready.

## Sitemap

Keep the **full** URL set while `products/`, `blog/`, `pillars/`, etc. remain published. Bump `<lastmod>` on changed URLs when content updates. Do not collapse to a single homepage URL unless those paths are removed from the deploy.
