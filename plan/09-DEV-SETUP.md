# 09 — Developer Setup & Local Dev Guide

> Changelog
> - 2026-07-07 · v1.0 · New document. The day-one onboarding guide: git clone → signed test image → DNA record in local D1, without reading the whole corpus. Derives from 01/02/03/04/08; owns nothing canonical — when it disagrees with an owning doc, the owner wins (see §11).

---

## 1. Overview + reading order

You are building **OzDNA**: a content-provenance service for images. Every image gets a "DNA" — a C2PA signature at creation, a blockchain-anchored timestamp nobody can backdate, and a perceptual-hash fingerprint that survives platforms stripping metadata. v1 is **images only (JPG/PNG)**, hosted **Cloudflare-first**, on a **~$0–20/mo** budget.

**This document gets you running.** The other plan docs explain *why* and own the details. Read them on demand:

| If you need to… | Read | Owns |
|---|---|---|
| Understand the system shape, the 3 Workers, trust boundaries | `01-ARCHITECTURE.md` | System shape, key-management design, consent policy |
| Know a package name, version, or tooling choice | `02-TECH-STACK.md` | Package choices & versions, hosting, payments, tooling |
| Implement an algorithm (pHash, PDQ, Merkle, verdicts, certs) | `03-ALGORITHMS.md` | Algorithms, thresholds, verdict enum & rule-5 copy, anchor mechanism |
| Build an API route, a DB table, or scope a week | `04-MVP-SPEC.md` | REST API, D1 SQL schema, product scope, week-by-week plan |
| Understand a risk, legal posture, or ToS floor | `05-RISK-REGISTER.md` | Risk framing, KVKK/GDPR, Law 7518 |
| Reason about cost or margins | `06-COST-MODEL.md` | All cost arithmetic |
| Know the GTM/SEO/PR plan or banned-phrase list | `07-GTM-SEO-PR.md` | GTM, **Sept-30 build gate**, banned phrases |
| Know what happens when, and what "done" means | `08-ROADMAP-GATES.md` | Process, gates, precedence |
| Ground truth + the 8 hard rules | `../CLAUDE.md` | Everything — wins over all plan docs |

**Minimum to be productive:** this file end-to-end, then `04-MVP-SPEC.md` (§4 API, §5 schema) and `02-TECH-STACK.md` (§15 stack-at-a-glance). Skim `03` when you touch hashes, certs, or anchoring.

**One hard rule you must internalize before writing any user-facing string:** self-signed C2PA signatures show **"unknown source"** in Adobe's official Verify tool — that is expected and correct (hard rule 5). User-facing copy must **never** say "authentic", "trusted", "verified", or "Content Credentials verified". See §8 (copy-compliance check) and `07-GTM-SEO-PR.md` §5.2.

---

## 2. Prerequisites — exact toolchain

Version pins below are **locked** where an owning doc pins them (source in the last column). Anything marked **RECOMMENDED** is a sensible default this doc proposes — confirm before relying on it. Re-verify any pin older than ~60 days with `npm view <pkg> version` before the October build (per `08` phase checklists).

| Tool | Version | Why / notes | Source |
|---|---|---|---|
| **Node.js** | **22 LTS** | c2pa-js tooling wants ≥22; use the current 22.x LTS patch | 02 §14 |
| **Package manager** | **npm** (workspaces) | Locked: single repo, **npm workspaces**. Do **not** introduce pnpm/yarn | 02 §14, §13 |
| **wrangler** | **4.107.0**, pin `^4` (update monthly-ish) | Cloudflare CLI: local D1/R2/KV sim, dev, deploy, secrets | 02 §13 |
| **@cloudflare/workers-types** | 5.20260706.1 | Worker type defs | 02 §13 |
| **TypeScript** | **6.0.3** (`strict: true` + `noUncheckedIndexedAccess`) | Global strictness is non-negotiable | 02 §14 |
| **Vitest** | 4.1.10 + `@cloudflare/vitest-pool-workers` 0.18.0 | Tests run **inside workerd**, not Node | 02 §14 |
| **Biome** | 2.5.2 | Lint + format, one tool. No eslint/prettier | 02 §14 |
| **Foundry** | latest; solc **0.8.35** (0.8.x line) | Build/test/deploy the anchor contract (`forge`, `cast`, `anvil`) | 02 §7 |
| **git** | any recent | GitHub free private repo, org **Find Below Ventures** | 02 §13 |
| **openssl** | system (LibreSSL/OpenSSL 3.x) | Generate the local dev signing cert chain (§4 step 5) | 03 §5.1 |
| **Cloudflare account** | free tier | For `wrangler login`; needed to create D1/R2/KV bindings (even local-first needs a `database_id`) | 02 §2 |

