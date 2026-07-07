# @ozdna/tezmakale

TezMakale B2C gelir kapısı — auth, ürün limitleri, Lemon Squeezy webhook, OzDNA GPT entegrasyonu.

Canlı site referansı: [CANLI_SITE_REFERANSI.md](../../docs/tezmakale/CANLI_SITE_REFERANSI.md)

## API routes (mounted on `@ozdna/api`)

| Route | Açıklama |
|-------|----------|
| `POST /tezmakale/auth/register` | Kayıt |
| `POST /tezmakale/auth/login` | Oturum token |
| `GET /tezmakale/dashboard` | Panel özeti (Parafraz dahil) |
| `GET /tezmakale/subscription` | Plan + limitler + checkout config |
| `POST /tezmakale/detect/deep` | Sunucu dedektör → `/v1/detect` (OZDNA DT 5.0) |
| `POST /tezmakale/paraphrase` | Parafraz → `/v1/chat` (OZDNA HUMAN 1.0); alias: `/humanize` |
| `GET /tezmakale/reports/:id` | Rapor durumu |
| `POST /tezmakale/webhooks/lemon-squeezy` | Ödeme webhook |

## Kurulum

```bash
cd platform
cp .env.example .env
npm install
npm run db:push && npm run db:seed   # API key çıktısını TEZMAKALE_OZDNA_API_KEY olarak .env'e yaz
npm run dev
```

## Doğrulama

```bash
node ../scripts/verify-revenue-gate.mjs http://localhost:8787
npm run test -w @ozdna/tezmakale
```

## Plan limitleri (tezmakale.com/pricing ile uyumlu)

| Plan | AI Dedektör | Parafraz |
|------|-------------|----------|
| Ücretsiz | 40.000 token/ay, max 1.000 kelime | — |
| PRO | 80.000 token/gün, max 2.000 kelime | 40.000 token/gün (EN) |
| Akademik | 400.000 token/gün, max 4.000 kelime | 200.000 token/gün |
| MAX | Sınırsız, max 8.000 kelime | 1.000.000 token/gün |

## Dokümantasyon

- [CANLI_SITE_REFERANSI.md](../../docs/tezmakale/CANLI_SITE_REFERANSI.md)
- [GELIR_KAPISI_CHECKLIST.md](../../docs/tezmakale/GELIR_KAPISI_CHECKLIST.md)
- [ANLATI_TASLAK.md](../../docs/tezmakale/ANLATI_TASLAK.md)
