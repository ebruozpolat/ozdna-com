# ozdna.com — Tek Sayfa Site Spesifikasyonu

## Amaç
Tek hedef kitleye tek iş: EU hibe değerlendiricisi veya regüle kurum yöneticisi 60 saniyede (1) ne yaptığımızı, (2) hangi maddeyi karşıladığımızı, (3) canlı kanıtı görsün ve audit talebi bıraksın.

## Teknik
- Statik, tek sayfa + iki modül alt sayfası (/comply, /origin) + /use-cases/immortal-mlro
- Stack: Astro veya Next.js static export — Claude Code seçsin, gerekçelendirsin
- EN birincil (`/`), TR (`/tr`) ikincil; hreflang doğru kurulacak
- Lighthouse ≥95, form dışında JS minimum, analytics: yalnızca privacy-friendly (Plausible tarzı)
- Görsel dil: koyu zemin, mühendislik estetiği; "startup gradient" klişesinden kaçın. Frontend-design skill'i uygulanacak.

## Sayfa Yapısı (ana sayfa, sıralı)
1. **Hero** — Tek cümle konum (positioning.md'deki EN cümle birebir) + tek CTA: "Request a compliance audit"
2. **Problem** — 3 kısa blok: AI harcaması riske orantısız / gözetim manuel / kanıt dağınık
3. **Nasıl çalışır** — 4 adımlı akış diyagramı: Classify → Route → Oversee → Prove (DT → Route → Council → Ledger)
4. **AI Act eşlemesi** — ai-act-mapping.md'den tablo: bileşen ↔ madde. Bu bölüm sitenin ayırt edici parçası; öne çıkar.
5. **Canlı kanıt** — DT motoru sahada: Türkçe AI dedektör doğrulaması (brand-architecture.md §4'teki izinli cümle kalıbıyla; TezMakale adı linklenmez, karar kullanıcıda)
6. **Kim için** — KVHS / CASP / regüle fintech; KOBİ dili KULLANILMAZ
7. **CTA tekrar** — audit talep formu (ad, kurum, e-posta, "hangi AI sistemleri" serbest metin). Form verisi: başlangıçta e-posta iletimi yeterli, CRM yok.
8. **Footer** — AlignX Partners bağlantısı ("an AlignX Partners product"), gizlilik, iletişim. Sosyal: yalnızca LinkedIn.

## Modül Sayfaları
- /comply: DT sınıflandırma + Council mimarisi; Art. 9/14 detayı; "how oversight becomes software" anlatısı
- /origin: Ledger yapısı (append-only, hash-chained), örnek attestation çıktısı (redakte edilmiş mock), Art. 12/13 detayı
- /use-cases/immortal-mlro: mevcut React prototipten devşirme; Solana/onchain ifadeleri TAMAMEN temizlenmiş

## İçerik Kuralları
- CLAUDE.md'deki 8 kritik kural geçerli
- Tarihler: Art. 50 → 2 Ağu 2026; Annex III → 2 Ara 2027; gömülü → 2 Ağu 2028
- "Guarantee/ensure compliance" gibi mutlak vaat YOK — "implements / supports / evidences" fiilleri
- Rakip adı anılmaz

## Kabul Kriterleri
- [ ] Tek cümle konum hero'da birebir
- [ ] AI Act eşleme tablosu doğru maddelerle
- [ ] Hiçbir sayfada yasaklı kelime (BrainStack, Solana, blockchain, humanizer, OZDNA yazım varyantları) — build'e grep kontrolü ekle
- [ ] EN/TR paritesi
- [ ] Form çalışıyor, mobilde kusursuz
