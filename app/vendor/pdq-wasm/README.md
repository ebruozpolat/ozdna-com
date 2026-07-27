# Vendored: `pdq-wasm` (Meta PDQ, WebAssembly)

Meta's reference **PDQ** perceptual hash, compiled to WebAssembly. This is the SECONDARY
(confirmation/scoring) fingerprint — see `plan/03-ALGORITHMS.md` §1.4/§1.5 and the shared
distance/encoding code in `packages/dna-core/src/pdq.ts`.

## Why vendored (not an npm dependency)

`plan/03-ALGORITHMS.md` §1.4 flags `pdq-wasm` as **single-maintainer, no release since
Nov 2025**, and hard rule 7/8 keep us off CDNs and off build-time surprises. So we commit the
**prebuilt WASM binary + its Emscripten glue** here and load it as a local static asset.
BSD-3-Clause permits redistribution; see `LICENSE`.

## Provenance & integrity

| | |
|---|---|
| Package | `pdq-wasm` |
| Version | **0.3.9** (published 2025-11-08) |
| Source | https://github.com/Raudbjorn/pdq-wasm (npm: `svnbjrn`) |
| Upstream algorithm | Meta ThreatExchange PDQ — https://github.com/facebook/ThreatExchange/tree/main/pdq |
| License | BSD-3-Clause (`LICENSE`) |
| Vendored | 2026-07-27, from a clean `npm install pdq-wasm@0.3.9` |

SHA-256 (verify after any re-vendor):

```
614f2b8bc606615ad6dc1dde1c8bd9855818a5d95a9391654e035c0e00137113  wasm/pdq.wasm
90af8bedbecf10ade0b0e350f73be824df291a896316fe5ecc54794f4aecd693  wasm/pdq.js
```

## Files

- `wasm/pdq.wasm` — the compiled PDQ module (25.9 KB).
- `wasm/pdq.js` — Emscripten factory glue (`createPDQModule`).
- `LICENSE` — BSD-3-Clause.

The TypeScript API (`PDQ.hash`, `hammingDistance`, `toHex`, …) is NOT vendored — apps add
`pdq-wasm@0.3.9` as a normal dependency for the typed wrapper, but point its loader at THIS
`wasm/pdq.wasm` instead of the package default / CDN. Rationale and the loader gotchas are in
`app/docs/pdq-spike-2026-07-27.md`.
