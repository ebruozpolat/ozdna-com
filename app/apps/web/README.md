# @ozdna/web — OriginDNA verify SPA

Vite + `@contentauth/c2pa-web@0.13.0` (Wasm). **Hard rule 5:** UI never claims official Content Credentials trust-list status.

## Commands

```bash
cd app
npm install
npm run dev -w @ozdna/web      # http://127.0.0.1:5173
npm run build -w @ozdna/web    # → apps/web/dist
```

## What this closes

Ledger polish item: real C2PA cryptographic read path (vs marketing `/verify/` presence-scan). Marketing page stays light; this SPA is the deep-verify surface until Netlify hosts `dist/` (or Cloudflare Pages later).

## Next

- Optional Netlify publish of `apps/web/dist` under `/app/verify/`
- Sign flow (`builder` + `/v1/sign-digest`) after Workers deploy
