# ozdna.com — publish runbook

Public marketing site for the ozDNA brand. Root `index.html` is the **ozDNA umbrella**
page; products live at `products/comply/` (ComplyDNA) and `products/origin/` (OriginDNA
waitlist). Full domain/hosting strategy and the static-file inventory: `docs/DOMAIN.md`.

## Hosting

| Surface | Where | Notes |
|---------|--------|--------|
| **ozdna.com** (marketing) | **Netlify** — site `ozdna-614`, repo `ebruozpolat/ozdna-com`, branch `main`, publish dir `.` | Canonical host (DNS-verified 2026-07-08); redirects/headers/forms via `netlify.toml` |
| **ComplyDNA API / demo** | On-prem / separate host (`complydna/` → `make serve`) | Static hosts don't run Python; `/complydna/*` is 404'd at the edge |
| **GitHub Pages** | Disabled (removed 2026-07-09) | Do not re-enable with the custom domain; no `CNAME` file in the repo. Dual DNS (Netlify + Pages) is the failure mode we're avoiding. |

One canonical marketing host: **Netlify (`ozdna-614`)**.

## Publish

1. Merge/push site changes to `main` — Netlify auto-publishes production from `main`.
2. That's it. No build command; the repo root is served as-is with `netlify.toml`
   redirects, security headers, and internal-path 404s applied at the edge.
3. DNS (Namecheap) is already correct — apex A → Netlify LB, `www` → Netlify alias
   CNAME. Do not add GitHub Pages A records (185.199.x.x).

## Contact CTAs

Landing mailto targets use `hello@ozdna.com`. Until that mailbox exists, replies may
bounce — swap the address in the landing pages / `llms.txt` when corporate mail is ready.

## Sitemap

Keep the **full** URL set while `products/`, `blog/`, `pillars/`, etc. remain published.
Bump `<lastmod>` on changed URLs when content updates. Do not collapse to a single
homepage URL unless those paths are removed from the deploy.
