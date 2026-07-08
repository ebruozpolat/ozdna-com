# ozDNA — Proof of Origin

> **Changelog — 2026-07-08:** adapted into the `ozdna-com` monorepo (repo also hosts the ozdna.com site, ComplyDNA, and the platform code — see "What else lives in this repo"); domain-blocker section updated per `docs/ACTION_PLAN.md` 0.9 (domain reclaimed Jul 7).
> **Changelog — 2026-07-07:** README created. Orientation page for the incoming dev team. Points to the plan; does not restate it. OriginDNA is pre-build (nothing shipped for it).

## What this is

**OriginDNA** (working product name, under the ozDNA brand) gives every image a verifiable "DNA": a C2PA cryptographic signature at creation, a blockchain-anchored timestamp no one can backdate, and a perceptual-hash fingerprint that survives even when platforms strip the metadata. The wedge is **EU AI Act Article 50 compliance** for small generative-AI apps that must mark AI-generated content by law — sold as a self-serve SaaS API ($49–199/mo), with e-commerce seller badges and TR/MENA legal-evidence capture as later segments. Positioning is deliberate and load-bearing: **"content provenance infrastructure with SaaS revenue."** Blockchain is invisible plumbing — never the headline, never in customer-facing copy.

## Status

**Pre-build blueprint stage, as of July 2026. Nothing is built yet** for OriginDNA. The `plan/` corpus is a ratified, adversarially-reviewed build plan authored July 6, 2026 for a dev team to execute — not shipped code. Timeline:

- **Jul–Sep 2026 — pre-build:** demand validation (landing + segmented waitlist), whitepaper, Aug 2 PR push, September de-risking spikes. Gate at Sept 30 decides build/no-build (`plan/07-GTM-SEO-PR.md` §2.3: BUILD at ≥75 waitlist / ≥25 AI-company segment / ≥5 discovery calls).
- **October 2026 — the MVP:** a 4-week build (`plan/04-MVP-SPEC.md`).
- **Dec 2, 2026 — launch** into the EU marking-deadline wave (grace expires for existing GenAI systems; the sales moment).

## Start here (read in this order)

| File | What it is |
|------|------------|
| [CLAUDE.md](CLAUDE.md) | **Read first.** The 8 hard rules and ground truth. Wins over everything else in the repo. |
| [docs/BLUEPRINT.md](docs/BLUEPRINT.md) | The strategy and the why — market, verdict, regulatory clock, token stance, risks. |
| [plan/00-INDEX.md](plan/00-INDEX.md) | Map of the build plan: the numbered docs and which one owns what (when docs disagree, the owner wins). |
| [plan/09-DEV-SETUP.md](plan/09-DEV-SETUP.md) | Clone-and-run for engineers (env vars, wrangler bootstrap, local DB, deploy targets, first-run walkthrough). Start here to get the repo running. |
| [docs/ACTION_PLAN.md](docs/ACTION_PLAN.md) | Live checklist + dated decisions log. Anything decided after July 6, 2026 lands here and supersedes the plan docs. **Check it before trusting any date.** |

The eight plan documents (`plan/01`–`08`) are the detailed spec. Don't read them all up front — `plan/00-INDEX.md` tells you which one to open for the task in front of you (01 architecture, 02 stack/versions, 03 algorithms, 04 API/SQL/scope, 05 risks, 06 costs, 07 GTM/SEO, 08 roadmap/gates).

`plan/09-DEV-SETUP.md` (written 2026-07-07) is the engineer clone-and-run guide: toolchain pins, wrangler bootstrap, local D1, secrets catalog, and a git-clone → signed-test-image → DNA-record walkthrough. It derives from `plan/02-TECH-STACK.md` (versions, secrets) and `plan/04-MVP-SPEC.md` (D1 schema, routes); those owning docs win wherever they disagree with it.

## Non-negotiable constraints (know these before you touch anything)

These are the hard rules from `CLAUDE.md` in plain terms. They are not up for debate; if a task seems to require breaking one, stop and ask.

1. **Images only in v1** — JPG/PNG. No video, no audio, no mobile app. Those are explicitly later.
2. **No token. Ever, in the core story.** The whitepaper says "token-optional, no token planned." Don't add one, don't hint at one.
3. **Never touch user funds.** No custody, no trade execution, no wallet holding user value. The anchor gas wallet is ours — testnet (Base Sepolia) in dev, a tiny mainnet balance in prod — never user money.
4. **No AI-detection classifiers in v1.** This is provenance, not detection. Don't build or ship a "is this AI?" model.
5. **Never overclaim C2PA "trusted" status.** Self-signed manifests show as "unknown source" in the official Verify tool until we pass the C2PA Conformance Program. User-facing copy must never say "authentic / trusted / Content Credentials verified." Use only the rule-5-safe verdict strings in `plan/03-ALGORITHMS.md` §6.3.
6. **Cloudflare-first, ~$0–20/mo budget.** Vercel Hobby bans commercial use (hard rule 7). Deploy rarely — builds and deploys cost money or quota; batch work locally, review, deploy once per batch.
7. **Never deploy, spend, or post publicly without founder sign-off.** No exceptions.

## Deploy state — ozdna.com

Canonical host is **Netlify** (`ozdna-614`), repo-connected to `main` — decided Jul 8, 2026; see `docs/DOMAIN.md` for the one-time console steps and DNS facts. Public positioning (Jul 8): ozDNA umbrella at `/`, ComplyDNA at `/products/comply/`, OriginDNA landing + segmented waitlist at `/products/origin/` (that waitlist is ACTION_PLAN 0.3 — the demand validation). `docs/ACTION_PLAN.md` item **0.9** gets logged DONE once this is live on `main`. The partner's AI-text humanizer must never appear under the ozDNA brand. Merging to `main` deploys the public site — founder sign-off required, no exceptions.

## What else lives in this repo

`ozdna-com` is a monorepo for the whole ozDNA brand; OriginDNA is one product line inside it.

| Area | What it is |
|------|------------|
| `index.html` + site dirs (`products/`, `blog/`, `tr/`, …) | The live ozdna.com site: ozDNA umbrella + ComplyDNA + OriginDNA pages (legacy platform-era pages pending pruning). Hosting/DNS: `docs/DOMAIN.md`. |
| `complydna/` | ComplyDNA — Turkish RegTech compliance LLM (FastAPI + Qdrant). See `complydna/README.md` and `docs/products/COMPLYDNA.md`. |
| `platform/` | ozDNA Platform v0.1 — LLM gateway, routing, RAG, cost. Start at `platform/README.md`. |
| `docs/products/ORIGINDNA.md` | The OriginDNA product card (name, scope, links into the plan corpus). |

## Tech stack (one-liner)

Cloudflare Workers (static assets serve an Astro frontend + front the API) + D1 (SQLite, source of truth) + R2 (blobs) + KV (read cache), all TypeScript; C2PA via `@contentauth/c2pa-web` 0.12.0 (browser signing, free flow) and `@trustnxt/c2pa-ts` 0.14.0 (server verify + paid-tier signing); perceptual match = OzDNA pHash v1 (own 64-bit DCT) + PDQ-256 (`pdq-wasm` 0.3.9); anchoring on Base L2 (mainnet 8453 / Sepolia 84532 for tests) via viem; migrations via Drizzle; billing via Paddle (Polar backup). Workers Paid ($5/mo) switches on at the start of the October build. The locked, versioned list with rationale and rejected alternatives lives in `plan/02-TECH-STACK.md` (the owner) — treat that doc as canonical, and re-verify volatile versions per `plan/08-ROADMAP-GATES.md` before pinning.
