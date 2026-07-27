# app/ toolchain — corpus vs foundation (explicit divergences)

Canonical pins: `../plan/09-DEV-SETUP.md` §2 / `../plan/02-TECH-STACK.md`.
This file exists so silent scoping does **not** happen again (session ledger A5/A6).

| Item | Corpus mandate | What landed in foundation | When to reconcile |
|---|---|---|---|
| TypeScript | **6.0.3** (strict + `noUncheckedIndexedAccess`) | Pinned to `6.0.3` in root `package.json` (was briefly `^7.0.2` by auto-bump — corrected) | Done |
| Vitest runtime | Vitest **4.1.10** + `@cloudflare/vitest-pool-workers` **0.18.0** (tests inside **workerd**) | Root Vitest = packages + health/OpenAPI in node; `npm run test:workers` = api D1 waitlist via pool-workers + local migrations | Done (local D1; production deploy still needs CF account) |
| D1 schema authoring | drizzle-kit generates `migrations/*.sql` from `apps/api/src/db/schema.ts` | `drizzle-orm` **0.45.2** + `drizzle-kit` **0.31.10** on `@ozdna/api`; schema covers full `0001_init.sql` (users, api_keys, records, anchor_batches, usage_events, waitlist). Applied migration remains `migrations/0001_init.sql`. `npm run db:generate` writes to `apps/api/drizzle/` for **diff checks only** — do not overwrite 0001 casually | Done (kit output is staging; wrangler still applies `migrations/`) |
| Biome / Foundry / wrangler | pinned in plan/09 | **Biome 2.5.2** + `npm run check` (typecheck + lint + vitest); `foundry.toml` + forge in CI; wrangler.jsonc for api/anchor | Done — CI: `.github/workflows/ci.yml` |
| `packages/anchor-backends` | NullAdapter + BaseAdapter (viem) | NullAdapter + **BaseAdapter** (`viem` **2.54.6**); `apps/anchor` selects BaseAdapter when `ANCHOR_BACKEND=base` and RPC/key/contract Secrets are set | Done (live Base tx still needs provisioned Secrets + deployed contract) |
| Dev signing certs | Self-signed ES256 / P-256 for local C2PA (plan/02 §1) | `npm run certs:dev` → `scripts/gen-dev-signing-cert.mjs` writes PEMs under `certs/dev/` (gitignored) | Done for local/dev; production/conformance certs remain founder/ops |
| PDQ-256 | `pdq-wasm` **0.3.9** + vendored `app/vendor/pdq-wasm/` | Pure distance/encoding in `@ozdna/dna-core` (`pdq.ts`); Node hash via `@ozdna/dna-core/pdq-node` (`createRequire`). Spike: `app/docs/pdq-spike-2026-07-27.md` | Browser/Workers: explicit `wasmUrl` / `wasmBinary` from vendor — never rely on ESM auto-loader |
| Golden images / EXIF step-0 | ≥5 fixtures; Orient=6 MUST; near-flat SHOULD; cross-decoder d≤2 | **Done** — Node jpeg-js/pngjs + Workers `@cf-wasm/photon@0.3.6`; both locked in `expected-hashes.json`; tests assert d≤2 | — |
| BaseAdapter | viem + OzDnaAnchor | **Done** — live writeContract when secrets present | Production needs CF secrets + deployed contract |
| drizzle | kit generate from schema | **Done** — `db:generate` → `apps/api/drizzle/` staging; `0001_init.sql` remains applied migration | — |
| Dev signing certs | local P-256 | **Done** — `npm run certs:dev` | — |

**Invariant that already holds:** one `packages/dna-core` implementation for browser + Workers; do not fork the math.
