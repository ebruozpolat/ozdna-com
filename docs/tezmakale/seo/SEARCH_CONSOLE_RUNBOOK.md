# TezMakale — Search Console Runbook

**Yusuf | tezmakale.com**

Referans: [CANLI_SITE_REFERANSI.md](../CANLI_SITE_REFERANSI.md)

## Yayınlanacak / güncellenecek içerik

1. Kütüphane: `turkce-akademik-ai-tespiti-nasil-calisir` → `docs/tezmakale/seo/turkce-akademik-ai-tespiti-nasil-calisir.md`
2. Kütüphane: `ai-dedektor-gizlilik-ve-saklama` (eski client-side odaklı slug yerine) → `docs/tezmakale/seo/ai-dedektor-gizlilik-ve-saklama.md`
3. `/ai-detector/` — canlı copy referansı: `docs/tezmakale/content/SITE_COPY_CANLI_UYUM.md`
4. `/pricing/` — token tablosu + FAQ (canlıda mevcut; schema doğrula)

## İndeksleme adımları

1. Search Console → **URL Inspection**
2. Her yeni URL için **Request indexing**
3. **Sitemaps** → `https://tezmakale.com/sitemap.xml` (varsa) submit
4. **Performance** → Queries: [SEO_RAKIP_SORGU_LISTESI.md](../SEO_RAKIP_SORGU_LISTESI.md)

## Teknik SEO

- Title/description: `/ai-detector/`, `/pricing/`, `/rapor/` canonical’ları doğrula
- FAQPage JSON-LD: `/pricing/` ve `/sss/` (canlıda pricing FAQ mevcut)
- İç linkler ASCII slug: `/kutuphane/`, `/nasil-calisiyoruz/`
- `hreflang`: tr + x-default (tek dil sitesi — self-referencing)

## 404 kontrolü

Aşağıdaki eski slug’lar **404** döner — yönlendirme veya link temizliği:

- `/dedektör/` → `/ai-detector/` (301 önerilir)
- `/fiyatlandirma/` → `/pricing/` (301 önerilir)
