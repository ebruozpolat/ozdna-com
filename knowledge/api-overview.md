---
title: API Genel Bakış
tags: [api, rest, openapi]
related: [api-detect.md, api-humanize.md, api-auth.md, integration.md]
---

# ozDNA REST API

JSON istek/yanıt, Bearer token kimlik doğrulama, OpenAPI 3.1 uyumlu sözleşme.

## Base URL

```
https://api.ozdna.com          # production (beta)
https://api.sandbox.ozdna.com  # sandbox
```

## Çekirdek endpoint'ler

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/v1/detect` | AI metin dedeksiyonu |
| POST | `/v1/humanize` | Metin humanizasyonu |
| POST | `/v1/batch` | Toplu asenkron işlem (Growth+) |

## OpenAPI

```
https://api.ozdna.com/openapi.json
https://api.ozdna.com/openapi.yaml
```

Phase 2 önizleme — tam spec beta erişimi ile yayınlanacak.

→ [api-detect.md](./api-detect.md) · [api-humanize.md](./api-humanize.md) · [api-auth.md](./api-auth.md)
