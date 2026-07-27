# Founder ops — senin tarafındaki işler

*Son güncelleme: 2026-07-27. Agent’ın (Cursor/Claude) hesap/kimlik/yasal/ilişki gerektiren işleri yapamadığı liste. Kod tarafı `docs/session-deferrals-2026-07-27.md` ve `app/` altında ilerliyor.*

Bu dosya **ne yapman gerektiğini** ve **bitti sayılacak hali** anlatır. Site zaten Netlify’da canlı (`ozdna.com`); aşağıdaki “lansman” kapıları çoğunlukla **kamuya anlatı / PR / marka güvenliği** içindir, “site kapalı” anlamına gelmez.

---

## Hemen (deadline’lı veya lansman kapısı)

### 1. NGI Zero / NLnet — GenAI beyanı (zorunlu) + çağrı durumu
- **GenAI:** NLnet formunda “Did you use generative AI…?” **zorunlu**. Taslak AI ile yazıldıysa **Yes** seç; model + tarih + prompt + ham çıktı log’u ekle. Beyan etmeden göndermek → red. Hazır metin: `docs/GRANT-EU-NGI0.md` § Generative AI.
- **Commons Fund:** **Kapandı** (son çağrı 1 Haz 2026). 1 Ağu dosyalama hedefi düştü. Açık olanlar Taler / Fediversity — OriginDNA fit değil. Sonraki NLnet regular call’ı izle; taslağı sakla.
- **Bitti sayılır (şimdi):** GenAI log şablonunu okudun; bir sonraki NLnet başvurusunda Yes + log kullanırsın. Aug 2 PR pack yeniden gündemde (`docs/PR-AUG2.md`).

### 2. TezMakale kalıntı temizliği (ortakla)
- **Ne:** tezmakale.com’da ozDNA’ya zarar verecek kalıntıların (özellikle “OZDNA HUMAN”, Turnitin/humanizer bağlamı) kaldırıldığını **ortakla teyit** etmek.
- **Neden sen:** Ortak yönetim + marka ilişkisi hassas; agent siteye erişip “temiz” diyemez.
- **Kaynak:** `docs/oversight/brand-architecture.md` §4, `docs/oversight/roadmap-90d.md` Hafta 2–3.
- **Bitti sayılır:** Ortakla yazılı teyit (“kalıntı yok / şu URL’ler temiz”). Bundan sonra PR wave / “kamuya lansman anlatısı” açılır.
- **Not:** Oversight + marketing site **zaten online**; bu madde siteyi açmak için değil, **güvenli anlatı** için.

### 3. C2PA Conformance — cevap bekle / takip
- **Ne:** `conformance@c2pa.org` maili **8 Temmuz’da gönderildi** (ACTION_PLAN 0.1 WAITING). Level 1 maliyet + timeline + per-tenant end-entity cert fiyatı.
- **Neden sen:** Resmi muhatap sensin; cevap gelince sayıları sen onaylıyorsun.
- **Bitti sayılır:** Rakamlar `docs/ACTION_PLAN.md` 0.1 + `plan/06-COST-MODEL.md` içine işlendi. Cevap yoksa nazik follow-up (1–2 hafta aralık).

### 4. (Opsiyonel, hafif) 2 Ağustos PR günü
- **Ne:** Full pitch wave **deprioritize**; istersen `docs/PR-AUG2.md`’deki hazır alıntı / X–LinkedIn thread’i düşük eforla kullan.
- **Bitti sayılır:** İstersen bir thread + 1–2 outreach; Commons Fund kapandığı için artık NGI0’ya bağlı değil.

---

## Kısa vadede (marka + kanal)

### 5. ozDNA LinkedIn şirket sayfası
- **Ne:** Tek şirket sayfası (modül sayfası yok — brand-architecture §5). Footer’daki placeholder (`www.linkedin.com`) gerçek URL ile değişir.
- **Neden sen:** LinkedIn şirket oluşturma / doğrulama kişisel hesap ister.
- **Bitti sayılır:** Sayfa canlı + footer linkleri güncellendi (agent linki kodda bağlar; sayfayı sen açarsın).

### 6. Trademark tarama
- **Ne:** EUIPO + TÜRKPATENT’te `ozDNA`, `complyDNA`, `originDNA` (Nice 9, 42) çakışma taraması. Başvuru zaten var diye not düşülmüş; tarama sonuçlarını dosyala.
- **Neden sen:** Resmi portallar / vekil; hukuki karar.
- **Bitti sayılır:** Kısa not: “çakışma yok / şu risk var” → `docs/oversight/brand-architecture.md` veya ayrı memo.

### 7. Logo varyantları
- **Ne:** Tek logo + iki ürün için renk/ikon varyantı (ayrı logo değil). Canva kaynak tagline düzeltmesi (“Comply with the origins”) senin Canva tarafında.
- **Bitti sayılır:** Export’lar `assets/brand/`’e kondu (veya agent’a verdin).

### 8. Name-collision uzun vadeli karar (B8)
- **Ne:** Content-provenance `complyDNA`/`originDNA` ile oversight hattındaki aynı isimler — şu an path-split (`/products/*` vs `/oversight/`). Kalıcı isim birleştirme / ayırma **senin kararın**.
- **Bitti sayılır:** Yazılı karar (şimdilik path-split yeterli diyebilirsin).

