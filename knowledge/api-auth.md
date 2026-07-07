---
title: API Kimlik Doğrulama
tags: [api, auth, security]
related: [api-overview.md, integration.md]
---

# Kimlik Doğrulama

Tüm isteklerde `Authorization` header zorunludur:

```
Authorization: Bearer ozdna_sk_live_...
```

## Anahtar türleri

| Önek | Ortam |
|------|-------|
| `ozdna_sk_test_` | Sandbox |
| `ozdna_sk_live_` | Production |

Anahtarlar dashboard üzerinden proje kapsamında oluşturulur. SDK gerekmez.

## Webhook imza doğrulama

Asenkron callback'lerde `X-OzDNA-Signature` header — HMAC-SHA256.
