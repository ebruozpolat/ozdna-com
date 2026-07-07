# ComplyDNA — Cursor Geliştirme Planı

ComplyDNA, Türk mevzuatına (MASAK, 5549, 6415, KVKK, ROM Yönetmeliği) özel,
kaynak künyeli yanıt üreten bir uyum LLM ürünüdür. Bu doküman, ürünü Cursor ile
faz faz geliştirmek için hazırlanmış kural setini ve görev prompt'larını içerir.

**Kullanım:** Önce Cursor Rules'u projeye kaydet (`.cursor/rules/complydna.mdc` — kayıtlı), sonra prompt'ları sırayla ver.
Her prompt tek bir iş yapar ve kabul kriteriyle biter — bir görevi bitirip
testleri yeşil görmeden sonrakine geçme. Cursor bir görevi yarım bırakırsa
"kabul kriterini karşılamadın, testi yaz ve geçir" de.

**Kod dizini:** `complydna/` (repo kökünde, `platform/` ile kardeş)

---

## 0) Cursor Rules

Kayıtlı: [`.cursor/rules/complydna.mdc`](../../.cursor/rules/complydna.mdc)

---

## Faz 1 — İskelet ve veri modeli

### Prompt 1 — proje iskeleti

```
Yeni bir Python projesi kur: complydna/
- FastAPI app (app/main.py), pydantic-settings ile config (app/config.py)
- docker-compose.yml: api + qdrant servisleri
- pyproject.toml (uv uyumlu), ruff + pytest ayarlı
- GET /health endpoint'i
Kabul kriteri: docker compose up sonrası curl localhost:8000/health 200 dönmeli, pytest yeşil.
```

### Prompt 2 — mevzuat veri modeli

```
app/models/legislation.py oluştur. Pydantic modelleri:
- Article: kaynak_kodu, kaynak_adı, madde_no, fıkra_no (ops.), metin,
  yürürlük_durumu (aktif/mülga/değişik), yürürlük_tarihi, sürüm_etiketi
- Chunk: article referansı + chunk_id + metin parçası + karakter aralığı
Citation string üretimi tek yerde: Article.citation() -> "[LAW-5549 / Madde 4]"
Kabul kriteri: model doğrulama testleri + citation format testi geçmeli.
```

---

## Faz 2 — Korpus ingest (SEQ 01–02)

### Prompt 3 — madde düzeyinde parser

```
scripts/ingest.py yaz: data/raw/ altındaki mevzuat metinlerini (düz .txt/.md,
"MADDE 4 –" başlık deseni) madde ve fıkra düzeyinde parçalayan parser.
- Regex tabanlı madde/fıkra tespiti; başlık, geçici madde, mülga madde durumlarını yakala
- Çıktı: data/parsed/{kaynak_kodu}.jsonl (Article kayıtları)
- Parse edilemeyen bloklar data/parsed/_errors.jsonl'a düşsün, sessizce atlanmasın
Kabul kriteri: örnek bir tebliğ metniyle golden parse testi (fixtures/) geçmeli.
```

### Prompt 4 — Qdrant indeksleme

```
app/services/indexer.py yaz: parsed JSONL'leri okuyup bge-m3 embedding'iyle
Qdrant'a yazan servis.
- Collection: "mevzuat_v1"; payload = tüm Article metadata'sı
- Idempotent: aynı chunk_id tekrar yazılınca duplicate oluşmamalı (upsert)
- CLI: python -m app.services.indexer --source data/parsed/
Kabul kriteri: indeksleme sonrası "şüpheli işlem bildirim süresi" sorgusu
top-5'te ilgili tedbirler yönetmeliği maddesini döndürmeli (integration test).
```

---

## Faz 3 — Retrieval + kaynak künyeli yanıt (SEQ 04)

### Prompt 5 — retrieval servisi

```
app/services/retriever.py yaz:
- search(query, top_k=8, filters=None) -> list[ScoredChunk]
- Filtre desteği: kaynak_kodu, yürürlük_durumu, tarih ("bu tarihte yürürlükte olan")
- Türkçe ve İngilizce sorgu ikisi de çalışmalı (bge-m3 çok dilli)
Kabul kriteri: filtreli/filtresiz arama testleri; mülga madde default'ta dönmemeli.
```

