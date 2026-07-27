# @ozdna/web — OriginDNA verify SPA

Vite + `@contentauth/c2pa-web@0.13.0` (Wasm). **Hard rule 5:** UI never claims official Content Credentials trust-list status.

## Commands

```bash
cd app
npm install
npm run dev -w @ozdna/web      # http://127.0.0.1:5173
npm run build -w @ozdna/web    # → repo-root deep-verify/
```

## Publish

Built assets go to repo-root `deep-verify/`. Netlify rewrites `https://ozdna.com/app/verify/*` → `/deep-verify/:splat`. Other `/app/*` paths return 404 so the monorepo tree is not exposed.

## What this closes

Real C2PA cryptographic read path (vs marketing `/verify/` presence-scan). Marketing page stays light; this SPA is the deep-verify surface.

## Next

- Sign flow (`builder` + `/v1/sign-digest`) in the SPA
- Optional Cloudflare Pages mirror later
