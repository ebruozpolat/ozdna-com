# OzDNA / OriginDNA — Live Action Plan

*OriginDNA = content provenance product line under ozDNA (working name). Update statuses here as things happen. Statuses: `TODO` / `IN PROGRESS` / `WAITING` / `DONE` / `DROPPED`. Created July 6, 2026.*

## Phase 0 — Pre-build (July–September 2026, afternoons only)

| # | Action | Status | Cost | Notes |
|---|---|---|---|---|
| 0.1 | Email conformance@c2pa.org: ask (a) Level 1 conformance program cost + timeline for a small Generator product, and (b) whether a conformant service can obtain **per-tenant end-entity claim-signing certs**, and at what per-cert price (trust-list CAs issue end-entity certs only — see `plan/01-ARCHITECTURE.md` §9) | WAITING | $0 | **SENT Jul 8, 2026** (also asked about interim/provisional recognition paths post-trust-list-freeze). Awaiting reply — when the numbers land, record them here and update `plan/06-COST-MODEL.md`. |
| 0.2 | Join Content Authenticity Initiative (contentauthenticity.org/membership) | DONE | $0 | Application submitted Jul 8, 2026 (Find Below Ventures; industry: software, NOT blockchain — rule 4). "CAI member" line unlocked for whitepaper + grants once confirmation lands. |
| 0.3 | ozdna.com landing page + waitlist, two segments: (a) AI companies needing EU Art. 50 marking, (b) sellers/creators | IN PROGRESS | $0 | THE demand validation. LIVE on ozdna.com since Jul 8 (`/products/origin/` + segmented Netlify form; form detection enabled). Remaining: founder submits a test entry and confirms it lands in Netlify → Forms → then mark DONE. |
| 0.4 | Whitepaper v1 (EN): architecture, DNA-registry thesis, regulatory map, token-optional stance | TODO | $0 | Draft with Claude. Doubles as Filecoin grant application core. |
| 0.5 | Aug 2, 2026 PR push: EU AI Act Art. 50 + California SB 942 land same day; founder as commentary source with a solution | TODO | $0 | Prep pitch list in July. Crypto + tech media via existing network. |
| 0.6 | Watch the EU Code of Practice signatory list (closes Jul 22) — harvest small GenAI signatories as leads | TODO | $0 | |
| 0.7 | (Optional) ETHGlobal Lisbon, Jul 24–26 — AI×Crypto tracks | TODO | travel | Only if bandwidth allows; MetalTakip stays primary. |
| 0.8 | Re-underwrite DATA Foundation (ex-Story) grants post-rebrand | TODO | $0 | Their AI-training-data provenance mandate may fit; Academy status unconfirmed. |
| 0.9 | Partner conversation + domain: OriginDNA owns ozDNA brand long-term; platform site stays until OriginDNA landing ships; humanizer never under ozDNA | DONE | ~$10 domain | Domain released from alignxmedia + attached to ozdna-614 (Jul 7). PR #2 merged + Netlify repo-linked Jul 8: ozdna.com now serves the ozDNA umbrella + ComplyDNA + OriginDNA waitlist; duplicate Netlify project consolidated into `ozdna-614`; no humanizer content anywhere under the brand. |

## Phase 1 — MVP build (October 2026, 4 weeks)

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 1.1 | Browser C2PA signing (images, JPG/PNG) via @contentauth/c2pa-web WASM | TODO | Client-side = zero compute cost. Self-signed cert OK for v1; never claim "trusted". |
| 1.2 | Batched hash anchoring, chain-agnostic (Base first for retro grants) | TODO | Benchmark $0.0001/asset. Wallet = ours, tiny gas budget; never user funds. |
| 1.3 | DNA registry: perceptual hash + crypto hash stored at signing; match endpoint for stripped copies | TODO | Consider TrustMark watermark alongside (open-source, C2PA-approved). |
| 1.4 | Public verify page: drop a file → provenance record, anchor proof, match confidence | TODO | Our own verify UX — no dependence on C2PA trust list. |
| 1.5 | Compliance API v0 + docs + $49–199/mo self-serve pricing | TODO | Cloudflare-first hosting (Vercel Hobby bans commercial use). |
| 1.6 | Launch PR into Dec 2 marking-deadline wave; onboard waitlist + TR/MENA fact-checkers (free flagship) | TODO | |

## Phase 2 — Funding applications (with a shipped product)

