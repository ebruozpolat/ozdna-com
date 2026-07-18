# AB Projesi — NGI Zero Commons Fund Başvuru Taslağı (OriginDNA)

**Durum: DOSYALAMAYA HAZIR (founder onayları tamam, 10 Tem 2026). Hedef: 1 Ağustos 2026, 12:00 CEST son tarihinden önce dosyalama. Program: NGI Zero Commons Fund (NLnet / AB Horizon Europe kaskad fonu).**
**Ürün çerçevesi (founder, 10 Tem):** *"EU AI Act Madde 50 içerik işaretleme için içerik kökeni API'si. Lansman öncesi — herkese açık API referansı Ekim 2026 MVP'siyle gelir. Bekleme listesindekiler önce alır."* Tespit sınıflandırıcısı yok; kilitli kurallarla tam uyumlu.
**✅ Founder kararları (10 Tem 2026) — üçü de kapandı:** (1) Başvuran = Ebru Özpolat şahıs işletmesi (TR, vergi levhalı danışmanlık firması). (2) FOSS kapsamı ONAYLANDI — fonlanan "Açık Doğrulama Yığını" açık kaynak, ticari API kapsam dışı. (3) 1 Ağustos'a YETİŞTİRİLECEK — Aug 2 PR hamlesi bu dosyalama lehine geri çekildi (0.5 duruma bak).

---

## Neden bu program (alternatiflere karşı)

| Program | Uygunluk | Neden / neden değil |
|---|---|---|
| **NGI Zero Commons Fund** ✅ önerilen | Başvuru portalı herkese açık; "belirgin Avrupa boyutu" şart — ürünün konusu bizzat AB AI Yasası uyumu, Avrupa boyutu yapısal. Bireyler de kurumlar da başvurabilir. | €5K–50K, 1-2 sayfalık hafif başvuru, konsorsiyum yok, ~2-3 ayda karar → para MVP dönemine (Eki–Ara) denk gelir. Çıktılar FOSS olmalı. |
| EIC Accelerator | ⚠️ AB/asosiye ülke KOBİ'si şart — founder'ın TR şahıs işletmesi bu tanımı karşılar (PIC kaydı gerekir) | Ölçek olarak erken: EIC scale-up arar; MVP + ilk gelir sonrası düşünülür |
| Horizon Europe konsorsiyum çağrıları | ⚠️ Türk kurumu ortak olabilir ama konsorsiyum + aylarca hazırlık ister | Solo kurucu + sıfır bütçeyle gerçekçi değil; Şubat 2027 "birlikte çalışabilirlik" konsorsiyum oyunu için ileride not |
| Digital Europe | ❌ genelde kamu/büyük konsorsiyum odaklı | — |

**Uygunluk (founder bilgisiyle çözüldü, 10 Tem):** Başvuran = **Ebru Özpolat şahıs işletmesi** (Türkiye — Horizon Europe asosiye ülkesi; vergi levhalı danışmanlık firması). AB KOBİ tanımı hukuki biçimden bağımsız ekonomik faaliyet yürüten her birimi kapsar — şahıs işletmesi "işletme" sayılır. ozdna.com founder'a şahsen ait → başvuran = ürün sahibi, tutarlı. Find Below Ventures (BAE) başvuruda YER ALMAZ (ayrı tüzel kişilik). İleriki AB programları için: aynı işletmeyle Funding & Tenders Portal PIC kaydı yapılabilir. Muhasebeci soruları (başvuru engeli değil): hibe gelirinin vergilendirmesi; gerekirse NACE faaliyet kodu ekleme.

## Açık kaynak kapsamı (founder onayladı, 10 Tem)

NLnet fonladığı işin tamamının FOSS (tanınmış açık lisans) olmasını ister. Öneri: fonlanan proje **"OriginDNA Açık Doğrulama Yığını"** olarak sınırlanır —
1. tarayıcı-içi C2PA imzalama akışı (WASM entegrasyon kodu),
2. halka açık doğrulama sayfası + doğrulama kütüphanesi (manifest doğrulama, parmak izi eşleştirme: DCT pHash + PDQ-256),
3. kayıt eşleştirme (match) araç seti ve bağımsız doğrulama dokümantasyonu.