---

## Teknik deploy — hesap sende, wiring agent

### 9. Cloudflare Workers (MVP API + anchor)
Kod hazır iskelet: `app/apps/api`, `app/apps/anchor` (placeholder D1 id). Production’a çıkmak için sende:
1. Cloudflare hesabı (özel/ücretsiz tier OK).
2. `wrangler login` (veya API token’ı GitHub/Secrets’a koyma — sen yönetirsin).
3. Gerçek D1: `wrangler d1 create ozdna` → `database_id`’yi wrangler.jsonc’lere yazdır (agent yazar).
4. Migrations uygula: `wrangler d1 migrations apply ozdna`.
5. (İleride) Base RPC + operator private key → sadece **Secrets**; asla repo’ya değil. Hard rule: kullanıcı fonu yok.
6. DNS: `api.ozdna.com` → Workers custom domain (Netlify’daki apex kalır).

**Bitti sayılır:** `https://api.ozdna.com/health` 200 + ledger B9 Workers kısmı kapanır.

### 10. Deploy / lansman sign-off’ları
- Netlify production zaten `main` → auto-deploy.
- Sen onaylarsın: “lansman anlatısını açabiliriz” (TezMakale teyidinden sonra) ve “Workers prod’a çıksın”.

---

## Orta vadede (iş geliştirme / hukuki)

### 11. Bir imzalı pilot
- **Ne:** En az 1 GenAI / compliance müşterisiyle yazılı pilot (ücretli veya flagship).
- **Neden sen:** Satış + sözleşme.
- **Bitti sayılır:** İmzalı LOI/Sözleşme veya fatura.

### 12. Linear tahta hijyeni — OZD-52 / OZD-53
- **Ne:** Linear’da hâlâ Todo görünen issue’lar ACTION_PLAN ile çelişiyor:
  - **OZD-52** waitlist → gerçekte DONE (site + formlar canlı).
  - **OZD-53** Aug 2 PR → ACTION_PLAN’da DEPRIORITIZED / NGI Zero öncelik.
- **Bitti sayılır:** Linear durumları güncellendi (Done / Canceled / Deferred + kısa comment).

### 13. Filecoin Open Grant yönü (karar)
- **Ne:** Public Provenance Archive katmanı — grant taslağı `docs/GRANT-FILECOIN.md` hazır; **yön henüz onaylanmadı**. Filing MVP sonrası (Kas–Ara).
- **Bitti sayılır:** “evet archive katmanı / hayır şimdilik yok” kararı ACTION_PLAN decisions log’una.

### 14. ozDNA işletme tüzel kişiliği (TBD)
- **Ne:** ozDNA için ayrı şirket henüz yok; domain şahsi, marka başvurusu var, TR şahıs işletmesi NGI için kullanılıyor. Find Below / AlignX karıştırılmaz.
- **Bitti sayılır:** Ne zaman / hangi ülke kurulacağına dair karar (şimdi “TBD leave” da karar).

### 15. Immortal MLRO gerçek prototip (B7)
- **Ne:** Oversight’ta HTML use-case var; “gerçek” MLRO prototipi repoda yok — sen veya ortak ürün verirsen entegre edilir.
- **Bitti sayılır:** Repo’ya konacak bir demo/repo linki veya “yalnızca pazarlama sayfası kalsın” kararı.

---

## Hızlı özet (bullet)

| Öncelik | İş | Kim |
|---|---|---|
| **P0 — GenAI / fon** | NLnet’te her başvuruda GenAI beyanı (Yes + log); Commons Fund kapalı — sonraki çağrıya sakla | Sen |
| **P0 — Aug 2 (opsiyonel)** | PR pack yeniden kullanılabilir (`PR-AUG2.md`) | Sen |
| **P0 — lansman anlatısı** | TezMakale kalıntı teyidi (ortak) | Sen + ortak |
| **P1** | C2PA mail cevabı / follow-up | Sen |
| **P1** | LinkedIn şirket sayfası | Sen (linki agent bağlar) |
| **P1** | Trademark tarama notu | Sen |
| **P1** | Cloudflare + D1 + Workers deploy onayı | Sen hesap; agent wiring |
| **P2** | Logo varyantları / Canva | Sen |
| **P2** | Linear OZD-52/53 temizliği | Sen (veya Linear erişimi ver) |
| **P2** | 1 pilot | Sen |
| **P2** | Name-collision uzun karar | Sen |
| **P3** | Filecoin archive kararı | Sen |
| **P3** | Entity formation | Sen |
| **P3** | Aug 2 hafif PR (opsiyonel) | Sen |
| **P3** | Immortal MLRO gerçek prototip | Sen / ortak |

---

## Agent’ın devam edebileceği (bu listede değil)

Kod/MVP dilimleri: `apps/web`, gerçek C2PA WASM verify, sign-digest, BaseAdapter + zincir, drizzle-kit, golden-image corpus, OpenAPI genişletme — bunlar hesap istemez; sen CF/secrets verdikçe deploy da hızlanır.