| # | Target | Status | Amount | Notes |
|---|---|---|---|---|
| 2.1 | Filecoin Open Grants (GitHub devgrants) | TODO | ≤$50K | First application; whitepaper is the core. |
| 2.2 | Base retro Builder Grants + Base Batches | TODO | 1–5 ETH + $10K | Requires anchoring contract live on Base. |
| 2.3 | Solana Foundation / Colosseum hackathon | TODO | $5–30K | H2 2026 hackathon feeds $250K accelerator. |
| 2.4 | Alliance accelerator | TODO | $500K | Rolling; apply at first real usage. Token-optional friendly. |
| 2.5 | a16z crypto CSX fall 2026 | TODO | $500K/7% | Long shot; apply if traction. |

## Decisions log

- 2026-07-06 — BUILD verdict; ozdna.com repurposed from academic-AI idea to provenance product (DNA metaphor fits; academic AI stays with tezmakale.com).
- 2026-07-06 — Token: never in core story; whitepaper states token-optional. (NUM/Story/WordProof evidence, §5 of BLUEPRINT.md.)
- 2026-07-06 — Pitch language locked: "content provenance infrastructure with SaaS revenue," never "AI × Blockchain."
- 2026-07-06 — v1 = images only, no detection, no video, no mobile app, no custody of anything.
- 2026-07-06 — MetalTakip 90-day traffic plan remains the primary project until ~October; OzDNA gets afternoons.
- 2026-07-06 — Deferred (separate project): MetalTakip crypto section (altın-vs-bitcoin content + licensed-exchange referrals) parked for MetalTakip's next plan.
- 2026-07-06 — Discovered ozdna.com live with partner's LLM-cost-optimization site (Netlify, "GPU Bill Bodyguard", Detect/Humanize API docs). Decision: ozDNA name/domain stays with the provenance product; partner's product gets a new name/domain (talk pending). Option "merge both products on one site" explicitly rejected (humanizer is reputationally incompatible with a proof-of-origin brand).
- 2026-07-06 — Known name cost accepted: "ozdna" SERPs are currently dominated by oxDNA (Oxford DNA-simulation tool); brand SEO will be slower than usual.
- 2026-07-06 — Pre-implementation planning corpus authored in `plan/` (architecture, stack, algorithms, MVP spec, risks, costs, GTM, roadmap+gates) via multi-agent workflow with adversarial review, for execution by future Claude sessions (Sonnet 5 / Opus 4.8 era).
- 2026-07-06 — **Ratified (founder):** hard rule 6 amended — client pays compute on the FREE flow; paid API tenants use metered server-side Worker compute priced into tiers. Unblocks `POST /v1/marks` as designed.
- 2026-07-06 — **Ratified (founder):** anchoring = threshold cron per `plan/03-ALGORITHMS.md` §3.4 (15-min check; anchor at ≥100 pending / oldest ≥23h / paid item ≥40min); public SLA "within 24h free / within 1h paid"; ToS legal floor stays ≤7 days (05 T9).
- 2026-07-06 — **Ratified (founder):** Sept 30 build gate = `plan/07-GTM-SEO-PR.md` §2.3 verbatim (BUILD at ≥75 waitlist total / ≥25 AI-company segment / ≥5 discovery calls); 05 M1 and 08 G1 variants retired.
- 2026-07-06 — **Ratified (founder):** perceptual hash = own DCT pHash v1 (64-bit) + PDQ-256 stored from day one; blockhash-core withdrawn; both September spikes (pdq-wasm build, EXIF golden-image cross-runtime) approved.
- 2026-07-06 — Technical resolutions (Claude, per harmonization recommendations): 03's verdict enum + copy strings are the API surface in 04; proof JSON adopts 03's self-contained content set; 04 adds waitlist double-opt-in columns; 04 adds moderation status column (03 §6.2 semantics + tombstones); hosting = Workers static assets for the October product, Cloudflare Pages acceptable only for the throwaway July landing; badge SKU moved to post-MVP upside in 06's P&L (not launch-wave base case).
- 2026-07-06 — Ratifications propagated into `plan/01`–`08` (9-agent pass + corpus-wide consistency sweep; 4 trivial leftovers auto-fixed). Final reconciliation: `08` G1 gate table aligned verbatim to `07` §2.3 (EXTEND/BUILD/PIVOT/PARK + tiebreakers); PROCEED-LEAN downgraded from standalone verdict to a founder-override option. Corpus now internally consistent with all ratified decisions. (Propagation was interrupted once by the Fable 5 usage limit, then completed on Opus 4.8.)
- 2026-07-07 — Dev-team handoff prep: added `plan/09-DEV-SETUP.md` (engineer clone-and-run onboarding), `README.md` (repo orientation), `docs/BRAND-NOTES.md` (brand audit); wired all three into `plan/00-INDEX.md`. Corrected stale/overclaim items in `docs/BLUEPRINT.md` (one-liner now images-only, TrueScreen €99 not €60–99, fraud stats relabeled "directional", OpenAI+Google "announced" not "already run", softened the "every load-bearing claim verified" line) and `CLAUDE.md` (Story pivoted *within* provenance; €99 benchmark).
- 2026-07-07 — Dev-readiness verdict: corpus is ready to hand to a dev team; **zero Week-1 start-blockers**. Known resolve-later schema follow-ups (NOT blockers, flagged by the verify pass): `signing_keys` table added at W3 *if* per-tenant certs are chosen (tied to the open per-tenant-cert question — `plan/01` §9 / `plan/09` §5 reference it; `plan/04` §5 is the schema owner); `anchor_lock` table added in the W4 anchoring migration; `cert_serial`/`cert_status` intentionally absent in v1 (single-cert simplification, 04 wins). Also open: the c2pa-web digest-signer callback + C2PA cert EKU profile are de-risked by the scheduled September signing spike (04 §8), not missing work.
- 2026-07-07 — **Product naming:** partner provenance line registered as **OriginDNA** (working name) under ozDNA brand — parallel to ComplyDNA. Product card: `docs/products/ORIGINDNA.md`; wired into `README.md`, `ROADMAP.md`, `CLAUDE.md`.
- 2026-07-07 — Domain migration: `ozdna.com` released from alignxmedia site `d045201d…`, DNS zone deleted, attached to ozdna-614 on ebru0zpolat account. Live site still ozDNA Platform until OriginDNA landing (0.3).
- 2026-07-07 — NOT done (pending founder go-ahead): regenerating the shareable artifact + `docs/blueprint.html` from the corrected `BLUEPRINT.md`; they still reflect the pre-07-07 blueprint. The MD corpus is the dev-team deliverable and is current.
- 2026-07-08 — **Ratified (founder):** public positioning = ozDNA umbrella with two products, **ComplyDNA + OriginDNA**. Site restructured: `/` umbrella page, `/products/comply/` ComplyDNA landing (was root), `/products/origin/` OriginDNA landing + segmented waitlist (0.3). ozDNA Platform (LLM gateway) leaves public positioning; code stays in `platform/`.
- 2026-07-08 — **Ratified (founder):** canonical host = **Netlify** (`ozdna-614`), repo-connected to `ebruozpolat/ozdna-com` `main`. Decided over GitHub Pages because DNS was already on Netlify (verified: apex 75.2.60.5, www → netlify.app alias), Netlify Forms powers the waitlist, and `netlify.toml` redirects/headers/404-blocks apply. GitHub Pages demoted to staging; `CNAME` file removed. Note: `plan/02-TECH-STACK.md` "Cloudflare Pages for the July landing" is superseded for the landing only — the October revenue product still builds Cloudflare-first per hard rule 7.
- 2026-07-08 — **LIVE:** PR #2 merged; ozdna.com serves the new positioning (umbrella + `/products/comply/` + `/products/origin/` waitlist). Netlify consolidated to one repo-linked site (`ozdna-614`, owns the domain); duplicate `ozdna` project scheduled for deletion; form detection enabled. 0.9 → DONE. 0.3 → DONE pending a founder test submission visible in Netlify Forms.
- 2026-07-08 — Site error sweep (agent-audited): fixed 36 pages of dead `/#waitlist` CTAs (→ `/#products`), stale `/docs/` detection-API hub replaced (EN+TR), `llms.txt`/`llms-full.txt`/`knowledge/` rebuilt for two-product positioning (humanizer/"GPU Bill Bodyguard"/`/v1/detect` remnants purged — brand-rule risk), internal strategy paths (`/plan/`, `/seo/`, `/docs/*.md`, source trees) 404'd at the edge + robots-disallowed, custom `404.html` added, `/success` redirect fixed to the TR form that actually posts to it, analytics added to landing pages. Legacy platform-era pages (blog/pillars/compare/sdk/benchmarks/tr mirror) remain live but off-positioning — prune or redirect in a follow-up pass.
