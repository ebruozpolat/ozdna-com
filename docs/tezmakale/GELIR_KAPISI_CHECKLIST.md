# TezMakale — Gelir Kapısı Checklist

**Findbelow Ventures | Temmuz 2026**

Canlı site referansı: [CANLI_SITE_REFERANSI.md](./CANLI_SITE_REFERANSI.md)

Gelir kapısı “bitti” sayılması için aşağıdaki maddelerin tamamı doğrulanmalıdır.

## Ödeme (Lemon Squeezy)

- [ ] PRO ($9.90/ay) checkout canlı — variant ID eşleşiyor
- [ ] Akademik ($39.90/ay) checkout canlı
- [ ] MAX ($99.90/ay) checkout canlı
- [ ] Tek seferlik Detaylı Rapor checkout canlı (Mini $4.99 · Standart $8.99 · Tez $14.99)
- [ ] Webhook imza doğrulama (`LEMONSQUEEZY_WEBHOOK_SECRET`)
- [ ] `subscription_created` → doğru plan + token/limit artışı
- [ ] `subscription_cancelled` / `subscription_expired` → free tier
- [ ] `order_created` (rapor) → rapor job tetiklenir
- [ ] Webhook idempotency (aynı event iki kez işlenmez)
- [ ] Test kartı ile uçtan uca PRO satın alma doğrulandı

## Auth + Panel

- [ ] Kayıt / giriş / oturum — `/app/login/`, `/app/register/`, `/app/dashboard/`
- [ ] Dashboard: kalan token, aylık tarama, Parafraz işlem sayısı
- [ ] Profil + abonelik durumu endpoint’leri
- [ ] Ürün bazlı limit: **AI Dedektör**, **Parafraz** (PRO+), **Detaylı Rapor**

## OzDNA GPT entegrasyonu

- [ ] Sunucu dedektör → `POST /v1/detect` (mode: academic, language: tr) — OZDNA DT 5.0
- [ ] Parafraz → `POST /v1/chat` — OZDNA HUMAN 1.0
- [ ] Her sunucu çağrısında quota + usage kaydı
- [ ] Aylık token maliyeti panelde veya admin metriklerde görünür

## Anlatı (canlı site ile uyum)

- [ ] Ürün adları: AI Dedektör · **Parafraz** · Detaylı Rapor (Hümanizer yok)
- [ ] URL’ler: `/ai-detector/`, `/pricing/`, `/rapor/`, `/sss/`
- [ ] Sunucu temelli dedektör + ücretsiz kullanım mesajı tutarlı
- [ ] Gizlilik: “Metinler analiz sonrası saklanmaz”

## SEO (tezmakale.com)

- [ ] Rakip AI Overview hedef sorgular listelendi ([SEO_RAKIP_SORGU_LISTESI.md](./SEO_RAKIP_SORGU_LISTESI.md))
- [ ] Kütüphane içerikleri doğru URL’lerle yayında
- [ ] Search Console indeksleme isteği gönderildi

## İlk nakit

- [ ] En az 1 gerçek ücretli müşteri (PRO, Akademik, MAX veya rapor)

---

**Backend referans:** `platform/packages/tezmakale/` + `POST /tezmakale/*` routes on `@ozdna/api`

**Doğrulama scripti:** `node scripts/verify-revenue-gate.mjs` (local/staging)
