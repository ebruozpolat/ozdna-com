# OzDNA Planning Corpus — Master Index & Session Handoff

*Product: **OriginDNA** (working name) — content provenance / Proof of Origin under the ozDNA brand. Product card: [`../docs/products/ORIGINDNA.md`](../docs/products/ORIGINDNA.md).*

*Authored July 6, 2026, in the final hours of a Claude Fable 5 session, explicitly as a handoff to the future Claude sessions (Sonnet 5 / Opus 4.8 era) that will execute this plan with no memory of the conversation that produced it.*

**How this corpus was produced:** 8 specialist agents each authored one document with live web-verification of every volatile fact; 8 adversarial reviewers then spot-checked load-bearing claims against primary sources, hunted hard-rule violations, and redid the arithmetic (64 findings, 1 critical — all fixed); a final cross-document pass harmonized versions, endpoints, schemas, and terminology. Every remaining `UNVERIFIED:` prefix in these documents is honest — treat it as a to-do, not decoration.

**Fresh engineer (human dev) about to build?** Start with `09-DEV-SETUP.md` — the clone-and-run guide (toolchain pins, repo layout, `wrangler` bootstrap, local D1, and a git-clone → signed-test-image → DNA-record walkthrough). The repo-root `README.md` orients you to the whole repo, and `docs/BRAND-NOTES.md` carries the brand palette (`#EA8B36`) and the known logo/asset defects for anyone building the landing or verify pages.

**Founder + dev lead, at kickoff:** read `10-OPEN-DECISIONS.md` together — it is the de-duplicated handoff list of every open professional decision and check (which the dev lead owns, which need a lawyer, and the few the founder must not delegate), with a copy-paste question list for that first conversation.

---

## If you are a fresh Claude session, do this first

1. Read `../CLAUDE.md` — ground truth and the 8 hard rules. They win over everything in this folder.
2. Read this file completely.
3. Read `08-ROADMAP-GATES.md` §"session bootstrap" for the current phase, and only then the phase-relevant documents below.
4. Check `../docs/ACTION_PLAN.md` decisions log for anything decided after July 6, 2026 — later decisions supersede this corpus.
5. Re-verify the volatile facts listed in 08's phase checklist (package versions, Cloudflare limits, gas prices, provider terms, regulatory changes). This corpus was accurate on July 6, 2026; the world moves.

**Never without founder sign-off:** any deploy, any spend, any public post/email/PR, anything touching ozdna.com public positioning for **OriginDNA** while ACTION_PLAN 0.9 is not DONE (platform site may remain live; OriginDNA waitlist must not conflict with humanizer branding).

---

## The documents and who owns what

Ownership means: when two documents disagree, the owner wins, and fixes converge on the owner's version.

| Doc | Contents | Owns (canonical for) |
|---|---|---|
| `01-ARCHITECTURE.md` | Component map on Cloudflare primitives, 4 core flows (mermaid), trust boundaries, data-minimization stance, key-management design, DR/alerting, v2 extension points | System shape, trust boundaries, thumbnail/consent policy |
| `02-TECH-STACK.md` | Every layer: locked choice + version + rationale + rejected alternatives; signing-credential (X.509/COSE/TSA) design; payments (Paddle locked, Polar backup); $0–20/mo proof | Package choices & versions, hosting, payments, tooling |
| `03-ALGORITHMS.md` | pHash + PDQ design with false-positive math, multi-index matching scheme, Merkle-batched anchoring + independent-verification walkthrough, C2PA manifest/signing identity, verify-page decision tree with exact rule-5-safe copy strings | Algorithms, thresholds, band scheme, verdict enum & copy, anchor mechanism |
| `04-MVP-SPEC.md` | October 4-week build: user stories, page specs, full REST API, D1 SQL schema, metering, week-by-week plan with cut-lines, launch DoD | API endpoints/routes, SQL DDL, product scope & pricing page |
| `05-RISK-REGISTER.md` | ~40 risks with likelihood/impact/tripwire/mitigation; KVKK/GDPR analysis; Law 7518 verification status; top-10 ranking; 3 kill-assumptions; pre-mortem | Risk framing, legal posture, ToS floors |
| `06-COST-MODEL.md` | Free-tier break points, anchoring gas math, per-tier margins, break-even, grant scenarios, 18-month 3-scenario P&L | All cost arithmetic and pricing-margin math |
| `07-GTM-SEO-PR.md` | Keyword clusters → ~20 content pieces, programmatic-SEO ideas, waitlist spec + validation gates, Aug 2 PR plan (3 angles), Dec 2 wave, coalition plan, Jul–Dec calendar | GTM execution, SEO plan, **Sept 30 gate thresholds** |
| `08-ROADMAP-GATES.md` | Phases P0–P3 with gates G1–G3, session-bootstrap blocks per phase, re-verification checklists, corpus-maintenance rules | Process, precedence map, gate structure |
| `09-DEV-SETUP.md` | Day-one engineer onboarding: exact toolchain pins, repo/workspace layout, `wrangler` bootstrap, local-D1 first-run walkthrough, env & secrets catalog, commands, git/PR/CI workflow, dev guardrails | Developer onboarding, local dev environment, repo layout — **onboarding only** (derives from 01–04 & 08; owns none of the canonical specs those docs own, and defers to the owner on every disagreement) |
| `10-OPEN-DECISIONS.md` | Founder→dev-lead handoff sheet: every open professional decision/check de-duplicated from 01–09, grouped into verify-early / design / security / legal / scale-later, plus a "stays the founder's call" list and a read-aloud question checklist | The running list of open professional decisions/checks — the dev-lead handoff (a derived view; each item defers to its owning doc, cited inline) |

