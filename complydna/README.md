# ComplyDNA

> **Orientation:** see the root **[README.md](../README.md#complydna)** — single source of truth for all ozDNA products.

Türk mevzuatına özel cite-first RAG backend — this directory.

## Quick start (yerel, Docker gerekmez)

```bash
make setup
make bootstrap          # ingest + index → data/qdrant/
make serve              # http://localhost:8000/demo/
make eval               # offline golden-set
```

Ham mevzuat metinlerini `data/raw/` altına koy (.txt / .md), sonra `make bootstrap`.

## On-prem kurulum

ComplyDNA kurum ağı içinde çalışacak şekilde tasarlandı: sorular, yanıtlar ve vektör indeksi varsayılan olarak **yerel diskte** kalır; harici SaaS LLM veya bulut vektör DB zorunlu değildir.

### Gereksinimler

- Python 3.11+
- ~2 GB disk (embedding modeli `BAAI/bge-m3` ilk çalıştırmada Hugging Face cache’e indirilir — **tek seferlik**, inference yerelde)
- Docker **isteğe bağlı** (kurumsal Qdrant sunucusu veya compose stack)

### Yol A — Yerel dosya modu (önerilen dev / pilot)

```bash
cp .env.example .env    # QDRANT_PATH=data/qdrant (varsayılan)
make setup
make bootstrap
make serve
```

| Adım | Komut | Çıktı |
|------|--------|--------|
| Parse | `make ingest` | `data/parsed/*.jsonl` |
| Index | `make index` | `data/qdrant/` (embedded Qdrant) |
| API + UI | `make serve` | `:8000` · `/demo/` |
| Eval | `make eval` / `make eval-live` | `evals/results/` |

### Yol B — Docker Compose (api + qdrant + UI)

UI, API container içinde `/demo/` olarak sunulur (ayrı UI servisi yok).

```bash
make docker-bootstrap   # up + ingest + index
# Demo: http://localhost:8000/demo/
make down               # kapat
```

`.env` içinde `QDRANT_PATH=` boş bırakın; compose `QDRANT_URL=http://qdrant:6333` kullanır.

### Veri haritası

| Konum | İçerik | Dışarı çıkar mı? |
|-------|--------|------------------|
| `data/raw/` | Ham mevzuat (.txt / .md) — örnek: MASAK + KVKK | Hayır — sizin disk |
| `data/parsed/` | Madde/fıkra JSONL (`TEBLIG-MASAK-SAMPLE`, `LAW-KVKK`, `LAW-5549`, `LAW-6415`) | Hayır |
| `data/qdrant/` | Vektör indeks (yerel mod) | Hayır |
| Audit log | Soru/yanıt **SHA-256 hash** (düz metin değil) | Hayır |
| `~/.cache/huggingface/` | bge-m3 model ağırlıkları (ilk indirme) | İndirme dışarı; inference yerel |

**Mimari:** Retrieval + cite-first post-check tamamen yerelde. Varsayılan LLM `dev-stub-v1` harici API çağırmaz.

### On-prem LLM (Ollama / vLLM)

OpenAI-compatible endpoint bağlamak için `.env`:

```bash
LLM_PROVIDER=openai
LLM_BASE_URL=http://localhost:11434/v1
LLM_MODEL=llama3.2
MODEL_VERSION=ollama-llama3.2
```

Ollama örneği: `ollama pull llama3.2 && ollama serve` — cite-first post-check yanıtı reddederse otomatik retry uygulanır.

### Pilot demo (müşteri sunumu)

**Terminal 1 — sunucu:**
```bash
make bootstrap && make serve
```

**Terminal 2 — smoke script (8 soru, MASAK/KVKK/5549/6415):**
```bash
make pilot
# veya: python3 scripts/pilot_demo.py --limit 3
```

**Prod LLM ile pilot eval (Ollama açıkken, API kapalı):**
```bash
# .env → LLM_PROVIDER=openai, LLM_BASE_URL=http://localhost:11434/v1
make eval-pilot-live
```

| Komut | Açıklama |
|-------|----------|
| `make pilot` | `/health` + 8 curated soru → terminal çıktısı |
| `make eval-pilot` | `evals/pilot_set.jsonl` offline regression |
| `make eval-pilot-live` | pilot set + yerel Qdrant + `.env` LLM |

Tam mevzuat genişletme: `data/raw/` altına yeni `.txt` dosyaları ekleyip `make bootstrap` — kaynak kodu dosya adından veya frontmatter `kaynak_kodu` alanından gelir.

### Pilot demo checklist

1. `make setup && make bootstrap && make serve`
2. http://localhost:8000/demo/ — MASAK + KVKK + 5549 + 6415 örnek sorular
3. `curl /health` — `git_sha`, `index_version`, `model_version`
4. `make eval-live` — golden set regression (API kapalıyken)
5. Kurum ağı: outbound yalnızca HF model cache (ilk index) veya tamamen air-gapped mirror

Prod’da kendi on-prem LLM endpoint’inizi `LLM_*` ile bağlayın — yalnızca seçtiğiniz adrese gider.

### Sürümleme

```bash
curl -s http://localhost:8000/health | python3 -m json.tool
```

```json
{
  "status": "ok",
  "service": "ComplyDNA",
  "index_version": "v1",
  "model_version": "dev-stub-v1",
  "git_sha": "abc1234"
}
```

### Make hedefleri

```bash
make help             # tüm komutlar
make test             # pytest -m "not integration"
make eval-live        # indexed Qdrant + bge-m3
make logs             # docker compose logs
```

API anahtarı: `X-API-Key` header (varsayılan `complydna_sk_test_local` — prod’da `.env` ile değiştirin).

## Deep docs

- **[docs/products/COMPLYDNA-CURSOR-PLAN.md](../docs/products/COMPLYDNA-CURSOR-PLAN.md)** — phased dev plan
- **[docs/products/COMPLYDNA.md](../docs/products/COMPLYDNA.md)** — product card
- **[`.cursor/rules/complydna.mdc`](../.cursor/rules/complydna.mdc)** — Cursor rules