Install Foundry: `curl -L https://foundry.paradigm.xyz | bash && foundryup`. Install Node 22 via your version manager (nvm/fnm/asdf). Then `wrangler login` once (opens a browser; auth stays on your machine — **no Cloudflare API token ever goes into CI**, per 02 §13).

ASSUMPTION: an `.nvmrc` / `.node-version` pinning `22` and an `engines` field in the root `package.json` should be committed so everyone lands on the same Node. Confirm and add if missing.

---

## 3. Repository layout (canonical)

Single repo, **npm workspaces**. This tree reconciles `01-ARCHITECTURE.md` §1 (system shape — owner) and `02-TECH-STACK.md` §14 (tooling). 01 includes `packages/anchor-backends`; 02's summary omits it but 02 §6/§12 reference it — so it stays. **This is the one canonical tree:**

```
ozdna/
  apps/
    web/                 # Astro 7 static site: landing, segmented waitlist,
                         #   sign SPA island (c2pa-web WASM), verify page, docs.
                         #   Served as Workers static assets. Binds NO secrets.
    api/                 # Hono Worker: waitlist intake, POST /v1/sign-digest,
                         #   POST /v1/marks, verify lookups, admin routes.
                         #   Binds signing key + Turnstile + billing + email secrets.
    anchor/              # Cron Worker (no HTTP route). Builds Merkle batches,
                         #   submits the anchor tx, writes proofs back.
                         #   Binds the GAS-WALLET secret — and ONLY it (trust isolation).
  packages/
    dna-core/            # THE shared math, one copy imported by browser AND Workers:
                         #   OzDNA pHash v1 (own DCT 64-bit), PDQ-256 wrapper (pdq-wasm),
                         #   SHA-256 helpers, Merkle tree, hash-normalization pipeline,
                         #   zod schemas. Algorithm spec is owned by 03; this is the impl.
    anchor-backends/     # AnchorBackend interface + adapters: NullAdapter (dev/test,
                         #   fake receipts) + BaseAdapter (viem). INVARIANT: nothing
                         #   outside apps/anchor imports viem or any chain SDK (01 §6).
  contracts/             # Foundry project: OzDnaAnchor.sol (build from 03 §3.5, NOT
                         #   the sketch in 02 §7) + deploy scripts + forge tests.
  migrations/            # wrangler-native D1 .sql migrations (drizzle-kit generates them).
  tests/fixtures/        # golden images, tampered-C2PA corpus, Merkle test vectors (§7).
```

**Architectural invariant (do not violate):** the perceptual hash is **one implementation in `packages/dna-core`**, bundled for both the browser and the Worker. Two implementations that drift by one bit destroy matching (01 §1, 03 §1).

RECOMMENDED: each of `apps/*`, `contracts/`, and the root carry their own `package.json`; the root holds the workspace list, shared scripts (§6), `biome.json`, `tsconfig.base.json`, and `drizzle.config.ts`.

---

## 4. First-run walkthrough — git clone → DNA record in local D1

Copy-pasteable. Everything runs **locally** against `wrangler dev`'s built-in D1/R2/KV simulation — zero network, zero spend, no deploy.

**1. Clone and install**
```bash
git clone <repo-url> ozdna
cd ozdna
npm install                      # installs all workspaces
```

