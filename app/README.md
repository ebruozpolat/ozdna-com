# ozDNA — content-provenance MVP (foundation)

This is the start of the **ozDNA content-provenance service** (images: C2PA signing,
public tamper-evident timestamp, perceptual-fingerprint registry). It is a Cloudflare
Workers monorepo, **distinct from the marketing site** (which is the rest of this
`ozdna-com` repo, served on Netlify).

> **Location note:** the canonical plan (`../plan/09-DEV-SETUP.md` §3) envisions this as
> its own `ozdna` repo. The GitHub App in the current session can't create repos, so the
> founder chose to start it here under `app/` and extract it to a dedicated repo later.
> Nothing here is wired into the Netlify build; the root site is untouched.

## What's here now (v1 foundation — pure, locally verifiable, zero infra/secrets)

```
app/
  packages/dna-core/     # THE shared math (one impl for browser + Workers)
    src/sha256.ts        #   Web Crypto SHA-256 + hex/bytes helpers
    src/merkle.ts        #   Merkle tree: leaf=SHA256(0x00‖pre), node=SHA256(0x01‖l‖r),
                         #     odd node promoted (not duplicated) — plan/03 §3.3
    src/leaf.ts          #   canonical leaf preimage (plan/03 §3.2)
    src/phash.ts         #   OzDNA pHash v1 (luma → 32×32 box → DCT-II → 8×8 → median) — plan/03 §1.3
    src/bands.ts         #   4×16-bit band slicing + Hamming (plan/03 §2.2)
    src/verdict.ts       #   §6.3 enum + locked copy + §1.5 thresholds
    src/schema.ts        #   zod: LeafRecord, VerdictCard, ProofSkeleton
    test/*.test.ts       #   vitest (property/round-trip + verdict/schema)
  packages/anchor-backends/  # AnchorBackend + NullAdapter + BaseAdapter (viem)
  apps/api/src/db/schema.ts  # drizzle twin of 0001_init (usage_events + waitlist included)
  contracts/OzDnaAnchor.sol  # plan/03 §3.5 (forge tests deferred)
  migrations/0001_init.sql   # D1 schema, verbatim from plan/04 §5
  TOOLCHAIN.md               # explicit corpus vs foundation divergences
  tsconfig.base.json / vitest.config.ts / package.json
```

## Not built yet (need infra / secrets / decisions — later batches)
- `POST /v1/marks` full-image server pipeline (Workers Paid + CF deploy)
- Live Base anchoring (adapter wired; needs CF Secrets + deployed OzDnaAnchor)
- Cloudflare account bindings (real D1 id / R2 / KV), production signing cert, Base gas wallet — founder-provisioned
- Netlify (or Pages) publish of `apps/web/dist` as public deep-verify URL

Landed polish: Vite `@ozdna/web` Wasm verify UI; `npm run test:workers` (vitest-pool-workers + D1 waitlist).

See `TOOLCHAIN.md` for TypeScript / Vitest / drizzle / BaseAdapter pins vs the corpus.

## Run
```bash
cd app
npm install
npm test          # vitest (packages + health) then test:workers (D1)
npm run check     # typecheck + biome + test — batch gate (plan/09 §9)
npm run test:workers
npm run typecheck # tsc --noEmit (strict + noUncheckedIndexedAccess)
npm run lint      # biome check
npm run certs:dev # local P-256 self-signed PEMs → certs/dev/
npm run dev -w @ozdna/web   # C2PA Wasm verify SPA
npm run db:generate # drizzle-kit → apps/api/drizzle/ (diff check; do not overwrite migrations/0001)
```

## Rules that bind this code (from ../CLAUDE.md + plan/)
Images only (JPG/PNG); no AI-detection; no token; blockchain is invisible plumbing;
never claim "trusted Content Credentials" (self-signed = "unknown source"); client pays
compute; Cloudflare-first, ~$0 budget. Read `../plan/09-DEV-SETUP.md` first, then
`../plan/03-ALGORITHMS.md` for anything in `dna-core`.
