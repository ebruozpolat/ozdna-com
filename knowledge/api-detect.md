---
title: Detect API
tags: [api, detect, ai-detection]
related: [api-auth.md, vertical-modes.md]
endpoint: POST /v1/detect
---

# POST /v1/detect

Segment düzeyinde AI dedeksiyonu. Dikeye özel kalibrasyon.

## İstek

```json
{
  "text": "Bu çalışmada uygulanan metodoloji...",
  "mode": "academic",
  "language": "tr",
  "webhook_url": "https://example.com/hook"
}
```

| Alan | Zorunlu | Tip | Açıklama |
|------|---------|-----|----------|
| text | evet | string | Analiz metni (max 50.000 karakter) |
| mode | hayır | string | academic · legal · financial · general |
| language | hayır | string | ISO 639-1 (tr, en, …) |
| webhook_url | hayır | string | Asenkron callback (Growth+) |

## Yanıt (örnek)

```json
{
  "ai_probability": 0.94,
  "confidence": "high",
  "verdict": "ai_generated",
  "segments": 12,
  "segment_map": [
    { "start": 0, "end": 142, "score": 0.97 }
  ],
  "processing_ms": 210,
  "mode": "academic",
  "language": "tr"
}
```

## Özellikler

- Segment düzeyinde ısı haritası
- Türkçe ve çok dilli destek
- Webhook callback (async)

→ [vertical-modes.md](./vertical-modes.md) · [api-auth.md](./api-auth.md)