**2. Provision Cloudflare-side resource IDs (one-time).** `wrangler dev --local` simulates D1/R2/KV on disk, but `wrangler.jsonc` still needs a `database_id`/bucket name to bind against. Create dev resources (cheap/free, gives you the IDs) and paste them into `apps/api/wrangler.jsonc`:
```bash
npx wrangler login
npx wrangler d1 create ozdna-dev          # prints database_id → paste into wrangler.jsonc
npx wrangler r2 bucket create ozdna-dev-manifests
npx wrangler kv namespace create ozdna-dev-kv
```
ASSUMPTION: binding names are **not pinned in the corpus**. This doc recommends `DB` (D1), `MANIFESTS` (R2), `KV` (KV) — confirm and keep them consistent across `apps/api` and `apps/anchor` wrangler configs. See §5.

**3. Create local env files.** Secrets in local dev live in per-app `.dev.vars` (git-ignored — **never committed**, 02 §13). Create `apps/api/.dev.vars` and `apps/anchor/.dev.vars`; fill from the catalog in §5. The signing key/cert you generate in step 5; use a **testnet** gas key for anchor (Base Sepolia).

**4. Run D1 migrations locally.** The schema's source of truth is **`04-MVP-SPEC.md` §5** (the complete `0001_init.sql`). Migrations are authored via drizzle-kit and applied wrangler-native (02 §7):
```bash
npm run db:generate                                          # drizzle-kit → migrations/*.sql
npx wrangler d1 migrations apply ozdna-dev --local           # apply to the local sim
```
ASSUMPTION: the drizzle schema (`apps/api/src/db/schema.ts`) encodes 04 §5's DDL verbatim (columns, band indexes, CHECK constraints). If the team commits 04 §5's SQL directly as `migrations/0001_init.sql` instead of generating it, skip `db:generate` and apply directly — either way the **columns are owned by 04 §5**.

**5. Generate a LOCAL self-signed signing cert chain.** C2PA signing needs an X.509 chain embedded in the manifest's COSE `x5chain` header. For local dev, generate a **throwaway** chain on your normal machine (the offline networking-disabled ceremony in 03 §5.1 is for **production** keys only — never reuse the prod root here). The cert *design* (hierarchy, validity, EKU) is owned by **03 §5.1 / 02 §2**; these are those commands, minimal for a local leaf:
```bash
mkdir -p .local-certs && cd .local-certs
# Root (local dev only)
openssl ecparam -name prime256v1 -genkey -noout -out root.key
openssl req -x509 -new -key root.key -sha256 -days 3650 \
  -subj "/C=AE/O=Find Below Ventures/CN=OzDNA DEV Root CA" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:1" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" -out root.crt
# Leaf (the free-registry signer)
openssl ecparam -name prime256v1 -genkey -noout -out leaf.key
openssl req -new -key leaf.key \
  -subj "/C=AE/O=Find Below Ventures/CN=OzDNA Free Registry DEV" -out leaf.csr
openssl x509 -req -in leaf.csr -CA root.crt -CAkey root.key -CAcreateserial \
  -days 365 -sha256 -out leaf.crt \
  -extfile <(printf "basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature\nextendedKeyUsage=emailProtection")
cd ..
```
Then wire them into `apps/api/.dev.vars` (see §5): the **private key** `leaf.key` → `SIGNING_KEY_FREE_REGISTRY`; the **cert chain** (`leaf.crt` + `root.crt` concatenated) → a var/const the Worker reads (cert chain is *public* material). UNVERIFIED (03 §5.1): the exact EKU OID set the C2PA cert profile requires — `emailProtection` is the current best guess; a wrong EKU makes the official Verify tool reject the chain. Fine for local round-trips; confirm before minting **prod** certs.

**6. Run the app.** In two terminals (or one `npm run dev` if a root orchestrator exists):
```bash
npm run dev -w apps/api          # wrangler dev on the Hono Worker (localhost:8787)
npm run dev -w apps/web          # Astro dev / wrangler dev for the sign+verify SPA
```
The web sign island loads the `@contentauth/c2pa-web` WASM, and its `Signer` callback POSTs the to-be-signed bytes to the api Worker's `POST /v1/sign-digest`.

**7. Sign a sample JPG.** Open the sign page, upload `tests/fixtures/golden/sample.jpg` (or any JPG). The browser: decodes → computes SHA-256 + OzDNA pHash v1 + PDQ-256 → builds the C2PA manifest → calls `/v1/sign-digest` → embeds the returned COSE_Sign1 → calls `POST /v1/registrations` to register. 

