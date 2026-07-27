# ozDNA — Konumlandırma & Go-to-Market (Kaynak Doküman)

> **DÜZELTME (kurucu kararı — bağlayıcı):** Bu doküman AlignX'i ozDNA'nın çatısı/aracı gibi konumlandırıyordu (§GTM Faz 1, §Fiyatlama). **ozDNA kendi başına çatı markasıdır; AlignX Partners kurucunun ayrı, şahsi UK danışmanlık işidir (alignxpartners.com) ve şu an kuruluş (formation) aşamasındadır — ozDNA'nın çatısı DEĞİLDİR ve ozDNA içeriği taşımaz.** AlignX yalnızca *ayrı bir danışmanlık/referral kanalı* olarak anılabilir (ürünü tanıtabilir/kurulumunu yapabilir) — ozDNA'nın markası, entity'si ya da çatısı değildir. Ayrıntı: `docs/oversight/README.md`. Aşağıdaki AlignX geçişleri bu çerçevede düzeltildi.

## Tek Cümle
ozDNA, AI harcamasını ve gözetimini riske orantılayan altyapı katmanıdır — complyDNA yükümlülüğü söyler, originDNA kararı ispatlar.

## Kategori
"LLM router" DEĞİL (OpenRouter/LiteLLM/Portkey — commodity).
"Compliance tool" DEĞİL (statik danışmanlık — kalabalık).
**AI oversight infrastructure** — iki kategorinin arasındaki boş kutu. Regülasyonun risk-temelli mantığını runtime mimarisine çevirir.

## Mimari
| Katman | Rol | AI Act karşılığı |
|---|---|---|
| ozDNA (çatı) | Margin-aware, risk-proportionate AI infrastructure | Risk-based approach (genel ilke) |
| complyDNA — DT 5.0 | Sınıflandırma: iş yükü/sistem → risk katmanı; yönlendirme kararı | Art. 9 risk yönetimi |
| complyDNA — Council | Yüksek riskli kararlarda çok modelli oylama + veto + fail-closed judge | Art. 14 insan gözetimi |
| originDNA — Ledger | Karar + oylar + gerekçe + sonuç, hash-zincirli değiştirilemez kayıt | Art. 12 kayıt tutma |
| originDNA — Attestation | Denetçiye/regülatöre sunulabilir kanıt çıktısı | Art. 13 şeffaflık |

Ekonomik tez: düşük riskli iş en ucuz yeterli modele; yüksek riskli karar Council'a — orada 5x token maliyeti bilinçli sigorta primi. CFO'ya orantılılık, compliance officer'a kanıt: aynı dashboard.

## Alıcı
Birincil: regüle kurumda compliance officer + CTO ikilisi. Karar birlikte verilir; materyal iki dili de konuşmalı (yükümlülük + entegrasyon).

## Rekabet Tezi
Routing commodity; sınıflandırma statik danışmanlık; **ikisini runtime'da birleştiren yok.** Savunma hattı: dikey mevzuat derinliği (MASAK/SPK/MiCA/AI Act) + council-veto mimarisi + ledger.

## GTM Fazları
**Faz 1 — Referans (0–3 ay):** Danışmanlık-gömülü giriş (bu kanal, kurucunun *ayrı* danışmanlık işi AlignX üzerinden yürüyebilir — AlignX ozDNA'nın çatısı değil, ayrı bir kanal; bkz. üstteki düzeltme). Lead magnet audit teklifi → audit çıktısı = complyDNA sınıflandırma raporu (ürün kendini satar). Hedef: 1 ücretli pilot (HalalVest tipi). CoinTR iç kullanımı traction sayılmaz (işveren), teknik doğrulama sayılır.

**Faz 2 — Dikey (3–9 ay):** Türk KVHS'ler → MiCA CASP'ları. Gerekçe: mevzuat bilgisi asimetrisi, gerçek denetim baskısı, ERP oyuncularının (Logo/Paraşüt) girmeyeceği dar pazar. KOBİ long-tail'e GİRİLMEZ.

**Faz 3 — Fon (6–12 ay):** ≥1 imzalı pilot ile EIC Pre-Accelerator (tek SME, widening ülke uygunluğu — TR uygun) → traction ile EIC Accelerator (TRL 5+, €2.5M grant; üç-hak kuralı: hazırlıksız başvuru YASAK).

## Fiyatlama
Yıllık lisans + kurulum danışmanlığı (kurulum, kurucunun ayrı danışmanlık işi AlignX üzerinden yürütülebilir — ozDNA'nın çatısı değil, ayrı kanal). Usage-based DEĞİL — regüle kurum öngörülebilir bütçe ister.

## Yapma Listesi
- Yeni domain/marka açma
- İki modülü ayrı satma
- Güvenlik/dual-use çağrılarına kayma
- Referanssız grant başvurusu
- Solana/onchain anlatısı
