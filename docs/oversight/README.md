# docs/oversight/ — ozDNA "AI oversight infrastructure" track (planning corpus)

**Bu klasör, ozDNA çatısı altındaki AI-oversight ürününün planlama korpusudur.**
İçindeki 5 planlama dokümanı (25 Tem 2026), repo-kökündeki content-provenance korpusuyla
(`CLAUDE.md` / `docs/BLUEPRINT.md` / `plan/`) aynı ürünü **anlatmaz** — farklı bir
ürün hattını anlatır. İkisi de **tek `ozdna.com` çatısı** altındadır.

## Kurucu düzeltmesi — otoriter (bu korpusun bazı kısımlarını geçersiz kılar)

Bu korpustaki bazı dokümanlar (özellikle `brand-architecture.md §1` ve `website-spec.md`
footer'ı) oversight ürününü **AlignX Partners** çatısı altında konumlandırıyordu
("AlignX Partners └── ozDNA", "an AlignX Partners product"). **Bu artık geçersizdir.**
Kurucu kararı:

- **ozDNA kendi başına çatı markasıdır.** Her ürün hattı `ozdna.com` altındadır.
- **AlignX Partners, kurucunun ayrı, şahsi UK danışmanlık işidir** (alignxpartners.com).
  ozDNA'nın çatısı **değildir** ve alignxpartners.com'da **hiç ozDNA içeriği bulunmaz**.
- İsim çakışması **yol ayrımıyla** yönetilir: content-provenans mevcut yerinde kalır
  (`/`, `/products/comply`, `/products/origin`, `/verify`); **oversight sitesi
  `ozdna.com/oversight/` altına oturur** (repo-kökündeki `oversight/` klasörü).

Korpus dokümanlarının gövdesi kaynak olarak korunur; yukarıdaki düzeltme bağlayıcıdır.

## İki ürün hattının ayrımı (ikisi de ozDNA / ozdna.com çatısında)

| | **content-provenance hattı** | **oversight hattı (bu klasör)** |
|---|---|---|
| Otorite doküman | `CLAUDE.md`, `docs/BLUEPRINT.md`, `plan/` | `docs/oversight/*` (bu klasör) |
| Yayınlanan site | `ozdna.com/`, `/products/*`, `/verify` | `ozdna.com/oversight/*` (`oversight/` klasörü) |
| ozDNA ne? | İçerik provenansı (C2PA imza + chain anchor + perceptual hash) | "AI oversight infrastructure" (risk-temelli mantık → runtime) |
| **originDNA** | Görsel imzalama / perceptual-hash fingerprint | Ledger (hash-chained, append-only) + Attestation → AI Act Art. 12/13 |
| **complyDNA** | RegTech uyum izleme | DT 5.0 sınıflandırma + Council → AI Act Art. 9/14 |
| Blockchain | Görünmez altyapı (var ama gizli) | Solana çıkarıldı, yerine hash-chained log |
| AI tespiti | v1'de yasak ("provenance, not detection") | DT motoru (AI dedektör) merkezi "canlı kanıt" |

> **Açık kalan marka kararı:** İki hat da `complyDNA` / `originDNA` isimlerini farklı
> şeyler için kullanıyor. Şimdilik **yol ayrımı** (`/` vs `/oversight`) bunu yönetiyor;
> isimlerin uzun vadede aynı kalıp kalmayacağı ayrı bir marka kararıdır (ertelendi).

## Bu klasördeki dosyalar

| Dosya | İçerik |
|---|---|
| `positioning.md` | Konumlandırma & GTM (tek cümle, kategori, mimari, alıcı, fazlar, fiyatlama) |
| `brand-architecture.md` | Marka hiyerarşisi, adlandırma kuralları, emekli/devşirilen varlıklar, TezMakale ilişkisi (hassas) — *§1 hiyerarşisi kurucu düzeltmesiyle geçersiz* |
| `ai-act-mapping.md` | ozDNA bileşeni ↔ EU AI Act maddesi eşlemesi + zaman çizelgesi (bu hattın kaynak otoritesi) |
| `website-spec.md` | oversight tek-sayfa site spesifikasyonu — *"an AlignX Partners product" footer'ı geçersiz* |
| `roadmap-90d.md` | 90 günlük yol haritası (marka kilidi → pilot → EIC Pre-Accelerator) |

Yayınlanan oversight sitesinin kaynağı: repo-kökünde **`oversight/`** (bu `docs/oversight/`
planlama korpusu değil).