ASSUMPTION / known open item: the exact `/v1/sign-digest` contract (raw ES256 signature vs. a full server-assembled COSE_Sign1 with `x5chain`) is the **September signing-credential spike**, not yet closed (02 §1/§2, 03 §4.2). Until that endpoint is implemented, exercise the registry path with a stub signer (sign-digest returns a fixed COSE_Sign1) so pHash + D1 registration still round-trip. Treat "the real signer works end-to-end" as gated on that spike.

**8. Confirm the DNA record row in local D1:**
```bash
npx wrangler d1 execute ozdna-dev --local \
  --command "SELECT id, substr(sha256,1,12) AS sha, phash64, status, source FROM records ORDER BY created_at DESC LIMIT 5;"
```
Expect a `rec_…` row with `status='registered'`, `source='web_sign'`, the SHA-256 of the **signed** bytes, and a populated `phash64` (04 §1 story-1 acceptance criteria). That is a DNA record. Done.

---

## 5. Environment variables & secrets catalog

**Rule, non-negotiable (02 §13, hard rules 2 & 5):** secrets are set in prod/staging **only** via `wrangler secret put NAME --env <env>` and locally **only** via git-ignored `.dev.vars`. **Never** put a secret in `wrangler.jsonc`, never commit `.dev.vars`, never send a signing/gas private key to a browser. Public material (cert **chains**, Turnstile **site** key, contract address, RPC URL) may live in `wrangler.jsonc` `vars` and the repo.

| Name | Used by | Local value source | Prod/staging source | Notes |
|---|---|---|---|---|
| `SIGNING_KEY_FREE_REGISTRY` | api | `.dev.vars` = your local `leaf.key` (§4.5) | `wrangler secret put` | Free-tier leaf **private** key (ES256). Different key+cert per env. Prod key re-minted every 90 days (03 §5.2). |
| `OZDNA_CERT_CHAIN` (var, not secret) | api | `wrangler.jsonc` var or bundled const = `leaf.crt`+`root.crt` | `wrangler.jsonc` var per env | Cert **chain is public** — ships inside every signed image (02 §2). Not a secret. |
| `KEK` | api | `.dev.vars` (random 32-byte base64) | `wrangler secret put` | Key-encryption-key that envelope-encrypts per-tenant leaf keys stored in D1 `signing_keys.wrapped_key` (01 §9). |
| `SIGNING_KEY_CUST_<slug>` | api | n/a in v1 dev | via `KEK`-wrapped blob in D1, not a per-secret | Per-customer leaf keys are **envelope-encrypted in D1**, not one-secret-each (Secrets Store caps at 20). Only `KEK` is cloud-stored (01 §9, 03 §5.4). |
| `ANCHOR_PRIVATE_KEY` | **anchor only** | `.dev.vars` = a **Base Sepolia** testnet EOA key | `wrangler secret put --env` | Gas-wallet key. **TESTNET in dev/staging (Base Sepolia 84532); tiny mainnet (8453) balance ≤$20 in prod.** Never user funds (hard rule 2). Bound ONLY to the anchor Worker (01 §8). |
| `ANCHOR_CONTRACT_ADDRESS` (var) | anchor, web verify | `wrangler.jsonc` var | `wrangler.jsonc` var per env | Deployed `OzDnaAnchor` address. Public. |
| `BASE_RPC_URL` (var) | anchor | `https://sepolia.base.org` | prod `https://mainnet.base.org` | Public RPC; verify page also uses a public RPC (03 §3.7). |
| `PADDLE_API_KEY` | api | `.dev.vars` (Paddle sandbox key) | `wrangler secret put` | Payments (Paddle MoR; Polar backup). Sandbox in dev. |
| `PADDLE_WEBHOOK_SECRET` | api | `.dev.vars` (sandbox) | `wrangler secret put` | Verifies inbound `POST /webhooks/billing` signatures. |
| `RESEND_API_KEY` | api, anchor | `.dev.vars` (Resend test key) | `wrangler secret put` | Transactional email: waitlist double-opt-in, magic links, gas-low-balance alert (anchor). |
| `TURNSTILE_SITE_KEY` (var) | web (client) | Cloudflare test site key | `wrangler.jsonc` var | **Public**, rendered in the browser. Two widgets: waitlist + free sign. |
| `TURNSTILE_SECRET_KEY` | api | `.dev.vars` (Cloudflare test secret) | `wrangler secret put` | Server-side Turnstile verification. |
| `WEBHOOK_HMAC_MASTER` | api | `.dev.vars` (random) | `wrangler secret put` | Signs outbound `Ozdna-Signature` webhook headers (04 §4). |
| `TSA_CREDS` (if any) | api | usually none | `wrangler secret put` if needed | RFC 3161 timestamp authority — attempt free public TSA (DigiCert) in Sept spike; may be none (02 §2). |
| `SENTRY_DSN` | api, web islands | `.dev.vars` (or empty to disable) | `wrangler secret put` / var | Error tracking (`@sentry/cloudflare`, free tier). Low sensitivity. |
| `DB` (binding) | api, anchor | `wrangler.jsonc` `d1_databases` (`ozdna-dev`) | per-env D1 database_id | RECOMMENDED binding name (not corpus-pinned). |
| `MANIFESTS` (binding) | api | `wrangler.jsonc` `r2_buckets` | per-env R2 bucket | Manifest bytes, batch leaf lists, thumbnails. RECOMMENDED name. |
| `KV` (binding) | api | `wrangler.jsonc` `kv_namespaces` | per-env KV id | Read-heavy caches only: published cert-status mini-CRL, public config (01 §2). RECOMMENDED name. |

