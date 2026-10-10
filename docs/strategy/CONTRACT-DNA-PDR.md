# ozDNA — Contract DNA | AI Mimarisi ve Fiyatlandırma Karar Kaydı

**Belge tipi:** Product Decision Record (PDR)  
**Sürüm:** v1.0  
**Tarih:** 10 Ekim 2026  
**Durum:** Başlangıç yönü belirlendi; fiyatlar ve maliyetler müşteri/pilot doğrulamasına tabidir  
**İlk ürün:** Contract DNA (Deal Diff)  
**Üst marka:** ozDNA — *Make important work provable.*

> **Karar disiplini:** Bu belgede **[YÖN KARARI]** tasarım için benimsenecek başlangıç yaklaşımını, **[HİPOTEZ]** ölçülmeden kesinleştirilmeyecek ticari veya teknik varsayımı, **[AÇIK]** ise ayrıca karar verilmesi gereken konuyu gösterir.

## 1. Yönetici özeti

Contract DNA'nın ilk değeri, iki sözleşme sürümünü karşılaştırıp **iş açısından önemli değişiklikleri**, kaynak maddeleri ve denetlenebilir değerlendirme kaydıyla göstermektir. Ürün tam kapsamlı bir Contract Lifecycle Management (CLM), e-imza veya hukuki görüş hizmeti olmayacak.

- **[YÖN KARARI]** Başlangıç MVP'sinde özel bir karar modeli eğitilmeyecek. Hazır LLM + deterministik sürüm karşılaştırması + doğrulama kuralları + gerektiğinde insan incelemesi kullanılacak.
- **[HİPOTEZ]** Ana analiz modeli Claude Sonnet 4.6; maliyet/başarı karşılaştırmasında Gemini 2.5 Flash; referans karşılaştırmada GPT-5.4. Model seçimi ölçümle teyit edilecek.
- **[YÖN KARARI]** Qwen3.5-4B + Unsloth Decision yaklaşımı, üretim bağımlılığı olmadan ayrı araştırma kolu olarak tutulacak.
- **[HİPOTEZ]** Ticari giriş fiyatı **$39/ay**. Ana hedef paketler Professional **$99/ay** ve Team **$129/ay**.
- **[YÖN KARARI]** Sınırsız analiz satılmayacak. Paketler aylık **standart karşılaştırma kredisi** ve açık belge/işlem sınırlarıyla tanımlanacak.
- **[YÖN KARARI]** Business için önce önerilen **$299/300 karşılaştırma** kombinasyonu sürdürülebilirlik riski nedeniyle reddedildi; değerlendirmeye alınacak iki alternatif: **$399/200 standart kredi** (tercih edilen başlangıç hipotezi) veya **$299/150 standart kredi**.

## 2. Ürün kapsamı ve vaat

**Konumlandırma:** “Not a legal opinion. A decision-ready map of what changed.”

**İlk müşteriler:** uluslararası pazardaki startup kurucuları, B2B SaaS, ajanslar, danışmanlar, procurement ve küçük hukuk/uyum ekipleri.

**MVP kapsamında:**
1. Metin tabanlı PDF ve DOCX'ten iki sürüm yükleme.
2. Deterministik metin farkı ve madde düzeyinde eşleştirme.
3. Ödeme, yenileme, fesih, sorumluluk, IP, veri koruma, güvenlik ve denetim gibi değişiklik sınıfları.
4. Değişen maddenin önceki/yeni metni, sayfa veya bölüm referansı ve iş etkisi açıklaması.
5. Önem derecesi/inceleme önceliği, belirsizlik ve insan incelemesine yönlendirme.
6. Paylaşılabilir/dışa aktarılabilir değerlendirme raporu; kaynak, model/prompt sürümü ve insan kararının izlenebilir kaydı.

**MVP dışında:** nihai hukuki görüş, otomatik sözleşme onayı, tam CLM, e-imza ve doğrulanmamış “hukuka uygundur” beyanları.

## 3. LLM ve karar modeli stratejisi