### Prompt 6 — cite-first yanıt üretimi

```
app/services/answerer.py yaz: RAG yanıt katmanı.
- Girdi: soru. Akış: retrieve -> LLM'e context + katı system prompt -> yanıt
- System prompt kuralı: her cümle [KAYNAK_KODU / Madde X] künyesi taşır;
  context'te dayanağı olmayan iddia yasak; emin değilse
  "mevzuatta açık hüküm bulamadım" der
- Çıktı şeması (pydantic): answer_text, citations[] (kaynak, madde, yürürlük),
  retrieval_snapshot
- Post-check: yanıttaki her künye regex ile ayıklanır, retrieval sonuçlarıyla
  eşleşmeyen künye varsa yanıt reddedilip bir kez yeniden üretilir
Kabul kriteri: künyesiz cümle içeren mock LLM yanıtının post-check'e
takıldığını gösteren test.
```

### Prompt 7 — API endpoint

```
POST /v1/ask endpoint'i ekle: {question, filters?} -> AnswerResponse
(answer, citations, sources, model_version, index_version).
- API key auth (X-API-Key header, .env'den)
- Rate limit (basit, in-memory)
- Soru/yanıt audit log'u: sadece hash + timestamp + sürüm bilgisi (metin loglanmaz)
Kabul kriteri: auth'suz istek 401; örnek soru uçtan uca kaynaklı yanıt dönmeli.
```

---

## Faz 4 — Golden set değerlendirme

### Prompt 8 — eval harness

```
evals/ dizini kur:
- evals/golden_set.jsonl: {question, expected_citations[], notes} şeması
  (10 örnek soruyla başla, MASAK/KVKK karışık)
- evals/run.py: her soru için pipeline'ı çalıştırır; metrikler:
  citation_precision, citation_recall, retrieval_hit@5
- Sonuç evals/results/{tarih}_{git_sha}.json olarak versiyonlanır;
  önceki koşuya göre gerileme varsa exit code 1
Kabul kriteri: python evals/run.py çalışıp rapor üretmeli;
CI'da (GitHub Actions) her PR'da koşmalı.
```

---

## Faz 5 — Demo UI + paketleme

### Prompt 9 — demo arayüzü

```
Basit bir demo chat UI ekle (web/ altında, tek sayfa, framework'süz veya
Vite+vanilla):
- Soru kutusu, yanıt alanı; künyeler ([TEBLİĞ / Madde 28]) tıklanabilir chip
  olarak render edilir, tıklayınca ilgili madde metni yan panelde açılır
- Landing page'deki (ozdna.com/complydna) terminal estetiğini kullan:
  koyu zemin, mono font, turuncu vurgu (#FF6B3D)
- "kaynak modu: açık" başlığı ve KAYNAKLAR bloğu landing'deki örnek çıktıyla
  aynı formatta
Kabul kriteri: docker compose up ile localhost'ta uçtan uca
soru-cevap-kaynak akışı çalışmalı.
```

### Prompt 10 — on-prem paketi

```
Dağıtım paketini hazırla:
- Tek komut kurulum: docker compose (api, qdrant, ui) + make ingest + make eval hedefleri
- README: kurum içi kurulum adımları, hangi verinin nerede durduğu,
  hiçbir verinin dışarı gitmediğinin mimari açıklaması
- Sürümleme: model_version + index_version + git sha'yı /health çıktısına ekle
Kabul kriteri: temiz bir makinede README takip edilerek demo ayağa kalkabilmeli.
```

---

## Notlar

- **LoRA ince ayar** (landing'deki SEQ 03) bilinçli olarak planda yok: önce
  RAG + post-check ile ürünü ayağa kaldır, golden set metrikleri oturunca ince
  ayarı ayrı bir faz olarak ekle — eğitim verisi zaten Faz 2–4'ün çıktısından
  üretilecek.
- Mevzuat ham metinlerini (`data/raw/`) senin temin etmen gerekiyor;
  mevzuat.gov.tr metinleri kaynak gösterimiyle kullanılabilir.

---

*Son güncelleme: 7 Temmuz 2026*
