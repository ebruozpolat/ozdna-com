---
title: ComplyDNA
tags: [regtech, compliance, llm, masak, kvkk, aml]
related: [overview.md, pricing.md, contact.md]
---

# ComplyDNA — Türk mevzuatına özel uyum LLM'i

ComplyDNA, Türk mevzuatı (MASAK tebliğleri, AML/CFT kanunları, KVKK) üzerine eğitilmiş
bir uyum LLM'idir. Her yanıtını `[TEBLİĞ / Madde]` biçiminde satır içi kaynak künyesiyle
verir; yanıtın dayandığı mevzuat parçası cümle düzeyinde doğrulanabilir.

ComplyDNA is a compliance LLM for Turkish financial regulation, answering compliance
questions with inline statutory citations in the form [COMMUNIQUE / Article].

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

- Bulut API / web arayüzü, veya tam kurum içi (on-prem) — model ve indeks kurumda
- Müşteri verisi model eğitiminde kullanılmaz

## Not

Çıktılar bilgilendirme amaçlıdır, hukuki tavsiye değildir.

Page: https://ozdna.com/products/comply/