| Katman | Başlangıç yaklaşımı | Statü |
|---|---|---|
| Belge ayrıştırma | Metin çıkarımı, bölüm/madde ayrımı, OCR'yi gerektiğinde ayrı ücretlendirme | [YÖN KARARI] |
| Sürüm karşılaştırması | Deterministik diff; model tek başına değişiklik tespitinin kanıtı sayılmaz | [YÖN KARARI] |
| Ekonomik ilk geçiş | Gemini 2.5 Flash ile alan çıkarma/etiketleme seçeneği | [HİPOTEZ] |
| Karmaşık analiz | Claude Sonnet 4.6 ile kaynak bağlantılı değişiklik ve iş etkisi yorumu | [HİPOTEZ] |
| Karşılaştırma tabanı | GPT-5.4'ü aynı örnek kümesinde benchmark etme | [HİPOTEZ] |
| Sonuç kontrolü | Yapılandırılmış şema, kanıt denetimi, politika kuralları, abstain/review | [YÖN KARARI] |
| Gelecekte özelleştirme | Unsloth Qwen3.5-4B Decision fine-tuning | [ARAŞTIRMA] |

**Fine-tuning'i başlatma koşulu:** Yeterli sayıda uzman etiketli gerçek örnek oluşması ve hazır modellerin belirli tekrar eden karar görevlerinde maliyet, gecikme veya hata bakımından yetersiz kaldığının benchmark ile gösterilmesi. Eğitim verileri ve müşteri gizliliği ayrı değerlendirilmelidir.

**Önerilen karar kayıt şeması:** `asset_id`, `old_version_id`, `new_version_id`, `change_id`, `category`, `materiality`, `severity`, `source_spans`, `evidence_hash`, `model_id`, `prompt_version`, `decision`, `review_status`, `reviewer`, `timestamp`.

**Önemli sınır:** Modelin güven/olasılık skoru, sözleşme riskinin parasal/operasyonel büyüklüğü değildir. Kritik yanlış negatifler ayrıca ölçülür. Kanıt yoksa model “inceleme gerekli” sonucuna gidebilmelidir.

**Araştırma referansı:** https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Qwen3_5_(4B)-Decision.ipynb

## 4. API fiyat varsayımları ve değişken maliyet

Aşağıdaki oranlar önceki değerlendirmede kullanılan **planlama girdileri**dir; taahhüt edilen güncel sağlayıcı tarifesi sayılmaz. Ürün çıkışında resmi fiyat sayfaları tekrar doğrulanacak.

| Model | 1 milyon input token | 1 milyon output token | Rol |
|---|---:|---:|---|
| Claude Sonnet 4.6 | $3.00 | $15.00 | Karmaşık analiz adayı |
| Gemini 2.5 Flash | $0.30 | $2.50 | Ekonomik ilk geçiş adayı |
| GPT-5.4 | $2.50 | $15.00 | Alternatif benchmark |

**Bir çağrı örneği (10.000 input + 1.000 output):** Claude $0.045; Gemini $0.0055; GPT $0.040. Bu rakamlar *tek bir API çağrısı* içindir; tek bir tamamlanmış sözleşme karşılaştırmasının maliyeti değildir.

**İki modelin de kullanıldığı örnek işlem yoğunlukları:**

| Senaryo | Her bir modelde varsayılan toplam token | İki modelin birleşik AI maliyeti |
|---|---|---:|
| Hafif | 25.000 input + 3.000 output | $0.135 |
| Standart | 80.000 input + 8.000 output | $0.404 |
| Yoğun | 200.000 input + 20.000 output | $1.010 |

Bu senaryolar ölçülmüş müşteri kullanımı değildir. Prompt tekrarları, retry, belge parçalama, cache, OCR ve sağlayıcı değişiklikleri gerçek maliyeti etkiler.

**[HİPOTEZ] Standart karşılaştırmanın toplam değişken maliyet bütçesi: $0.60**  
- Yaklaşık $0.40 AI kullanımı.
- Yaklaşık $0.20 diğer işlem bazlı gider rezervi.
- Sabit giderler, pazarlama, personel, destek, ödeme komisyonları, vergi ve iade/chargeback dahil değildir.

**Örnek katkı marjı, tüm krediler kullanılır ve kredi başına $0.60 değişken maliyet oluşursa:**

