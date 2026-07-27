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
| AI-**oversight** site `ozdna.com/oversight/` (EN+TR) + Immortal MLRO | **No matching Linear project** — see §6 (not synced) |
| Docs corpus moved to `docs/oversight/` + README/banners | No issue (docs housekeeping) |
| Ownership fixes (CLAUDE.md/DOMAIN.md: standalone brand, entity TBD, AlignX separate) | No issue (docs) — relevant to any brand/legal issue if one exists |
| `docs/oversight/deferred.md` (parked decisions) | No issue (that file IS the parking lot) |
| complyDNA classification report template | No issue → relates to Ay-2 GTM (roadmap-90d); create if the founder wants it tracked |

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
  + brand decision, deliberately not touched here.

---

## 6. Deliberately NOT synced

- The **AI-oversight product line** (`ozdna.com/oversight/`, complyDNA/originDNA as EU AI
  Act runtime) has **no Linear project**. Standing up a new project/initiative for it is a
  separate founder decision — raise it explicitly before creating board structure, because
  it reuses names already on the board for different products (see §5, OZD-21/OZD-39).
