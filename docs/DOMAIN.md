# Domain strategy — ozdna.com

**Status (Jul 2026):** **GitHub Pages** canonical host. Repo: `ebruozpolat/ozdna-com`, branch `main`, root deploy.

---

## Canonical setup

| Item | Value |
|------|--------|
| **Repo** | https://github.com/ebruozpolat/ozdna-com |
| **Pages URL** | https://ebruozpolat.github.io/ozdna-com/ (custom: https://ozdna.com) |
| **CNAME file** | `ozdna.com` (repo root) |
| **Content** | ComplyDNA v2 landing (`index.html`) |

## DNS (Namecheap)

Remove any Netlify A/CNAME records first, then:

```
A     @    185.199.108.153
A     @    185.199.109.153
A     @    185.199.110.153
A     @    185.199.111.153
CNAME www  ebruozpolat.github.io
```

GitHub → repo **Settings → Pages → Enforce HTTPS**.

## Publishing (GitHub Pages)

1. Push to `main`.
2. GitHub → **Settings → Pages** → Deploy from branch → `main` / **`/ (root)`**.
3. Update DNS at Namecheap per the records above (remove Netlify records first).
4. Pages → **Enforce HTTPS** (after DNS propagates, ~24h).

## Static site files (repo root)

| File | What |
|------|------|
| `index.html` | ComplyDNA v2 landing (single page, embedded CSS) |
| `og.png` | Social share image (1200×630) |
| `robots.txt` | Search + AI crawler permissions |
| `sitemap.xml` | Canonical URLs |
| `llms.txt` | LLM product summary (TR/EN) |
| `CNAME` | Custom domain: `ozdna.com` |

## Netlify (deprecated for this domain)

Previously: `ozdna-614` on Netlify served the multi-page ozDNA marketing site.

**Do not** point `ozdna.com` at both Netlify and GitHub Pages. After DNS cutover:

1. Netlify → `ozdna-614` → Domain management → remove `ozdna.com` / `www.ozdna.com`
2. Keep Netlify only if you need preview deploys on `*.netlify.app` (without custom domain)

## ComplyDNA API

Not hosted on GitHub Pages. Run on-prem or separate infra (`complydna/`, port 8000).
