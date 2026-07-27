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
  packages/anchor-backends/  # AnchorBackend + NullAdapter (tested) + BaseAdapter stub
  apps/api/src/db/schema.ts  # drizzle stub twin of 0001_init (routes not built)
  contracts/OzDnaAnchor.sol  # plan/03 §3.5 (forge tests deferred)
  migrations/0001_init.sql   # D1 schema, verbatim from plan/04 §5
  TOOLCHAIN.md               # explicit corpus vs foundation divergences
  tsconfig.base.json / vitest.config.ts / package.json
```

## Not built yet (need infra / secrets / decisions — later batches)
- `apps/api` routes (Hono Worker: `/v1/sign-digest`, `/v1/marks`, verify, registrations) — schema stub only
- `apps/anchor` (cron Worker: Merkle batch → Base tx → proofs; wire BaseAdapter + viem)
- `apps/web` (Astro sign/verify SPA loading `@contentauth/c2pa-web` WASM)
- PDQ-256 wrapper (plan/03 §1.4); workerd Vitest pool; drizzle-kit generate; `forge test`
- Cloudflare account bindings (D1/R2/KV), signing cert chain, Base gas wallet — all founder-provisioned

See `TOOLCHAIN.md` for TypeScript / Vitest / drizzle pins vs the corpus.

## Run
```bash
cd app
npm install
npm test          # vitest — packages/dna-core
npm run typecheck # tsc --noEmit (strict + noUncheckedIndexedAccess)
```

## Rules that bind this code (from ../CLAUDE.md + plan/)
Images only (JPG/PNG); no AI-detection; no token; blockchain is invisible plumbing;
never claim "trusted Content Credentials" (self-signed = "unknown source"); client pays
compute; Cloudflare-first, ~$0 budget. Read `../plan/09-DEV-SETUP.md` first, then
`../plan/03-ALGORITHMS.md` for anything in `dna-core`.
