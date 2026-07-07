# ozDNA — agent context

**ozDNA** is the company brand ([Find Below Ventures](https://findbelow.com)). Multiple product lines live under it:

| Product | Status | Docs |
|---------|--------|------|
| **ozDNA Platform** | Live v0.1 — LLM gateway, routing, RAG, cost | `README.md`, `platform/` |
| **ComplyDNA** | Q3 2026 — RegTech compliance monitoring | `products/comply/`, `ROADMAP.md` |
| **OriginDNA** *(working name)* | Pre-build — content provenance / Proof of Origin | `docs/products/ORIGINDNA.md`, `plan/`, `docs/BLUEPRINT.md` |

This file is the ground-truth brief for **OriginDNA** (partner-authored planning corpus, July 2026). For platform engineering, start with `README.md`.

---

## OriginDNA — Proof of Origin

Content provenance service: every image gets a "DNA" — a C2PA cryptographic signature at creation, a blockchain-anchored timestamp no one can backdate, and a perceptual-hash fingerprint that survives even when social platforms strip the metadata.

**Status (July 7, 2026):** blueprint stage. Nothing is built yet. All strategy decisions below are locked and research-verified — read `docs/BLUEPRINT.md` before proposing changes to any of them.

**Domain note:** ozdna.com is on Netlify (`ozdna-614`, ebru0zpolat account) and currently serves the **ozDNA Platform** marketing site. OriginDNA will eventually own the public brand on that domain; the partner's humanizer must never appear under ozDNA. See `docs/ACTION_PLAN.md` 0.9. Detailed build plan: `plan/` — start at `plan/00-INDEX.md`.

## Who is building this

- Founder + one partner, based in Turkey (partner independently built the current ozdna.com site — see Domain note above). Company: **Find Below Ventures**, Sharjah Publishing City Free Zone, UAE (findbelow.com). Sister properties: metaltakip.com (Turkish precious-metals SEO site, currently mid-90-day traffic plan — **that project stays primary until ~October 2026; OzDNA gets afternoons only until then**), tezmakale.com (AI text detector).
- Founder background: 5+ years at crypto CEXs and crypto PR agencies. Superpowers are PR, distribution, SEO, and industry network — **not** deep engineering. Claude does the heavy technical lifting; explain architecture decisions plainly.
- Budget: essentially zero. Claude subscription + Vercel account exist; Cloudflare free tier acceptable. The only pre-approved fixed cost is ~$20/mo (Vercel Pro) if unavoidable.

## Hard rules — do not violate, do not relitigate

1. **No token. Ever, in the core story.** The whitepaper says "token-optional architecture, no token planned." Evidence: NUM −99.9% (ATL June 27, 2026), Story Protocol −98% + rebranded to DATA Foundation June 25, 2026 (pivoted *within* provenance, toward AI-training-data provenance — not away from it), WordProof zombie. Full reasoning in BLUEPRINT.md §5.
2. **Never touch user funds. No custody, no trade execution, no wallets holding value.** Turkey's CASP regime (Law 7518) makes unlicensed custody/brokerage a criminal offense. Batched hash anchoring paid by us is fine; anything moving user money is not.
3. **No AI detection classifiers in v1.** TrueMedia died of detection compute costs. Provenance, not detection.
4. **Pitch language:** "content provenance infrastructure with SaaS revenue." Never lead with "AI × Blockchain" — 2026 crypto VCs flag that framing as hype-over-execution. Blockchain is invisible plumbing in all copy.
5. **Never overclaim C2PA status:** C2PA is NOT mandated by name in the EU Code of Practice, and our signatures show "unknown source" in the official Verify tool until we pass the C2PA Conformance Program (fees unpublished; interim trust list frozen Jan 1, 2026). v1 ships its own verify page + chain anchor and never promises "trusted Content Credentials."
6. **v1 scope: images only** (JPG/PNG). The FREE flow signs in-browser via WASM (`@contentauth/c2pa-web`) so the client pays compute; paid API tenants may use our metered server-side Worker compute, priced into their tier (founder-ratified amendment, July 6, 2026 — unit cost ≤$0.000004/image, ~93% gross margin). Video/audio/mobile apps are explicitly later.
7. **Cloudflare-first hosting.** Vercel Hobby prohibits commercial use; a revenue MVP on it violates ToS.
8. **Batch work locally, review, deploy once per work batch** — builds/deploys cost money or quota.

## The clock (verified dates — the entire strategy hangs on these)

| Date | Event |
|---|---|
| Jul 22, 2026 | EU Code of Practice signatory list closes (watch who signs — leads) |
| **Aug 2, 2026** | EU AI Act Art. 50 + California SB 942 apply, same day. **The PR moment.** |
| **Dec 2, 2026** | Marking grace expires for existing GenAI systems. **The launch/sales wave.** |
| Feb 2, 2027 | Interoperable detection required (consortium route open to SMEs) |

## Customers, ranked (BLUEPRINT.md §4)

1. **AI Act compliance API** for small GenAI apps — $49–199/mo, self-serve, SEO on "EU AI Act content marking" queries. PRIMARY.
2. **Seller authenticity badge** (Etsy AI-disclosure mandatory since Jan 14, 2026) — $5–15/mo. SECONDARY.
3. **TR/MENA legal evidence capture** — €99/mo (TrueScreen benchmark; the older €60 figure is stale). LATER.
- Fact-checkers (Teyit etc.) and individual creators: **free**, forever — flagship users and PR channel, not revenue.

## Current phase: pre-build (July–September 2026)

Afternoons only, in this order: ① email conformance@c2pa.org for Level 1 cost/timeline (the one unknown number), ② join CAI (free), ③ landing page + segmented waitlist on ozdna.com (this is the demand validation), ④ whitepaper v1, ⑤ Aug 2 PR push. Full checklist with October MVP scope: `docs/ACTION_PLAN.md`.

## Files

- `docs/products/ORIGINDNA.md` — product card under ozDNA (name, scope, links into plan corpus)
- `docs/BLUEPRINT.md` — the canonical strategy document (verdict, market map, architecture, wedges, token stance, funding stack, risks, plan)
- `docs/ACTION_PLAN.md` — live checklist; update statuses as items complete
- `docs/research-2026-07-06.json` — raw output of the 10-agent research sweep with per-claim adversarial verification and sources; consult it before re-researching anything
- `plan/` — pre-implementation planning corpus (architecture, tech stack, algorithms, MVP spec, risk register, cost model, GTM/SEO/PR, roadmap with gates); written July 6, 2026 for execution by future Claude sessions and the dev team — start at `plan/00-INDEX.md`
- `plan/09-DEV-SETUP.md` — developer onboarding: repo layout, local env, secrets catalog, commands, PR/DoD conventions (the doc to hand a new engineer)
- `README.md` — top-level orientation for the dev team (what this is, where to start, the constraints)
- `docs/BRAND-NOTES.md` — brand-asset audit + what must be fixed before public launch (logo re-export, SVG, metadata strip, ownership)
- Shareable blueprint page: https://claude.ai/code/artifact/2eb89d21-b835-4887-8e61-46d4dd56af53 — NOTE: still reflects the pre-July-7 blueprint; regenerate from `docs/BLUEPRINT.md` before sharing externally
