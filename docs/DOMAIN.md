# Domain strategy — ozdna.com

**Status (2026-07-08): Netlify is the canonical host.** Site: `ozdna-614` (ebru0zpolat
account). DNS-verified Jul 8: apex `ozdna.com` → `75.2.60.5` (Netlify LB), `www` →
CNAME to the `ozdna-614.netlify.app` alias. GitHub Pages was never cut over (its DNS
records were never installed) and is now demoted to staging.

Decision rationale: the domain was already attached to ozdna-614 on Jul 7 (zero DNS
churn, no downtime risk before the Aug 2 PR moment); Netlify Forms powers the OriginDNA
segmented waitlist with no backend; `netlify.toml` redirects + security headers +
internal-path 404s actually apply (GitHub Pages supports none of them).

---

## Canonical setup

| Item | Value |
|------|--------|
| **Host** | Netlify, site `ozdna-614` |
| **Source** | Connect to GitHub repo `ebruozpolat/ozdna-com`, branch `main`, publish dir `.` (no build command) |
| **Domains** | `ozdna.com` (primary) + `www.ozdna.com` (redirects to apex via `netlify.toml`) |
| **Forms** | `origindna-waitlist` (on `/products/origin/`) — enable form detection in Site settings → Forms |
| **Content** | `/` ozDNA umbrella · `/products/comply/` ComplyDNA · `/products/origin/` OriginDNA waitlist |

### One-time console steps (founder)

1. Netlify → `ozdna-614` → **Site configuration → Build & deploy → Link repository** → `ebruozpolat/ozdna-com`, branch `main`, no build command, publish directory `.`
2. Netlify → **Forms** → enable detection (so `origindna-waitlist` submissions are captured; free tier = 100 submissions/mo)
3. GitHub → repo **Settings → Pages** → set to **Disabled** (or leave serving `ebruozpolat.github.io/ozdna-com` as staging — the `CNAME` file was removed so it can't claim the domain)
4. After the first repo-linked deploy, submit a test entry to the waitlist form and check Netlify → Forms

## DNS (Namecheap) — current, verified working

Apex A → Netlify (`75.2.60.5` via Netlify's domain management), `www` → Netlify alias
CNAME. **No changes needed.** Do not add GitHub Pages A records (185.199.x.x) — dual
DNS was the failure mode we're avoiding.

## GitHub Pages (staging only)

Previously drafted as canonical but never cut over. Now: optional staging at
`https://ebruozpolat.github.io/ozdna-com/`. Caveats on Pages: no redirects
(`netlify.toml` ignored), no forms, no custom headers, internal `/plan/`+`/seo/`+docs
paths are served openly. Don't point the domain here.

## ComplyDNA API

Not hosted on Netlify. Run on-prem or separate infra (`complydna/`, port 8000).
The `/complydna/*` source tree is 404'd at the edge by `netlify.toml`.

## Static site files (repo root)

| File | What |
|------|------|
| `index.html` | ozDNA umbrella landing (two products) |
| `products/comply/index.html` | ComplyDNA landing (TR) |
| `products/origin/index.html` | OriginDNA landing + segmented waitlist |
| `404.html` | Custom 404 (also the target of internal-path blocks) |
| `og.png` | Social share image (1200×630) |
| `robots.txt` / `sitemap.xml` / `llms.txt` / `llms-full.txt` | Crawler + AI-agent surface |
