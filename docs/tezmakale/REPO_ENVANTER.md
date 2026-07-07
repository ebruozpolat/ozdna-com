# TezMakale — Repo Envanter (Hafta 0)

**Tarih:** Temmuz 2026  
**Teknik:** Yusuf Oskay  
**Canlı referans:** [CANLI_SITE_REFERANSI.md](./CANLI_SITE_REFERANSI.md)

Tüketici uygulama kodu ayrı repo/hosting’de (tezmakale.com Astro); bu doküman ozdna entegrasyon katmanını listeler.

## ozdna repo (bu entegrasyon)

| Bileşen | Konum | Durum |
|---------|-------|-------|
| OzDNA Platform API | `platform/apps/api/` | v0.1 — `/v1/detect`, chat, quota |
| TezMakale B2C API | `platform/packages/tezmakale/` | Gelir kapısı modülü |
| TezMakale routes | `POST /tezmakale/*` | Auth, dashboard, detect, paraphrase, reports |
| Lemon Squeezy webhook | `POST /tezmakale/webhooks/lemon-squeezy` | PRO / Akademik / MAX + rapor |
| Case study | `case-studies/tezmakale/` | ozdna.com marketing |

## Canlı site (tezmakale.com)

| Alan | Değer |
|------|-------|
| Dedektör | `/ai-detector/` — OZDNA DT 5.0, ücretsiz |
| Fiyatlar | `/pricing/` — token tabanlı planlar |
| Rapor | `/rapor/` — tek seferlik $4.99+ |
| Panel | `/app/dashboard/` |
| Auth | `/app/login/`, `/app/register/` |
| Ödeme | Lemon Squeezy (`tezmakale.lemonsqueezy.com`) |

## Ortam değişkenleri

```bash
TEZMAKALE_SESSION_SECRET=          # min 32 chars
LEMONSQUEEZY_WEBHOOK_SECRET=
LEMONSQUEEZY_STORE_ID=
LEMONSQUEEZY_PRO_VARIANT_ID=
LEMONSQUEEZY_ACADEMIC_VARIANT_ID=
LEMONSQUEEZY_MAX_VARIANT_ID=
LEMONSQUEEZY_REPORT_VARIANT_ID=
TEZMAKALE_OZDNA_API_KEY=
OZDNA_API_BASE_URL=http://localhost:8787
OZDNA_DB_PATH=platform/data/ozdna.db
OPENAI_API_KEY=
```

## API uçları (TezMakale backend — ozdna)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/tezmakale/auth/register` | Kayıt |
| POST | `/tezmakale/auth/login` | Giriş → session token |
| POST | `/tezmakale/auth/logout` | Oturum kapat |
| GET | `/tezmakale/dashboard` | Panel özeti |
| GET | `/tezmakale/subscription` | Plan + limitler |
| POST | `/tezmakale/detect/deep` | Sunucu dedektör (limit enforced) |
| POST | `/tezmakale/paraphrase` | Parafraz (PRO+); alias `/humanize` |
| GET | `/tezmakale/reports/:id` | Rapor durumu |
| POST | `/tezmakale/webhooks/lemon-squeezy` | Ödeme webhook |

## Lemon Squeezy test modu

1. Dashboard → Test mode ON
2. Webhook: `https://<api-host>/tezmakale/webhooks/lemon-squeezy`
3. Events: `subscription_*`, `order_created`
4. Variant ID’ler canlı checkout URL’leri ile eşleşmeli (bkz. `/pricing/` data-checkout-url)