| Paket | Aylık fiyat | Kredi | Aylık değişken maliyet | Katkı marjı |
|---|---:|---:|---:|---:|
| Starter | $39 | 15 | $9 | %76,9 |
| Professional | $99 | 60 | $36 | %63,6 |
| Team | $129 | 100 | $60 | %53,5 |
| Business (revize A) | $399 | 200 | $120 | %69,9 |
| Business (revize B) | $299 | 150 | $90 | %69,9 |

Bu marjlar *şirket brüt kârı/net kârı* değildir; belirli değişken maliyet varsayımı üzerinden katkı marjlarıdır. Team paketinin marjı nispeten düşük olduğundan kullanım ve support maliyeti özellikle izlenmeli.

## 5. Aylık paket fiyatları — test edilecek ticari teklif

| Paket | Aylık fiyat | Standart karşılaştırma / ay | Kullanıcı | Temel değer |
|---|---:|---:|---:|---|
| Starter | **$39** | **15** | 1 | Fark analizi, risk etiketleri, kanıtlı PDF rapor |
| Professional | **$99** | **60** | 1 | Daha aktif kullanım, gelişmiş inceleme, sürüm geçmişi |
| Team | **$129** | **100** | 3 | Ekip notları, insan onayı, karar kayıtları |
| Business — tercih edilen hipotez | **$399** | **200** | En çok 10 | Yönetici görünümü, gelişmiş kontroller ve raporlama |
| Business — alternatif test | **$299** | **150** | En çok 10 | Aynı sınıfta daha düşük hacimli teklif |
| Enterprise | Teklif bazlı | Özel kota | Özel | Güvenlik, SSO, veri işleme/konum, entegrasyon, SLA ihtiyaçlarına göre |

**[AÇIK]** Business için yalnızca *bir* fiyat/kredi kombinasyonu canlıya alınmalı; yukarıdaki iki alternatif aynı anda nihai teklif değildir.

**Kredi tanımı — önerilen başlangıç:** 1 standart kredi = iki metin tabanlı sürümün, **toplam en fazla 60 sayfalık** tek bir karşılaştırması. Sayfa sayısı tek başına token tüketimini güvenilir biçimde sınırlamayacağı için üretimde ayrıca dosya boyutu/token üst sınırı, taranmış PDF/OCR politikası, dil, yeniden analiz ve uzun belge katları belirlenecek. Bunlar henüz kesin ürün şartları değildir.

## 6. Ek kullanım, deneme ve yıllık ödeme

**[HİPOTEZ] Ek kredi paketleri:**

| Ek kredi | Toplam fiyat | Kredi başına |
|---|---:|---:|
| 10 | $19 | $1.90 |
| 50 | $79 | $1.58 |
| 100 | $149 | $1.49 |

- Ek kredilerin 12 aylık geçerliliği düşünülüyor; tüketici hukuku, sözleşme koşulları ve faturalama altyapısı açısından doğrulanacak.
- İlk kullanım için **3 ücretsiz standart karşılaştırma** öneriliyor; limitsiz ücretsiz plan önerilmiyor.
- **[HİPOTEZ]** Yıllık peşin ödemede **iki ay ücretsiz** (12 yerine 10 aylık tutar): Starter $390/yıl, Professional $990/yıl, Team $1.290/yıl, Business $3.990/yıl (Business A seçilirse). Bu matematiksel olarak yaklaşık **%16,7** indirimdir; **%20 değildir**.
- Vergiler, KDV/VAT, para birimi, iade şartları, kullanım devri ve kullanıcı ekleme ücretleri **[AÇIK]**.

## 7. Ticari doğrulama ve çıkış kriterleri

**İlk 30 gün için önerilen doğrulama planı:**

1. Contract DNA için İngilizce odaklı landing page ve örnek çıktı.
2. 10–15 hedef müşteri görüşmesi; fiyat hassasiyeti, kullanım sıklığı ve temel acı noktasını öğrenme.
3. Gerçek izinli veya anonimleştirilmiş belgelerle concierge/demo pilotu.
4. En az **3 ücretli pilot** hedefi; hedef başarı garantisi değil.
5. Tekil karşılaştırma başına gerçek API tokenı, gecikme, retry, OCR, destek zamanı ve müşteri başına kullanım ölçümü.
6. Başlangıç teklifini rakipler ve müşteri ödeme isteğiyle yeniden test etme.

