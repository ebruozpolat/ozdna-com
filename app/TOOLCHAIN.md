# app/ toolchain — corpus vs foundation (explicit divergences)

Canonical pins: `../plan/09-DEV-SETUP.md` §2 / `../plan/02-TECH-STACK.md`.
This file exists so silent scoping does **not** happen again (session ledger A5/A6).

| Item | Corpus mandate | What landed in foundation | When to reconcile |
|---|---|---|---|
| TypeScript | **6.0.3** (strict + `noUncheckedIndexedAccess`) | Pinned to `6.0.3` in root `package.json` (was briefly `^7.0.2` by auto-bump — corrected) | Done |
| Vitest runtime | Vitest **4.1.10** + `@cloudflare/vitest-pool-workers` **0.18.0** (tests inside **workerd**) | Plain-node Vitest only — `dna-core` is pure TS with no Workers bindings yet | When `apps/api` or `apps/anchor` land and need D1/R2/KV; add pool-workers then |
| D1 schema authoring | drizzle-kit generates `migrations/*.sql` from `apps/api/src/db/schema.ts` | Raw `migrations/0001_init.sql` committed (allowed by plan/09 §4 ASSUMPTION — columns owned by `04` §5) | Stub drizzle schema at `apps/api/src/db/schema.ts`; `db:generate` deferred until wrangler + apps exist |
| Biome / Foundry / wrangler | pinned in plan/09 | Not installed in this foundation batch | With apps/ + contracts/ |

**Invariant that already holds:** one `packages/dna-core` implementation for browser + Workers; do not fork the math.