Test-list the prod secrets you've set with `wrangler secret list --env production`. Rotate per 03 §5.2 (leaf 90 days; rotate immediately on suspicion).

---

## 6. Commands reference

RECOMMENDED root-level npm scripts (confirm exact wiring against the repo). `-w apps/api` targets one workspace; omit for all.

| Task | Command | Notes |
|---|---|---|
| Install | `npm install` | Workspaces resolved from root |
| Dev (api) | `npm run dev -w apps/api` | `wrangler dev` — local D1/R2/KV sim, localhost:8787 |
| Dev (web) | `npm run dev -w apps/web` | Astro dev / wrangler dev for the SPA |
| Build | `npm run build` | Astro `dist/` + Worker bundles |
| Typecheck | `npm run typecheck` | `tsc --noEmit` (strict + `noUncheckedIndexedAccess`) |
| Test | `npm run test` | Vitest via `@cloudflare/vitest-pool-workers` (runs in workerd) |
| Lint | `npm run lint` | `biome check` |
| Format | `npm run format` | `biome format --write` |
| **Batch gate** | `npm run check` | **types + biome + vitest** — must be green to end a work batch (02 §13) |
| DB: generate migration | `npm run db:generate` | `drizzle-kit generate` → `migrations/*.sql` |
| DB: migrate local | `npx wrangler d1 migrations apply ozdna-dev --local` | Local sim |
| DB: migrate staging | `npx wrangler d1 migrations apply <db> --env staging` | Founder sign-off first (§10) |
| DB: migrate prod | `npx wrangler d1 migrations apply <db> --env production` | Tested restore path required first (08 §4.2) |
| DB: query local | `npx wrangler d1 execute ozdna-dev --local --command "SELECT …"` | Inspect rows |
| Deploy staging | `npx wrangler deploy --env staging` | Anchors to Base Sepolia. Founder sign-off (§10) |
| Deploy prod | `npx wrangler deploy --env production` | **One per work batch**, tag `deploy/YYYY-MM-DD`. Founder sign-off. **Not ozdna.com until §10** |
| Live logs | `npx wrangler tail --env <env>` | Real-time Worker logs |
| Set secret | `npx wrangler secret put NAME --env <env>` | Only way secrets reach prod (§5) |
| Contract build | `forge build` (in `contracts/`) | solc 0.8.35 |
| Contract test | `forge test` | Unit-test `OzDnaAnchor` (03 §3.5) |
| Contract deploy (Sepolia) | `forge script … --rpc-url $BASE_SEPOLIA_RPC --broadcast` | Base Sepolia 84532; fund via Coinbase Developer Platform faucet |