**LLM karşılaştırma planı:** 100–200 uzman etiketli değişiklikte Claude, Gemini ve GPT alternatifleri aynı rubrikle değerlendirilecek. Ölçütler:
- Kritik değişikliklerde yanlış negatif oranı.
- Doğru kaynak/madde referansı.
- Dayanaksız risk veya yükümlülük üretme oranı.
- JSON/şema uyumu ve inceleme için yeterli gerekçe.
- Belirsizlik durumunda karar vermekten kaçınma / insan incelemesine yönlendirme.
- İşlem süresi ve tamamlanan karşılaştırma başına **toplam** maliyet.

## 8. Finansal hedefleme ve sürdürülebilirlik

Örnek (tahmin değil) müşteri dağılımı: 50 Starter, 25 Professional, 10 Team, 3 Business ($399) = **88 müşteri**, **$6.912 MRR**, **$82.944 yıllık gelir hızı (ARR)**. Bu gelir hızı; churn, indirime tabi yıllık planlar, vergi, masraflar ve bir defalık gelirler dikkate alınmadan hesaplanır.

**İzlenecek göstergeler:** MRR, ARPA, aktivasyon, denemeden ücretliye dönüşüm, churn, CAC, ödeme komisyonları, işlem başı tam değişken maliyet, kredi tüketimi, API hata oranı, kritik false negative ve müşteri destek yükü.

## 9. Güvenlik ve uyum ilkeleri

- Gizli sözleşme içeriğinin modele gönderilmesi için müşteri izni, veri işleme şartları, saklama süreleri ve bölgesel işleme gereksinimleri netleştirilecek.
- Hassas içerikler loglarda gereksiz yere tutulmayacak; erişim ve silme politikaları oluşturulacak.
- Model çıktıları hukuki tavsiye veya otomatik bağlayıcı onay olarak sunulmayacak.
- Her önemli bulgu ilgili belge parçasına bağlanacak; kanıt bağlantısı eksikse doğrulanmış bulgu gibi gösterilmeyecek.
- Müşteriye sunulan raporda “AI destekli değerlendirme — insan incelemesinin yerini almaz” kapsam bildirimi yer alacak.

## 10. Açık kararlar / sonraki adımlar

| Konu | Sahiplik önerisi | Karar öncesi kanıt |
|---|---|---|
| Claude mu Gemini mi ana model? | Ürün / Engineering | 100–200 etiketli benchmark |
| İki modeli her işlemde mi, yalnızca gerektiğinde mi kullanacağız? | Engineering | Task routing ve gerçek token/cost ölçümü |
| Business $399/200 mü $299/150 mi? | Product / Commercial | Ücretli pilot ve birim ekonomi |
| Team $129/100 marjı yeterli mi? | Finance / Product | Aktif müşteri kullanım dağılımı |
| Standart kredinin token ve sayfa limitleri | Engineering | Uzun belge stres testi |
| OCR/çok dilli belge fiyatlandırması | Product | Gerçek işlem maliyeti |
| Veri saklama ve tedarikçi koşulları | Security / Legal | DPA ve sağlayıcı şartları |
| Unsloth Qwen deneyi ne zaman? | R&D | Hazır model benchmark ve etiketli veri |

---

### İlgili referanslar

- ozDNA dikey ürün taslağı (kullanıcı tarafından sağlanan fikir dokümanı): Contract DNA, Vendor DNA, Claim DNA; ortak `Asset / Version / Claim / Change / Evidence / Decision` çekirdeği.
- Unsloth Qwen3.5-4B Decision notebook: https://colab.research.google.com/github/unslothai/notebooks/blob/main/nb/Qwen3_5_(4B)-Decision.ipynb
- API fiyatları: fiyat kararının uygulanacağı tarihte sağlayıcıların resmi tarifeleri üzerinden yeniden kontrol edilmeli.

**Kayıt notu:** Bu belge bir ürün-strateji ve fiyat hipotezleri kaydıdır. Nihai fiyat listesi, onaylanmış teknik tasarım veya finansal tahmin değildir.

---

## Sürüm geçmişi

| Sürüm | Tarih | Değişiklik |
|---|---|---|
| v1.0 | 10 Ekim 2026 | İlk kayıt: AI mimarisi yönü, model hipotezleri, paket/kredi fiyat hipotezleri, doğrulama planı ve açık kararlar. |
