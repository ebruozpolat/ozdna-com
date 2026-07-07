# TezMakale — Canlı Site Referansı (tezmakale.com)

**Son inceleme:** 2026-07-08  
**Kaynak:** https://tezmakale.com (production)

Bu doküman ozdna entegrasyon katmanı ve içerik taslaklarının **canlı site ile uyumlu** kalması için tek referans noktasıdır.

## Ürün hattı

| Ürün (site adı) | Motor | URL | Not |
|-----------------|-------|-----|-----|
| AI Dedektör | OZDNA DT 5.0 | `/ai-detector/` | Ücretsiz; kayıt zorunlu değil |
| Parafraz | OZDNA HUMAN 1.0 | *(panel / PRO+)* | Şimdilik yalnızca İngilizce; Türkçe yakında |
| Detaylı Rapor | — | `/rapor/` | Tek seferlik; abonelik gerekmez |
| Kaynakça Oluşturucu | — | `/araclar/kaynakca-olusturucu/` | APA, Chicago, MLA |

**Anlatıda kullanılmayan terimler:** Hümanizer, Humanizer (site **Parafraz** kullanır).

## URL haritası (doğru → yanlış)

| Canlı URL | Kullanmayın |
|-----------|-------------|
| `/ai-detector/` | `/dedektör/`, `/dedektor/` |
| `/pricing/` | `/fiyatlandirma/` |
| `/rapor/` | — |
| `/app/dashboard/` | `/panel/` |
| `/app/login/`, `/app/register/` | — |
| `/kutuphane/` | `/kütüphane/` (URL ASCII) |
| `/sss/` | — |
| `/nasil-calisiyoruz/` | Dedektör metodolojisi |
| `/rehber/ai-detector-ne-ise-yarar/` | AI dedektör rehberi |

## Ana mesajlar (canlı)

**Duyuru bandı:** Sunucu temelli Türkçe akademik AI dedektör modeli aktif → `/pricing/`

**Gizlilik:** Metinler analiz sonrası saklanmaz.

**Metodoloji (`/nasil-calisiyoruz/`):** Metin tarayıcıda değil **sunucuda** işlenir; OZDNA DT motoru çalışır. Sonuç sinyal niteliğindedir, kesin kanıt değildir.

**Ücretsiz dedektör (SSS / pricing):** AI Dedektör ücretsizdir; kayıt gerektirmeden kullanılabilir.

## Token modeli

- 1 token = 1 boşluksuz karakter  
- 1.000 kelime ≈ 6.500 token  
- Ücretsiz plan: **aylık** 40.000 token (detektör)  
- PRO ve üzeri: **günlük** token limitleri (araç bazlı); kullanılmayan tokenlar devretmez  

## Fiyatlandırma (`/pricing/`)

### Tek seferlik Detaylı Rapor

| Tier | Kelime limiti | Fiyat |
|------|---------------|-------|
| Mini Rapor | 5.000 | $4.99 |
| Standart Rapor | 15.000 | $8.99 |
| Tez Raporu | 45.000 | $14.99 |

### Abonelikler (USD/ay)

| Plan | Fiyat | AI Dedektör | Parafraz | Detaylı Rapor (günlük token) |
|------|-------|-------------|----------|------------------------------|
| Ücretsiz | $0 | 40.000 token/ay, max 1.000 kelime/analiz | Dahil değil | Tek seferlik ayrı satın alınır |
| PRO | $9.90 | 80.000 token/gün, max 2.000 kelime | 40.000 token/gün (EN) | 7.000 token/gün |
| Akademik | $39.90 | 400.000 token/gün, max 4.000 kelime | 200.000 token/gün (EN) | 35.000 token/gün |
| MAX | $99.90 | Sınırsız, max 8.000 kelime | 1.000.000 token/gün (EN) | 175.000 token/gün |

Ödeme: Lemon Squeezy (`tezmakale.lemonsqueezy.com`).

## Panel (`/app/dashboard/`)

Canlı panel alanları: kalan token, Parafraz işlem sayısı, aylık tarama, hızlı erişim (AI Dedektör · Parafraz · Detaylı Rapor).

## Eski anlatı (artık birincil değil)

Önceki “iki modlu dedektör” (client-side Lite vs sunucu Derin) çerçevesi plan dokümanlarında vardı; **canlı sitede birincil mesaj sunucu temelli OZDNA DT 5.0** ve ücretsiz dedektördür. Client-side vurgusu ana sayfada tablo olarak yok; metodoloji sayfası sunucu işlemeyi net söyler.

SEO içeriklerinde gizlilik anlatısı korunabilir; URL ve ürün adları bu referansa göre güncellenmelidir.

## Backend eşlemesi (`@ozdna/tezmakale`)

| Site kavramı | API / kod |
|--------------|-----------|
| Parafraz | `product: "paraphrase"` (eski: `humanizer`) |
| AI Dedektör (sunucu) | `POST /tezmakale/detect/deep` |
| Parafraz | `POST /tezmakale/paraphrase` (alias: `/humanize`) |
| Planlar | `free`, `pro`, `academic`, `max` |