---

## 7. Testing strategy

Four test classes carry this codebase. The two "spike" tests (C2PA differential, pHash golden-image) start as September de-risking spikes and become **permanent regression tests** — that is the point.

1. **Unit (Vitest, in-workerd).** `@cloudflare/vitest-pool-workers` 0.18.0 runs tests inside the real Workers runtime, catching Workers-specific issues Node can't. Cover `packages/dna-core` (hash normalization, band slicing, Merkle) and api route handlers.

2. **C2PA differential test (`c2pa-ts` vs `c2patool`).** The single riskiest assumption in the stack: images signed by `@trustnxt/c2pa-ts` must validate byte-compatibly in Adobe's `c2patool` (c2pa-rs) (02 §2). Run our signer over a corpus that **includes tampered files** (pixels altered after signing, truncated manifests, swapped bytes) and assert `c2patool` reports valid-for-clean, invalid-for-tampered. Expect "unknown source" on the clean ones — that's correct (hard rule 5), not a failure.

3. **Perceptual-hash golden-image cross-runtime test.** The browser impl and the Worker impl must produce **identical** OzDNA pHash v1 output for the same image (03 §1). Commit **≥5 golden images** with expected hashes; the corpus **must** include one with a non-default **EXIF Orientation** tag (e.g. Orientation=6, a portrait phone photo — the only test that catches a step-0 orientation divergence) and **should** include one near-flat image (median-tie degenerate case). Tolerance: identical within the same decoder family, `d ≤ 2` cross-decoder (thresholds are never 0 for this reason — 03 §1). This is the September EXIF spike frozen into CI.

4. **Anchor inclusion-proof test.** Using `packages/dna-core`'s Merkle impl and the **committed test vectors** (03 §3.3, 0x00/0x01 domain separation — do **not** use `@openzeppelin/merkle-tree`, incompatible format), assert that a leaf's proof reconstructs the published root. Run the whole anchor flow offline with `anchor-backends` `NullAdapter` (fake receipts). Plus `forge test` on `OzDnaAnchor` (03 §3.5).

**Fixtures:** `tests/fixtures/` — `golden/` (images + `expected-hashes.json`), `c2pa-corpus/` (clean + tampered signed images), `merkle/` (test vectors). RECOMMENDED layout; confirm against the repo.

---

## 8. Git & PR workflow

**Branch naming (RECOMMENDED):** `type/short-slug` — `feat/sign-digest-endpoint`, `fix/phash-exif-orientation`, `chore/bump-wrangler`. During the October build, `wN/...` week-prefixing is also fine (08 §4.1). Confirm the team convention.

**PR template (RECOMMENDED contents):**
- **What & why** — one paragraph; link the owning doc section if it implements a spec (e.g. "implements 04 §4 `POST /v1/marks`").
- **Screenshots / logs** for any user-facing change or new route.
- **Docs touched** — if behavior diverges from a plan doc, say which doc+section and whether the owner was updated (per 00-INDEX maintenance rules).
- **Definition of Done checklist** (below).

**Definition of Done — every PR:**
- [ ] `npm run check` green (typecheck + Biome + Vitest).
- [ ] New logic has unit tests; spec-implementing PRs update the relevant golden/differential/inclusion fixtures if behavior changed.
- [ ] **No secrets committed.** No private keys, no `.dev.vars`, no tokens in `wrangler.jsonc` or code. (Grep your diff for `-----BEGIN`, `ozdna_live_`, `PRIVATE_KEY`.)
- [ ] **Copy-compliance check (hard rule 5).** Every new/changed **user-facing string** avoids the banned words — never "authentic", "trusted", "verified", "Content Credentials verified", or any claim of external trust for a self-signed signature. Run the `07-GTM-SEO-PR.md` §5.2 banned-phrase audit on the diff. This applies to UI copy, API `headline`/`footer` fields (owned by 03 §6.3 — reproduce those verbatim), docs, and error messages.
- [ ] No new dependency imports a chain SDK outside `apps/anchor` (01 §6 invariant).
- [ ] If a migration is added: it's `migrations/`-native and has a tested local apply.
- [ ] No deploy performed as part of the PR (deploys are manual + founder-signed — §10).

