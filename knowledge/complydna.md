---
title: ComplyDNA
tags: [regtech, compliance, citation-first, masak, kvkk, aml]
related: [overview.md, pricing.md, contact.md]
---

# ComplyDNA — alıntı öncelikli uyum istihbaratı

ComplyDNA, Türk finansal mevzuatı (MASAK tebliğleri, AML/CFT kanunları, KVKK) için alıntı
öncelikli bir uyum istihbaratı aracıdır. Her yanıt, dayandığı mevzuat metnine
`[TEBLİĞ / Madde]` biçiminde satır içi künyeyle bağlanır; her cümle kaynağında
doğrulanabilir.

ComplyDNA is citation-first compliance intelligence for Turkish financial regulation:
every answer links to the regulatory text behind it, in the form [COMMUNIQUE / Article].

## Kapsam / Coverage

- 5549 — Suç Gelirlerinin Aklanmasının Önlenmesi Hakkında Kanun
- 6415 — Terörizmin Finansmanının Önlenmesi Hakkında Kanun
- 6698 — Kişisel Verilerin Korunması Kanunu (KVKK)
- MASAK tebliğ ve genelgeleri, Tedbirler Yönetmeliği
- Kripto varlık hizmet sağlayıcı (VASP/CASP) düzenlemeleri

## Yöntem / Method

1. Mevzuat korpusu madde düzeyinde parçalanır, yürürlük metadata'sıyla etiketlenir
2. Anlamsal indeks üzerinden geri getirme (TR/EN çift sorgu)
3. Model referans biçimini ve mevzuat dilini ince ayarla öğrenir
4. Yanıt: kaynak künyeli, denetlenebilir — golden-set ile her sürümde ölçülür

## Dağıtım / Deployment

- Bulut API / web arayüzü, veya tam kurum içi (on-prem): model ve indeks kurumda
- Müşteri verisi model eğitiminde kullanılmaz

## Not

Çıktılar bilgilendirme amaçlıdır, hukuki tavsiye değildir; uyum garantisi verilmez.

Page: https://ozdna.com/products/comply/
