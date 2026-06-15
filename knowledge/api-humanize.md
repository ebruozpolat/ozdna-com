---
title: Humanize API
tags: [api, humanizer, text-transformation]
related: [api-auth.md, vertical-modes.md]
endpoint: POST /v1/humanize
---

# POST /v1/humanize

AI üretimi metni doğal, dedektör dirençli prose'ye dönüştürür.

## İstek

```json
{
  "text": "The methodology applied in this study...",
  "mode": "academic",
  "language": "tr",
  "intensity": "medium",
  "preserve_terms": ["KVKK", "BDDK"]
}
```

| Alan | Zorunlu | Tip | Açıklama |
|------|---------|-----|----------|
| text | evet | string | Humanize edilecek metin |
| mode | hayır | string | Dikey mod |
| language | hayır | string | ISO 639-1 |
| intensity | hayır | string | light · medium · strong |
| preserve_terms | hayır | string[] | Değiştirilmeyecek terimler |

## Yanıt (örnek)

```json
{
  "text": "Bu araştırmada izlenen yöntem...",
  "ai_probability_before": 0.91,
  "ai_probability_after": 0.18,
  "processing_ms": 6200,
  "intensity": "medium"
}
```

**Not:** Gecikme metin uzunluğuna bağlıdır. Beta ortalama süreleri toplanmaktadır.

→ [vertical-modes.md](./vertical-modes.md)