---

## 9. CI (GitHub Actions) — minimal, no auto-deploy

CI runs check + test on push/PR and **never deploys** (deploys stay manual on the founder's machine; **no Cloudflare API token in GitHub** — 02 §13). Outline:

```yaml
# .github/workflows/ci.yml   (RECOMMENDED)
name: ci
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run lint
  contracts:                      # optional, only when contracts/ changes
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1
      - run: forge test
        working-directory: contracts
```

No secrets are required for CI (it runs no network deploys). GitHub free includes 2,000 Actions minutes/mo — ample (02 §13).

---

## 10. Operational guardrails for devs

> **READ THIS BOX BEFORE YOU DEPLOY, SPEND, OR PUBLISH ANYTHING.**
>
> - **Never deploy without the founder's explicit sign-off.** Any deploy to any publicly reachable environment (production *and* shared preview URLs) requires it, every time (08 §1.3).
> - **Deploy rarely.** Target **one production deploy per work batch / per week** (hard rule 8) — builds and deploys cost money/quota. End a batch with `npm run check` green, deploy to **staging**, run the smoke path (sign → register → verify → anchor-dry-run), then one prod deploy tagged `deploy/YYYY-MM-DD`.
> - **ozdna.com is BLOCKED.** Nothing deploys to the domain until `ACTION_PLAN.md` 0.9 (partner migration) is logged **DONE**. Until then deploy to a `*.workers.dev` / `pages.dev` / subdomain only, unlinked, for founder review (08 §1.3, §2.2).
> - **Gas wallet is testnet-only in dev.** `ANCHOR_PRIVATE_KEY` must be a **Base Sepolia** key locally and in staging. Mainnet (Base 8453) holds ≤ ~$20 of **our** ETH, in prod only, funded only with founder sign-off (08 §4.3).
> - **Never touch user funds.** No custody, no trade execution, no wallets holding user value — Turkey's CASP regime makes it criminal (hard rule 2). Our gas wallet pays our own anchoring; that's it.
> - **No token.** Not in code, config, copy, or architecture. Ever (hard rule 1).
> - **Images only in v1** (JPG/PNG). No video/audio/mobile (hard rule 6 scope).
> - **No AI-detection classifiers in v1** (hard rule 3). Provenance, not detection.
> - **Self-signed = "unknown source."** Never let copy claim "authentic/trusted/verified" (hard rule 5, §8).

---

## 11. Where to look next

| Your task | Go to |
|---|---|
| API endpoint shape, request/response, error model | `04-MVP-SPEC.md` §4 |
| D1 table columns, indexes, constraints (source of truth) | `04-MVP-SPEC.md` §5 |
| Verdict enum + exact rule-5-safe copy strings | `03-ALGORITHMS.md` §6.3 |
| pHash / PDQ params, thresholds, band scheme, EXIF normalization | `03-ALGORITHMS.md` §1–§2 |
| Signing cert design, hierarchy, rotation, openssl | `03-ALGORITHMS.md` §5 · `02-TECH-STACK.md` §2 |
| Merkle construction, anchor contract, inclusion proof | `03-ALGORITHMS.md` §3 |
| Package name / version / hosting / payments / tooling | `02-TECH-STACK.md` (§15 = at-a-glance) |
| System shape, trust boundaries, key management, consent | `01-ARCHITECTURE.md` |
| Cost / margin / gas math | `06-COST-MODEL.md` |
| What ships which week; gates; "done" criteria | `08-ROADMAP-GATES.md` §4–§5 |
| Banned phrases; Sept-30 build gate; GTM | `07-GTM-SEO-PR.md` (§5.2 · §2.3) |
| Risks, legal (KVKK/GDPR, Law 7518), ToS floors | `05-RISK-REGISTER.md` |
| The 8 hard rules (win over everything) | `../CLAUDE.md` |
| Live task statuses & decisions log (supersedes this corpus if newer) | `../docs/ACTION_PLAN.md` |
