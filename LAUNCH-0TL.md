# ozDNA — 0 TL Launch Runbook

Execute in order. Total time ~2 hours.

## 1. Prod deploy (~5 min)

```bash
cd /Users/macbookpro/Projects/ozdna
npx netlify login
chmod +x scripts/deploy-prod.sh
./scripts/deploy-prod.sh
```

Verify: https://ozdna-614.netlify.app/ · `/sitemap.xml` · `/robots.txt`

> **Domain:** `ozdna.com` cutover is **deferred**. Use the Netlify URL above for launch QA. See [docs/DOMAIN.md](./docs/DOMAIN.md).

## 2. Plausible (~10 min)

1. https://plausible.io/register → Add website **ozdna.com**
2. No code change needed — `analytics.js` already loads `plausible.io/js/script.js`
3. Redeploy only if you changed domain

Goals: Pageviews, `/compare/litellm-alternative/`, `Waitlist Signup` custom event

## 3. GA4 (~10 min)

1. https://analytics.google.com → Admin → Create property **ozdna.com**
2. Copy Measurement ID (`G-XXXXXXXXXX`)
3. Edit `analytics.js` line 9: `const GA4_MEASUREMENT_ID = "G-XXXXXXXXXX";`
4. `./scripts/deploy-prod.sh`

## 4. Google Search Console (~15 min)

1. https://search.google.com/search-console → Add property **Domain: ozdna.com** (DNS) or **URL prefix: https://ozdna.com/**
2. **HTML tag** method: copy verification code into `index.html` (uncomment meta line ~30)
3. `./scripts/deploy-prod.sh`
4. Click **Verify**
5. Sitemaps → Submit `https://ozdna.com/sitemap.xml`
6. URL Inspection → Request indexing for:
   - `/`
   - `/compare/litellm-alternative/`
   - `/products/comply/`
   - `/blog/when-every-active-user-destroys-your-margin/`

## 5. TezMakale cross-link (~20 min)

TezMakale repo/footer → paste snippet from `integrations/tezmakale-crosslink.html`

Target: dofollow link `https://ozdna.com/?utm_source=tezmakale&utm_medium=footer&utm_campaign=launch`

TezMakale already shows "OZDNA Platform" in UI — add visible footer CTA to ozdna.com.

## 6. LinkedIn — Post A (margin / GPU Bill)

**When:** Today, 09:00–11:00 TR time (B2B scroll peak)

**Link:** https://ozdna.com/blog/when-every-active-user-destroys-your-margin/?utm_source=linkedin&utm_campaign=launch-margin

---

Every active user used to feel like growth.

Then the OpenAI invoice arrived.

We learned this building TezMakale — live academic AI in Turkey, real token burn, real peak-season spikes.

The fix isn't "use a cheaper model."
It's making inference cost measurable per workflow, per user, per product surface — before scale makes it structural.

We open ozDNA (Phase 2) for vertical AI teams who need:
→ LLM cost routing
→ Production RAG governance  
→ Token economics that protect margin

Phase 1 proof is live: tezmakale.com runs on the same stack.

Blog (2 min read): [paste link]
Early access: ozdna.com

#VerticalAI #LLM #Startup #AIInfrastructure

---

## 7. LinkedIn — Post B (Comply Phase 2 + proof)

**When:** Today, 17:00–19:00 TR time

**Link:** https://ozdna.com/products/comply/?utm_source=linkedin&utm_campaign=launch-comply

---

Phase 1: ship vertical AI in production.
Phase 2: sell the infrastructure.

Today we're opening ozDNA publicly:

• Phase 1 — TezMakale (live): academic AI, detection + analysis reports, token economics at tezmakale.com  
• Phase 2 — ComplyDNA (building): RegTech for 5549, BDDK, MASAK, KVKK  
• Same gateway, router, RAG layer, cost engine

Generic LLM gateways route requests.
Vertical products teach you what should flow — and what you can afford.

If you're building fintech, EMI/PSP, or RegTech in TR/EU → Comply early access.
If you're a founder burning margin on inference → waitlist.

ozdna.com/comply

Built by Findbelow Ventures. Production first, infra second.

#RegTech #Fintech #KVKK #VerticalAI #ozDNA

---

## KPI — Week 1 (0 TL)

| Metric | Target |
|--------|--------|
| Unique visitors | 500+ |
| TezMakale → ozdna clicks | 50+ |
| Waitlist signups | 20+ |
| GSC indexed pages | 10+ |

Track in Plausible + Netlify Forms dashboard.