Ticari barındırılan API, faturalama ve operasyon **kapsam dışı** kalır (Filecoin taslağındaki modelle aynı ayrım). Bu, hem NLnet şartını karşılar hem işi korur.

---

# Başvuru yanıtları (EN — form alanlarına yapıştırılır)

## Project name

OriginDNA Open Verification Stack — content provenance for EU AI Act Article 50 content marking

## Applicant

Ebru Özpolat — sole proprietorship (registered consultancy, Türkiye; Horizon Europe associated country). Owner of ozdna.com and the OriginDNA project.

## Website / repository

https://ozdna.com/products/origin/ · `{public repo created at project start}`

## Abstract (≈1200 characters)

From 2 August 2026, Article 50 of the EU AI Act requires providers of generative AI systems to mark AI-generated content in machine-readable form; the transition period for systems already on the market ends on 2 December 2026. Thousands of small European GenAI applications have nothing built, and the tooling that exists is vendor-gated. Worse, provenance metadata rarely survives the real internet: most platforms strip C2PA metadata on upload, so a signature alone protects no one.

OriginDNA is a content provenance API for Article 50 content marking (pre-launch; public API reference ships with the October 2026 MVP; waitlist members get access first). This project funds its open verification stack: (1) browser-side C2PA signing so anyone can mark images at creation without sending them to a server; (2) a public verify page and verification library — signature validation plus perceptual-fingerprint matching (DCT pHash + PDQ-256) so stripped, resized or re-encoded copies can still be traced to their origin record; (3) publicly documented, independently reproducible verification: proofs remain checkable by anyone, with no account and no reliance on us. All outputs free and open source.

## Requested amount

€50,000

## Explain what the requested budget will be used for

Engineering time to build and release the open verification stack in three milestones aligned with the October 2026 MVP window:

- **M1 (€20,000):** Browser-side C2PA signing flow (WASM), releasable as a reusable open-source component; image formats JPG/PNG.
- **M2 (€20,000):** Verification library + public verify page: C2PA manifest validation, perceptual-fingerprint extraction and matching (DCT pHash, PDQ-256), publicly verifiable timestamp checking; test corpus and accuracy documentation.
- **M3 (€10,000):** Independent-verification documentation and hardening: reproducible third-party verification guide, threat-model write-up (metadata stripping, re-encoding, screenshots), accessibility and i18n (EN/TR) of the verify surface.

No hardware, no travel; budget is effort-based. The commercial hosted API (billing, tenancy, SLAs) is explicitly outside this project's scope and budget.

## Compare your own project with existing or historical efforts

- **Adobe Content Authenticity (free app):** signing for creators, but vendor-run, account-gated, and metadata-bound — records live inside one vendor's ecosystem. Our stack is neutral, API-first and open source, and adds fingerprint matching so provenance survives metadata stripping.
- **Truepic:** enterprise-priced provenance (four-figure monthly plans); nothing self-serve for the small applications Article 50 actually burdens.
- **C2PA ecosystem itself:** the spec (v2.4) anticipates third-party manifest repositories and soft bindings but has no neutral open implementation; we build in the standard's own direction and publish the missing open tooling.
- **Detection tools (e.g., the former TrueMedia):** classifiers that guess "is this AI?" after the fact — costly and error-prone; TrueMedia shut down in January 2025. We deliberately do the opposite: provenance attached at creation, verifiable by anyone.

## What are significant technical challenges you expect to solve?

(1) Robust perceptual matching at web scale with a published false-match methodology — balancing DCT pHash speed against PDQ-256 robustness on re-encoded/resized/cropped copies. (2) Browser-side signing ergonomics: key handling and manifest generation in WASM without leaking keys or uploading originals. (3) Honest verification UX: communicating cryptographic validity without overclaiming trust status (our certificates are not yet on the C2PA conformance trust list, and the UI must say so plainly). (4) Verification that remains reproducible by third parties with only public artifacts.

