# Linear sync — 2026-07-27 (manual, copy-paste ready)

Prepared for manual entry into Linear (writes are approval-gated in the session, so the
founder applies these by hand). **No detail omitted.**

- **Workspace / org:** `georiskengine` · **Team:** `ozDNA`
- **Project:** `OriginDNA — Provenance`
- **Source:** session PR **#36** on branch `claude/organize-file-structure-p5nlh9`
  (repo `ebruozpolat/ozdna-com`) · date **2026-07-27**
- Reference issues on the board: epic **OZD-50** (`[Epic] OriginDNA pre-build (Jul–Sep 2026)`),
  build gate **OZD-54** (`OriginDNA — Sep 30 build gate (G1)`), plus OZD-51/52/53.

---

## 1. NEW ISSUE to create

**Field values**

| Field | Value |
|---|---|
| Title | `OriginDNA MVP — build foundation (dna-core + D1 schema)` |
| Team | `ozDNA` |
| Project | `OriginDNA — Provenance` |
| Parent | `OZD-50` |
| Status | `In Progress` |
| Priority | `High` |
| Labels | (none) |
| Assignee | (founder's choice) |

**Description (paste verbatim):**

```markdown
MVP build foundation started (early OZD-54 build-gate work). Cloudflare Workers monorepo
per `plan/09-DEV-SETUP.md` §3, following `plan/03-ALGORITHMS.md` + `plan/04-MVP-SPEC.md`
verbatim.

**Location:** started under `app/` in the `ozdna-com` repo (the in-session GitHub App
can't create repos; extract to a dedicated `ozdna` repo later). Not wired into the
Netlify site — the marketing site is untouched.

Shipped in **PR #36** (branch `claude/organize-file-structure-p5nlh9`):

- [x] `packages/dna-core` — the shared provenance math (one impl for browser + Workers)
  - [x] OzDNA pHash v1 (plan/03 §1.3): luma (Rec.601, alpha-over-white) → 32×32
        area-average box downscale (own resampler) → orthonormal 2-D DCT-II → top-left
        8×8 → strict median threshold → MSB-first 64-bit → 16 lowercase hex
  - [x] Merkle tree (plan/03 §3.2/§3.3): leaf = SHA-256(0x00 ‖ preimage),
        node = SHA-256(0x01 ‖ left ‖ right), odd trailing node promoted unchanged
        (no duplication — CVE-2012-2459), inclusion proofs + verify + fold
  - [x] canonical leaf preimage (plan/03 §3.2) — fixed newline-delimited "ozdna.v1" template
  - [x] 4×16-bit band slicing (band0..3) + Hamming distance + signed/unsigned i64 helpers
  - [x] SHA-256 via Web Crypto + hex/bytes/utf8 helpers
- [x] `migrations/0001_init.sql` — D1 schema verbatim from plan/04 §5 (users, api_keys,
      records + band indexes, anchor_batches, usage_events, waitlist)
- [x] Tooling: npm workspaces, tsconfig (strict + noUncheckedIndexedAccess), vitest config
- [x] Verified locally: 19/19 vitest tests green (property/round-trip, no magic goldens —
      odd-promotion, domain separation, proof round-trips across sizes, pHash determinism +
      brightness-scale invariance + downscale survival d≤6, band slicing, i64 round-trip,
      leaf-preimage exact bytes) + `tsc --noEmit` clean

Next slices (not started):
- [ ] `contracts/OzDnaAnchor.sol` (Foundry) — plan/03 §3.5 (Base mainnet, holds no funds)
- [ ] `packages/anchor-backends` — AnchorBackend interface + NullAdapter (dev) + BaseAdapter (viem)
- [ ] `apps/api` (Hono Worker): `POST /v1/sign-digest`, `POST /v1/marks`, `POST /v1/registrations`,
      `GET/POST /v1/verify`, records/proof/badge, usage, waitlist, webhooks
- [ ] `apps/anchor` (cron Worker): 15-min threshold batch → Merkle root → Base tx → write proofs
- [ ] `apps/web` (Astro): sign SPA (`@contentauth/c2pa-web` WASM) + verify page + docs
- [ ] PDQ-256 wrapper (`pdq-wasm`) + zod schemas + verdict enum (plan/03 §1.4 / §6.3)
- [ ] Cloudflare bindings (D1/R2/KV), signing cert chain, Base gas wallet — founder-provisioned

**Honest caveats:** nothing is deployed; public launch is still gated on the Hafta 2–3
TezMakale-cleanup confirmation (roadmap-90d). The signing-credential contract
(`/v1/sign-digest` raw-sig vs. server-assembled COSE) is the September spike, still open.

Related: epic OZD-50, build gate OZD-54. Ref: `app/README.md`, `plan/09-DEV-SETUP.md`.
```

---

## 2. COMMENT on OZD-50 — `[Epic] OriginDNA pre-build (Jul–Sep 2026)`

**Comment (paste verbatim):**

```markdown
Progress (2026-07-27, PR #36 · branch claude/organize-file-structure-p5nlh9):

**Content-provenance line — shipped this session**
- Public **verify page** prototype live in repo: `/verify/` (EN) + `/tr/verify/`, wired
  into OriginDNA nav/footer + sitemap. Runs for real, client-side (nothing uploaded):
  SHA-256 (Web Crypto), a canvas dHash perceptual fingerprint, a re-encode-survival test
  (recompress → content hash changes, perceptual distance ~0/64), and a C2PA-manifest
  presence scan. Honest about C2PA status ("unknown source" explained; never claims
  "trusted Content Credentials"); blockchain stays invisible.
- **MVP build foundation** started under `app/` (new sub-issue: "OriginDNA MVP — build
  foundation (dna-core + D1 schema)"). `packages/dna-core` = OzDNA pHash v1, Merkle,
  leaf preimage, bands; `migrations/0001_init.sql` from plan/04 §5. 19 vitest tests green,
  tsc clean. Follows plan/03 + plan/04 verbatim.

**Caveats:** the verify rows beyond the live client-side checks (signer identity, anchor
proof) are illustrative until the signing/anchor/registry backend (apps/api, apps/anchor,
contracts) lands. Nothing deployed. Public launch still gated on the Hafta 2–3 TezMakale
cleanup confirmation.

**Note (stale?):** OZD-52 (`OriginDNA 0.3 — Waitlist landing page`) reads Todo, but
`docs/ACTION_PLAN.md` 0.3 is logged DONE (waitlist live at /products/origin, EN+TR,
Netlify Forms verified). Worth reconciling.
```

---

## 3. COMMENT on OZD-54 — `OriginDNA — Sep 30 build gate (G1)`

**Comment (paste verbatim):**

```markdown
Early build-gate work landed ahead of the gate (2026-07-27, PR #36): the MVP monorepo
foundation is up under `app/` — `packages/dna-core` (OzDNA pHash v1 per plan/03 §1.3,
Merkle per §3.2/§3.3, leaf preimage, bands+Hamming) + `migrations/0001_init.sql` (plan/04
§5), 19 vitest tests green + tsc clean. This de-risks the pHash and Merkle "September
spikes" early. Tracked in the new sub-issue "OriginDNA MVP — build foundation (dna-core +
D1 schema)". The gate's own criterion (≥75 waitlist / ≥25 AI segment / ≥5 discovery calls
per plan/07 §2.3) is unchanged and remains founder/GTM-side.
```

---

## 4. Session → Linear mapping

| Session deliverable (PR #36) | Linear item |
|---|---|
| Verify page `/verify/` + `/tr/verify/` (real client-side demo) | No dedicated issue → captured in OZD-50 comment (part of build scope) |
| MVP foundation `app/packages/dna-core` + `migrations/0001_init.sql` | **NEW issue** (§1), parent OZD-50, In Progress |
| pHash/Merkle early de-risk | Noted on OZD-54 (build gate) comment |
| AI-**oversight** site `ozdna.com/oversight/` (EN+TR) + Immortal MLRO | **No Linear project yet** — full sync spec in §6 (new project + epic + issues) |
| Docs corpus moved to `docs/oversight/` + README/banners | No issue (docs housekeeping) *or* §6.3 corpus issue if creating the Oversight project |
| Ownership fixes (CLAUDE.md/DOMAIN.md: standalone brand, entity TBD, AlignX separate) | No issue (docs) — relevant to any brand/legal issue if one exists |
| `docs/oversight/deferred.md` (parked decisions) | No issue (that file IS the parking lot) |
| complyDNA classification report template | §6.3 issue under Oversight project (if created); else Ay-2 GTM |

---

## 5. Reconciliation notes (founder decision — NOT auto-changed)

- **OZD-52** `OriginDNA 0.3 — Waitlist landing page` = `Todo`, but `docs/ACTION_PLAN.md`
  0.3 is **DONE** (waitlist live, EN+TR, Netlify Forms verified 2026-07-09/10). → mark Done?
- **OZD-51** `OriginDNA 0.1 — C2PA conformance email` = `Todo` (ACTION_PLAN 0.1 still open —
  the one unknown number). Unchanged; correct.
- **OZD-53** `OriginDNA 0.5 — Aug 2 PR push` = `Todo`. ACTION_PLAN note: 0.5 was
  **deprioritized** in favor of the NGI Zero filing (Aug 1); PR wave moved to the Dec 2
  cycle. → status/priority may want updating to reflect that.
- **OZD-21** `OzDNA Comply (RegTech) — Phase 2 product` = `Canceled`, and **OZD-39**
  `[Epic] ComplyDNA Cursor plan` = `Done`. Meanwhile the **AI-oversight** line (this
  session) revived the `complyDNA` NAME for a different thing (DT 5.0 + Council, AI Act
  Art. 9/14). This is the unresolved name-collision (`docs/oversight/README.md`) — a board
  + brand decision, deliberately not auto-changed here (tracked as §6.4 DECISION issue).

---

## 6. AI-oversight product line — full Linear sync spec

Earlier draft left this out unilaterally — **corrected**. Below is the complete, copy-paste
Linear structure for the AI-oversight line so it can be tracked too. One caution
(not a reason to omit): this line reuses the names `complyDNA` / `originDNA` for
different things than the content-provenance line, and the board already has
`OzDNA Comply (RegTech)` (OZD-21, Canceled) and `[Epic] ComplyDNA Cursor plan` (OZD-39,
Done). Decide the naming before/at creation (see O7 / §6.4 DECISION). Founder decision on record:
**ozDNA is its own umbrella**; AlignX Partners is a separate personal UK consulting
business (alignxpartners.com), **NOT** the umbrella; the two complyDNA/originDNA meanings
are split by path (`/products/*` content-provenance vs `/oversight/*` oversight).

### 6.1 NEW PROJECT

| Field | Value |
|---|---|
| Name | `ozDNA Oversight — AI Act runtime` |
| Team | `ozDNA` |
| Description | AI-oversight product line under the ozDNA umbrella. complyDNA = DT 5.0 classification + Council (EU AI Act Art. 9 / 14); originDNA = Ledger + Attestation (Art. 12 / 13). Turns the Act's risk-based logic into runtime. Public surface: ozdna.com/oversight. Source: docs/oversight/ (planning corpus) + repo-root oversight/ (static site). Distinct from the content-provenance line (C2PA image provenance); collision managed by path-split. |

### 6.2 NEW EPIC (in the project above)

| Field | Value |
|---|---|
| Title | `[Epic] ozDNA AI-oversight product line (ozdna.com/oversight)` |
| Team | `ozDNA` |
| Project | `ozDNA Oversight — AI Act runtime` |
| Status | `In Progress` |
| Priority | `High` |

**Description (paste verbatim):**

```markdown
AI-oversight product line under the ozDNA umbrella (founder-ratified 2026-07-27). ozDNA is
its own umbrella; **AlignX Partners is a separate personal UK consulting business
(alignxpartners.com), not the umbrella** — the uploaded corpus's "AlignX └── ozDNA"
hierarchy and "an AlignX Partners product" footer are superseded (`docs/oversight/README.md`).

Product: complyDNA (DT 5.0 classification + Council oversight → Art. 9/14), originDNA
(Ledger + Attestation → Art. 12/13). Served at `ozdna.com/oversight` (path-split from the
content-provenance line at `/`, `/products/*`, `/verify`). Planning corpus: `docs/oversight/`
(positioning, brand-architecture, ai-act-mapping, website-spec, roadmap-90d). Site source:
repo-root `oversight/`.

Shipped this session (PR #36, branch claude/organize-file-structure-p5nlh9): full EN+TR
static site (homepage + /comply + /origin + /use-cases/immortal-mlro), shared stylesheet,
forbidden-word gate, deploy-prep for ozdna.com/oversight, complyDNA classification report
template. Nothing deployed — gated on the TezMakale cleanup confirmation (roadmap-90d
Hafta 2–3) + founder sign-off.

Open decision: the complyDNA/originDNA name collision with the content-provenance line
(O7) and with the board's OZD-21/OZD-39. Parked items: `docs/oversight/deferred.md`.
```

### 6.3 ISSUES — shipped (create as Done, all in PR #36)

Each: Team `ozDNA` · Project `ozDNA Oversight — AI Act runtime` · Parent = the §6.2 epic.

| Title | Priority | Description (paste) |
|---|---|---|
| Oversight site — homepage + /comply + /origin (EN) | High | Static site per docs/oversight/website-spec.md: homepage (hero one-liner → problem → Classify→Route→Oversee→Prove → AI Act mapping table → field-proven evidence → who-it's-for KVHS/CASP/fintech → audit form → footer), /comply (DT 5.0 Art. 9 + Council veto/fail-closed Art. 14), /origin (Ledger Art. 12 + Attestation Art. 13 mock). Shared oversight/assets/site.css; dark engineering aesthetic; Netlify audit form; verbs implements/operationalises/evidences, no absolute claims, no competitor names. scripts/check-forbidden.sh gate (BrainStack/Solana/blockchain/on-chain/humanizer/ozDNA-variants/absolute-claims) passes. Verified in Chromium: 200s, zero JS errors. |
| Oversight site — TR parity + hreflang | Medium | /oversight/tr/ homepage + /comply + /origin, full Turkish, reciprocal hreflang (en/tr/x-default), EN↔TR footer links, same shared CSS. Verified: correct lang, zero errors. |
| Immortal MLRO use-case page (EN + TR) | Medium | /oversight/use-cases/immortal-mlro/ — autonomous compliance agent on the Council runtime (brand-architecture §3 permitted framing). Written fresh from the corpus (no prototype existed in-repo); no Solana/on-chain anywhere. Attestation mock shows the veto/HELD path; MASAK/CASP context; maps to Art. 9/12/13/14. |
| Oversight site — deploy prep for ozdna.com/oversight | Medium | Path-split mount: all internal absolute paths re-prefixed to /oversight/…; canonical/hreflang → https://ozdna.com/oversight/…; branded 404 + robots.txt + oversight URLs added to root sitemap.xml; AlignX decoupled from all footers. (An earlier mistaken alignxpartners.com deploy-prep was reversed per the founder correction.) Deploy itself pending (founder + Netlify + TezMakale gate). |
| complyDNA classification report template | Medium | docs/oversight/complydna-classification-report-template.md — the audit deliverable / lead magnet (roadmap-90d Ay 2): exec summary → method (DT 5.0 risk tiers) → per-workload classification table → Council/oversight → record-keeping/transparency → regulatory timeline → recommendations → pilot CTA. Content-rule compliant; not-legal-advice line. |
| Oversight corpus organized under docs/oversight/ + founder-correction banners | Low | 5 planning docs relocated to docs/oversight/ + README recording the founder override; correction banners on brand-architecture.md (§1 hierarchy void) and website-spec.md ("an AlignX Partners product" void); CLAUDE.md + DOMAIN.md cross-references updated. |

### 6.4 ISSUES — backlog / decisions (create as Backlog)

Each: Team `ozDNA` · Project `ozDNA Oversight — AI Act runtime` · Parent = the §6.2 epic (unless noted).

| Title | Priority | Description (paste) |
|---|---|---|
| DECISION: resolve complyDNA/originDNA name collision (two product lines) | High | Content-provenance uses complyDNA (RegTech) + originDNA (C2PA); oversight reuses the SAME names for DT/Council + Ledger/Attestation. Board also has OZD-21 (OzDNA Comply (RegTech), Canceled) and OZD-39 (ComplyDNA Cursor, Done). Path-split (/products/* vs /oversight/*) manages it operationally; long-term naming is a brand decision. Parked in docs/oversight/deferred.md. |
| Oversight brand tasks — logo variants, LinkedIn page, OG images | Medium | brand-architecture.md §5 (single logo + module color/icon variants; ozDNA-only LinkedIn company page). Footer LinkedIn link is a placeholder (www.linkedin.com) until the page exists; oversight pages have no OG/Twitter image+tags yet. |
| Re-verify EU AI Act article numbers + dates before any oversight publish | High | docs/oversight/ai-act-mapping.md is the authority but flags Omnibus not final: Art. 50 → 2 Aug 2026, Annex III → 2 Dec 2027, embedded → 2 Aug 2028. Re-verify before publishing any oversight material. |
| Deploy oversight site (Netlify) + domain/path decision | Medium | Decide ozdna.com/oversight (prepped) vs a subdomain. Wire Netlify (base=repo root, publish .; oversight served at /oversight/), enable Forms for audit-request/audit-request-tr. Gated on TezMakale cleanup confirmation + founder sign-off. |
| Immortal MLRO — real prototype/source (optional) | Low | The page is authored from the corpus; no live prototype exists in-repo. If a real demo is wanted, build/port one (Solana-free). |

### 6.5 Mapping — oversight deliverables (PR #36) → §6 issues

| Session deliverable (PR #36) | §6 Linear item |
|---|---|
| Oversight homepage + `/comply` + `/origin` (EN) | §6.3 `Oversight site — homepage + /comply + /origin (EN)` → **Done** |
| Oversight TR pages + hreflang | §6.3 `Oversight site — TR parity + hreflang` → **Done** |
| Immortal MLRO use-case (EN + TR) | §6.3 `Immortal MLRO use-case page (EN + TR)` → **Done** |
| Path-split /oversight mount, sitemap, AlignX decouple | §6.3 `Oversight site — deploy prep for ozdna.com/oversight` → **Done** |
| `complydna-classification-report-template.md` | §6.3 `complyDNA classification report template` → **Done** |
| `docs/oversight/` corpus + founder-correction banners + CLAUDE/DOMAIN refs | §6.3 `Oversight corpus organized under docs/oversight/ + founder-correction banners` → **Done** |
| Name-collision (complyDNA/originDNA dual meaning) | §6.4 `DECISION: resolve complyDNA/originDNA name collision` → **Backlog** |
| Logo / LinkedIn / OG (deferred.md) | §6.4 `Oversight brand tasks — logo variants, LinkedIn page, OG images` → **Backlog** |
| AI Act date re-verify before publish | §6.4 `Re-verify EU AI Act article numbers + dates…` → **Backlog** |
| Actual Netlify deploy + path vs subdomain | §6.4 `Deploy oversight site (Netlify) + domain/path decision` → **Backlog** |
| Live Immortal MLRO prototype (optional) | §6.4 `Immortal MLRO — real prototype/source (optional)` → **Backlog** |
| Project + epic container | §6.1 project + §6.2 epic → create first, then attach §6.3/§6.4 |