Strategy documents live in `../docs/` (BLUEPRINT.md = why; research JSON = evidence). This folder is the *how*.

---

## Status: ratified (as of July 6, 2026, end of day)

**Converged and mechanical (safe to rely on):** file/endpoint/key-format/quota naming, package versions (c2pa-web 0.12.0, c2pa-ts 0.14.0, pdq-wasm 0.3.9, etc.), 4×16-bit band scheme, D1 write arithmetic (index writes bill as rows), Paddle/Polar payment stack, Workers Paid $5/mo from October.

**Founder-ratified July 6, 2026** (recorded in `../docs/ACTION_PLAN.md` decisions log; propagated into all plan docs the same day):

1. **Hard rule 6 amended** — free flow signs client-side; paid API tenants use our metered Worker compute priced into tiers. `POST /v1/marks` is the sanctioned primary revenue mode. CLAUDE.md carries the amended rule.
2. **Anchoring** — 03 §3.4 threshold cron (15-min check; anchor at ≥100 pending / oldest ≥23h / paid ≥40min); public SLA "within 24h free / within 1h paid"; ToS legal floor ≤7 days.
3. **Sept 30 gate** — 07 §2.3 verbatim is THE build/no-build criterion (BUILD at ≥75 waitlist / ≥25 AI-segment / ≥5 discovery calls); 05 M1 and 08 G1 threshold variants retired.
4. **Perceptual hash** — own DCT pHash v1 (64-bit) + PDQ-256 stored day one; blockhash-core withdrawn; September spikes (pdq-wasm build, EXIF golden-image) approved.

**Technical resolutions** (adopted same day per harmonization recommendations): 03 §6.3's verdict enum + copy strings are the API surface in 04; proof JSON uses 03 §3.7's self-contained content set; 04 gains waitlist double-opt-in and a moderation-status column; hosting = Workers static assets for the October product (Pages only for the throwaway July landing); badge SKU is post-MVP upside, not launch-wave base case in 06's P&L.

**The one external blocker:** ACTION_PLAN 0.9 — the partner conversation about ozdna.com (deadline ~Jul 12–15). Nothing deploys to the domain before it's DONE. The open UNVERIFIED items inside individual docs (conformance fees, per-tenant cert availability, D1 Time Travel retention, TSA attachability, Paddle onboarding lead time) remain genuinely open — resolve per 08's phase checklists.

---

## Maintenance rules

- Decisions land in `../docs/ACTION_PLAN.md` → Decisions log (dated). Plan docs are then updated in place with a one-line changelog entry at the top of the affected doc.
- Never delete an UNVERIFIED marker without recording the verifying source inline.
- If you find this corpus contradicting observed reality (a package renamed, a price changed, a law amended), fix the owning document, note it in the changelog line, and propagate via the ownership map — do not fork competing versions.
