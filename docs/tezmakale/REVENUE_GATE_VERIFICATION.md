# Gelir Kapısı Doğrulama Sonucu

**Tarih:** 2026-07-08  
**Ortam:** local `@ozdna/api` + `@ozdna/tezmakale`  
**Canlı referans:** [CANLI_SITE_REFERANSI.md](./CANLI_SITE_REFERANSI.md)

## Otomatik smoke test

```bash
cd platform
npm run db:push && npm run db:seed
TEZMAKALE_OZDNA_API_KEY=<seed output> npm run dev
node ../scripts/verify-revenue-gate.mjs http://127.0.0.1:8787
```

**Sonuç:** 7/7 checks passed (local)

- Register / login / dashboard / subscription (AI Dedektör + Parafraz labels)
- Deep detect → OzDNA `/v1/detect` (200)
- Parafraz limit enforcement on free plan (403)

## Production checklist (manuel)

[GELIR_KAPISI_CHECKLIST.md](./GELIR_KAPISI_CHECKLIST.md) maddelerinin production ortamında tamamlanması gerekir:

- Lemon Squeezy production webhook + gerçek PRO/Akademik/MAX satışı
- tezmakale.com frontend → `/tezmakale/*` API bağlantısı (Yusuf repo)
- Canlı URL’ler: `/ai-detector/`, `/pricing/`, `/app/dashboard/`
- İlk ücretli müşteri

## Yusuf entegrasyon notu

TezMakale consumer app, ozdna API'deki `/tezmakale/*` uçlarına `Authorization: Bearer tm_sess_...` ile bağlanır. Checkout URL'leri `GET /tezmakale/subscription` → `checkout` alanından alınır. Ürün adları: **Parafraz** (API: `paraphrase`), **AI Dedektör**, **Detaylı Rapor**.
