# `@ozdna/web`

OriginDNA **sign / verify** SPA package (content-provenance line).

## Status

Minimal scaffold. Full **Astro** + `@contentauth/c2pa-web` client lands here later.
For now: `package.json`, a static stub page, and a browser verify helper.

## Planned routes

| Route | Purpose |
|-------|---------|
| `/sign` | In-browser C2PA signing via WASM (`@contentauth/c2pa-web`) — FREE flow |
| `/verify` | Manifest inspection + chain-anchor / registry UI |

Public marketing verify today lives at site-root `/verify/` (static). This package is the metered SPA that will own sign + deep verify once wired.

## Browser-only: `@contentauth/c2pa-web`

The SDK is **browser / Wasm** (Web Worker). It does **not** run in Node.

`src/c2pa-verify.ts` exports:

```ts
async function verifyC2pa(
  file: File | ArrayBuffer,
  options: { wasmSrc: string; mimeType?: string },
): Promise<unknown>
```

Wire `wasmSrc` from a bundler (Vite):

```ts
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import { verifyC2pa } from './c2pa-verify.ts';

const store = await verifyC2pa(file, { wasmSrc });
```

Or use `@contentauth/c2pa-web/inline` when a separate Wasm fetch is inconvenient (larger JS bundle).

## Layout

```
apps/web/
  package.json          # @ozdna/web, private, type:module
  README.md
  tsconfig.json
  src/
    index.html          # stub documenting /sign + /verify
    c2pa-verify.ts      # verifyC2pa() browser helper
```

Workspace: already covered by `app/package.json` → `"apps/*"`.
