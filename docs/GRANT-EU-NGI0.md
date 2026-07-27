# AB Projesi — NGI Zero Commons Fund Başvuru Taslağı (OriginDNA)

> **DURUM GÜNCELLEMESİ (27 Tem 2026):** NGI Zero Commons Fund’un **13. ve son çağrısı 1 Haziran 2026’da kapandı** — [nlnet.nl/commonsfund](https://nlnet.nl/commonsfund/) yeni başvuru almıyor. Şu an açık olanlar yalnızca **NGI TALER** ve **NGI Fediversity** (son tarih 1 Ağu 2026). OriginDNA bu iki temaya uymaz; bu taslak **arşiv / sonraki NLnet açık çağrı** için saklanır. Aşağıdaki **GenAI beyanı** her NLnet formunda zorunlu kalır.

**Önceki hedef (eski):** 1 Ağustos 2026 dosyalama — Commons Fund için artık geçerli değil.
**Ürün çerçevesi (founder, 10 Tem):** *"EU AI Act Madde 50 içerik işaretleme için içerik kökeni API'si…"* Tespit sınıflandırıcısı yok.
**✅ Founder kararları (10 Tem 2026):** (1) Başvuran = TR şahıs işletmesi. (2) FOSS = Açık Doğrulama Yığını. (3) Aug 2 PR, NGI0 lehine geri çekilmişti — Commons Fund kapanınca PR pack yeniden kullanılabilir.

---

## Neden bu program (alternatiflere karşı)

| Program | Uygunluk | Neden / neden değil |
|---|---|---|
| **NGI Zero Commons Fund** ❌ kapandı | 13. ve son çağrı **1 Haz 2026** kapandı; yeni başvuru yok. | Taslak `GRANT-EU-NGI0.md` arşivde; sonraki NLnet regular call / Open Internet Stack izlenir. GenAI beyanı her NLnet formunda zorunlu. |
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

I run a registered consultancy in Türkiye and have 5+ years of professional experience in communications, distribution and SEO in the financial-technology industry. I own and operate ozdna.com, where the OriginDNA landing, segmented waitlist and bilingual (EN/TR) site are already live, backed by an adversarially-reviewed technical build plan for the October 2026 MVP. Development is executed by my team using AI-assisted engineering with contract engineering support; the project's technical architecture, algorithms (DCT pHash, PDQ-256, C2PA integration) and milestones are fully specified and public-ready. I remain accountable for all technical decisions and for the accuracy of this proposal.

---

## Generative AI — form alanları (ZORUNLU)

Kaynak: [NLnet GenAI Policy v1.1](https://nlnet.nl/foundation/policies/generativeAI/) (8 Ara 2025 / 26 Oca 2026). Beyan etmeden göndermek → **red + itibar riski**. Küçük spellcheck log gerektirmez; taslak/çeviri/özet **log ister**.

### Form seçimi

| Alan | Cevap |
|---|---|
| Did you use generative AI in writing this proposal? | **I have used generative AI in writing this proposal** |
| (Hayır seçeneği) | Yalnızca metni baştan sona kendin yazdıysan — bu taslak AI yardımıyla üretildiği için **hayır deme** |

### Which model / what for / prompt provenance log (form text field)

Aşağıyı forma yapıştır; tarih/saat ve eksik prompt’ları dosyalamadan önce kendi oturumuna göre doldur/düzelt:

```
DISCLOSURE (NLnet GenAI Policy v1.1)

Model(s): Anthropic Claude (Claude Code / Cursor agent sessions), used as a drafting assistant.
Purpose: Drafting and structuring English proposal fields from our existing technical corpus
(BLUEPRINT, plan/, ACTION_PLAN). Not used to invent product claims; numbers and dates come
from our ratified plan. Founder (Ebru Özpolat) reviews, edits, and remains accountable for
every submitted field.

Session history:
- 2026-07-10 — Initial NGI0 Commons Fund draft authored with Claude assistance into
  docs/GRANT-EU-NGI0.md (full raw prompt transcript from that session was not retained
  as a separate log at the time).
- 2026-07-27 — GenAI disclosure section added; proposal status updated after Commons Fund
  call closure; founder final edit pass: {FOUNDER: date/time + note what you changed}.

Human intellectual contribution: product thesis, hard rules (no token, no custody, no
detection classifiers, images-only v1), budget milestones, applicant identity, and final
wording sign-off are founder decisions. AI output was treated as a draft, not as
submissible work without review.

If a full unedited prompt/output pair for the 2026-07-10 session cannot be reconstructed,
the complete current proposal text in this submission is the post-edit human-accountable
version. Any further GenAI polish before submit will be appended below with date, model,
prompt, and unedited output.

--- APPEND NEW SESSIONS BELOW (required for any GenAI use after this note) ---
Date/time (CEST):
Model + version:
Prompt:
Unedited output:
```

### Opsiyonel ek
Form “Optional files containing prompts…” alanına: bu bölümün kopyası + (varsa) Cursor/Claude export. Toplam ek ≤ 50 MB.

### Fonlandıktan sonra (proje yürütme — ayrıca zorunlu)
Politika başvuru + **fonlanan iş** için geçerli:
- README’de GenAI kullanım duruşu (boilerplate / tests / docs vs. kritik crypto path).
- Madde etkileyen kodda: model + prompt özeti (commit mesajı veya eşdeğer log).
- Saf AI çıktısı, insan katkısı olmadan, hibe ödemesine konu edilemez.
- OriginDNA ürün kuralı ayrı: v1’de AI *detection classifier* yok; GenAI *yardımcı mühendislik* ile karıştırma.

---

## Dosyalama kontrol listesi

**Commons Fund (kapalı):** Yeni başvuru yok (son çağrı 1 Haz 2026). Bu dosya arşiv.

**Sonraki NLnet açık çağrı / başka fon:**
1. https://nlnet.nl/propose/ → açık fonu seç.
2. EN alanları kopyala; Abstract karakter sınırını kontrol et.
3. **GenAI:** yukarıdaki seçim + log — atlama.
4. Relevant experience’ı kendi sesinle son oku.
5. İletişim: hello@ozdna.com (form sahibiyle tutarlı).
6. Gönderim sonrası ACTION_PLAN’a FILED + tarih.

## İç notlar (başvuruya girmez)

- GenAI politika: https://nlnet.nl/foundation/policies/generativeAI/
- Commons Fund kapandı: https://nlnet.nl/commonsfund/ (13. çağrı, 1 Haz 2026).
- Şu an açık: NGI TALER, NGI Fediversity — OriginDNA fit değil; yaz sonrası Open Internet Stack / regular call’ı izle.
- "Blockchain" kelimesi bilinçli kullanılmadı.
- Filecoin taslağı ayrı (arşiv katmanı); aynı işi iki fona satmıyoruz.
