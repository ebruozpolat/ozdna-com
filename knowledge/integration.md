---
title: Entegrasyon
tags: [integration, onboarding, developer]
related: [api-overview.md, api-auth.md, contact.md]
---

# Entegrasyon Akışı

Kayıttan production'a dakikalar içinde.

## 1 — Auth

Dashboard'dan proje oluştur, scoped API anahtarı al. Bearer token.

## 2 — POST

`/v1/detect` veya `/v1/humanize` ile ilk istek. JSON in, JSON out.

```bash
curl -X POST https://api.ozdna.com/v1/detect \
  -H "Authorization: Bearer ozdna_sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"text":"...","mode":"academic","language":"tr"}'
```

## 3 — Scale

Dashboard'dan kullanım, maliyet ve doğruluk metrikleri. Hacim eşiklerinde otomatik indirim.

## Hata kodları

| Kod | Anlam |
|-----|-------|
| 400 | Geçersiz istek |
| 401 | Geçersiz API anahtarı |
| 402 | Kota aşıldı |
| 429 | Rate limit |
| 503 | Geçici kesinti |

→ [contact.md](./contact.md) — API erişimi davet usulü
