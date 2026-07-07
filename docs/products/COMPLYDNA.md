# ComplyDNA

**RegTech uyum LLM** · under the [ozDNA](https://ozdna.com) umbrella

| | |
|---|---|
| **Product** | ComplyDNA |
| **Focus** | Türk mevzuatı (MASAK, 5549, 6415, KVKK, ROM Yönetmeliği) — kaynak künyeli yanıt |
| **Status** | Q3 2026 — geliştirme planı hazır |
| **Marketing** | [`products/comply/`](../../products/comply/) · https://ozdna.com/products/comply/ |
| **Backend (planned)** | `complydna/` — Python 3.11, FastAPI, Qdrant, bge-m3 RAG |
| **Cursor plan** | [`COMPLYDNA-CURSOR-PLAN.md`](./COMPLYDNA-CURSOR-PLAN.md) |
| **Linear** | [ComplyDNA — RAG Backend](https://linear.app/georiskengine/project/complydna-rag-backend-44edb8fab13c) · Epic [OZD-39](https://linear.app/georiskengine/issue/OZD-39) |
| **Cursor rule** | [`.cursor/rules/complydna.mdc`](../../.cursor/rules/complydna.mdc) |

---

## Özet

ComplyDNA, uyum ekiplerine mevzuat sorularında **her cümlede madde künyesi** taşıyan yanıtlar üretir. Künyesiz iddia kabul edilmez; müşteri verisi eğitim/log setine yazılmaz.

Geliştirme 5 faz / 10 prompt ile tanımlı (iskelet → ingest → RAG → eval → demo UI). LoRA ince ayar bilinçli olarak sonraya bırakıldı.

---

## ozDNA portföyünde yeri

| Product | Focus |
|---------|--------|
| ozDNA Platform | LLM gateway, routing, RAG, cost |
| **ComplyDNA** | Türk RegTech uyum LLM |
| [OriginDNA](./ORIGINDNA.md) | İçerik kökeni / EU AI Act marking |

---

*Son güncelleme: 7 Temmuz 2026*
