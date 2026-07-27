# app/ toolchain — corpus vs foundation (explicit divergences)

Canonical pins: `../plan/09-DEV-SETUP.md` §2 / `../plan/02-TECH-STACK.md`.
This file exists so silent scoping does **not** happen again (session ledger A5/A6).

| Item | Corpus mandate | What landed in foundation | When to reconcile |
|---|---|---|---|
| TypeScript | **6.0.3** (strict + `noUncheckedIndexedAccess`) | Pinned to `6.0.3` in root `package.json` (was briefly `^7.0.2` by auto-bump — corrected) | Done |
| Vitest runtime | Vitest **4.1.10** + `@cloudflare/vitest-pool-workers` **0.18.0** (tests inside **workerd**) | Plain-node Vitest for packages + health/OpenAPI unit tests; D1 integration still needs pool-workers | Add pool-workers when remote D1 is provisioned |
| D1 schema authoring | drizzle-kit generates `migrations/*.sql` from `apps/api/src/db/schema.ts` | Raw `migrations/0001_init.sql` + drizzle stub (excluded from `tsc` until `drizzle-orm` is a dep) | `npm i drizzle-orm` + `db:generate` when routes expand |
| Biome / Foundry / wrangler | pinned in plan/09 | `foundry.toml` + `forge test` (OzDnaAnchor) in CI; wrangler.jsonc for api/anchor | Foundry CI live; production Workers deploy still needs CF account + real D1 id |
| `packages/anchor-backends` | NullAdapter + BaseAdapter (viem) | NullAdapter used by `apps/anchor` cron; BaseAdapter still stub | Wire viem + secrets before `ANCHOR_BACKEND=base` |
| PDQ-256 | `pdq-wasm` **0.3.9** | `@ozdna/dna-core` wrapper (`pdq.ts`) loads CJS entry via `createRequire` (ESM factory gap in 0.3.9) | Browser path: `initPdqBrowser({ wasmUrl })` |
| Golden images / EXIF step-0 | ≥5 fixtures; Orient=6 MUST; near-flat SHOULD; cross-decoder d≤2 | Node path: jpeg-js/pngjs + `orient.ts`/`exif.ts`; corpus in `test/fixtures/golden/` | Wire `@cf-wasm/photon` in Workers and assert d≤2 vs locked hashes |

**Invariant that already holds:** one `packages/dna-core` implementation for browser + Workers; do not fork the math.