## Describe the ecosystem of the project, and how you will engage with relevant actors

The user ecosystem is the long tail of European GenAI applications facing the 2 December 2026 deadline (a segmented waitlist is live), marketplace sellers under AI-disclosure rules, and newsrooms/fact-checkers — the latter get the hosted service free, forever, and TR/MENA fact-checking organizations are our flagship early users. Standards engagement: Content Authenticity Initiative membership (applied, July 2026); we build to C2PA v2.4 including its soft-binding direction and publish our tooling for other implementers. Dissemination: founder-led press work timed to the Article 50 application date and the December enforcement wave, plus documentation-first developer outreach.

## Relevant experience

*(Taslak — founder kendi sesine göre düzeltebilir; dosyalamadan önce son okuma sizde.)*

I run a registered consultancy in Türkiye and have 5+ years of professional experience in communications, distribution and SEO in the financial-technology industry. I own and operate ozdna.com, where the OriginDNA landing, segmented waitlist and bilingual (EN/TR) site are already live, backed by an adversarially-reviewed technical build plan for the October 2026 MVP. Development is executed by my team using AI-assisted engineering with contract engineering support; the project's technical architecture, algorithms (DCT pHash, PDQ-256, C2PA integration) and milestones are fully specified and public-ready.

---

## Dosyalama kontrol listesi (founder — 1 Ağustos 12:00 CEST'ten önce)

1. **Form:** https://nlnet.nl/propose/ → "NGI Zero Commons Fund" seçin. Yanıtları bu belgedeki EN bölümlerinden kopyalayın (Abstract ≈1200 karakter sınırına dikkat — mevcut metin uygun).
2. **Relevant experience** metnini kendi sesinize göre son kez okuyun/düzeltin.
3. İletişim: hello@ozdna.com (veya şahsi e-posta — form sahibiyle tutarlı olsun).
4. Repo alanına `ebruozpolat/ozdna-com` yazılabilir; `origindna-verify` açık repo'su proje başında açılacak diye not düşün (formda böyle dedik).
5. Gönderim sonrası: başvuru numarası/onay e-postasını saklayın; ACTION_PLAN 2.6'ya "FILED + tarih" işleyeceğiz. Karar süreci ~2-3 ay; ek soru gelirse (NLnet kısa soru turu yapar) birlikte yanıtlarız.
6. Kaçırılırsa panik yok: çağrı periyodik — ama Ekim MVP eşleşmesi için en iyi pencere bu.

## İç notlar (başvuruya girmez)

- Kaynaklar: [NGI Zero Commons Fund](https://nlnet.nl/commonsfund/), [Guide for Applicants](https://nlnet.nl/commonsfund/guideforapplicants/), [Eligibility](https://nlnet.nl/commonsfund/eligibility/), [NGI open calls](https://ngi.eu/opencalls/). Son tarih ve tutarlar 10 Tem 2026'da doğrulandı: €5K–50K, kapanış 1 Ağu 2026 12:00 CEST, sonraki çağrılar da olur (kaçırılırsa dünya yıkılmaz — ama Ekim MVP zamanlamasıyla en iyi eşleşen bu).
- Değerlendirme kriterleri: teknik mükemmellik, NGI'ya stratejik uygunluk, paranın karşılığı. "Blockchain" kelimesi başvuruda bilinçli olarak kullanılmadı; zaman damgası "publicly verifiable timestamp" olarak geçiyor (NLnet kitlesi FOSS/commons odaklı — kural 4'ün ruhu burada da geçerli).
- Bekleyen founder kararları: başvuran kimlik (şahıs-TR vs Find Below-BAE), FOSS kapsam onayı, 1 Ağu iş yükü. Karar gelmeden dosyalanmaz.
- Filecoin taslağıyla çakışma yok: Filecoin = arşiv katmanı (ayrı iş, MVP sonrası, kendisi de founder kararı bekliyor); NGI0 = açık doğrulama yığını (MVP'nin açık bileşenleri). İkisi aynı işi iki fona satmıyor.
