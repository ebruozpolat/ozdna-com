# ozDNA — Marka Mimarisi

> **DÜZELTME (kurucu kararı — bağlayıcı):** Aşağıdaki §1 hiyerarşisi "AlignX Partners └── ozDNA" **artık geçerli değildir.** ozDNA kendi başına çatı markasıdır; AlignX Partners kurucunun ayrı, şahsi UK danışmanlık işidir (alignxpartners.com) ve ozDNA'nın çatısı değildir. Oversight ürünü `ozdna.com/oversight` altında yayınlanır. Ayrıntı: `docs/oversight/README.md`.

## 0. Canlı ürün mimarisi — yol ayrımı (path-split)

İki ürün hattı **tek ozDNA / ozdna.com çatısı** altında, **yol ayrımıyla** ayrılır. Bu, ertelenmiş veya kurucu bekleyen bir karar değildir — **mevcut (canlı) ürün mimarisidir.** Yeni ürün adı uydurulmaz; mevcut `complyDNA` / `originDNA` etiketleri hat bağlamında okunur.

| Hat | Kamu yolları | Repo kaynağı |
|---|---|---|
| **content-provenance** | `/products/*`, `/verify` (+ kök marka `/`) | `products/`, `verify/`, `plan/`, `docs/BLUEPRINT.md` |
| **AI-oversight** | `/oversight/*` | `oversight/`, `docs/oversight/` |

Aynı isimler iki hatta farklı anlam taşır (content-provenance: RegTech / C2PA; oversight: DT+Council / Ledger+Attestation). Çözüm yolu **yeni isim değil**, path-split'tir.

## 1. Hiyerarşi
```
AlignX Partners (tüzel kişi, danışmanlık, hibe başvurucusu — alignxpartners.com)
└── ozDNA (ürün çatı markası — ozdna.com)
    ├── complyDNA by ozDNA  → ozdna.com/comply
    │     ├── DT 5.0 (sınıflandırma motoru)
    │     └── Council (oversight runtime; eski BrainStack — ad emekli)
    └── originDNA by ozDNA  → ozdna.com/origin
          └── Ledger + Attestation
```

## 2. Adlandırma Kuralları
- Yazım: **ozDNA** — her yerde, her dilde. Varyant yasak.
- Alt markalar daima "by ozDNA" ekiyle; tek başına logo/domain/sosyal hesap açılmaz.
- "ÖZDNA" yalnızca köken hikâyesinde: "öz (self/essence) + DNA — Türkçe kökenli, Avrupa'ya inşa edildi" tarzı tek cümle.
- Telaffuz standardı: "oz-D-N-A" (İngilizce). Materyallerde fonetik açıklama gerekmiyor ama sesli sunumlarda tutarlılık.

## 3. Emekli / Devşirilen Varlıklar
| Eski varlık | Yeni durumu |
|---|---|
| BrainStack | Ad emekli. Kod açık kaynak çekirdek olarak GitHub'da kalabilir (README'de ozDNA bağlantısı OLMADAN veya "core engine of ozDNA Council" tek satırıyla — karar: kullanıcıya sor). Kullanıcıya görünen yüzeylerde geçmez. |
| Immortal MLRO | Demo varlığı → ozdna.com use-case sayfası ("autonomous compliance agent on Council runtime"). Kendi markası/domain'i yok. |
| originDNA (Belgrad demo) | Kalıcı modül adına terfi etti; Solana anchor katmanı KALDIRILDI, hash-chained log ile değiştirildi. |
| ÖZDNA DT 5.0 | complyDNA içinde "DT 5.0" motor sürüm adı olarak yaşar. |

## 4. TezMakale İlişkisi (HASSAS)
- TezMakale ortak yönetiminde ayrı bir üründür; ozDNA kurumsal materyallerinde İŞ ORTAKLIĞI olarak sunulmaz.
- İzin verilen tek kullanım: teknik doğrulama kanıtı. Örnek cümle: "DT motoru, Türkçe akademik metinde AI tespiti yapan canlı bir üründe (%X doğruluk, ödeme alan, Trustpilot 4.2) sahada doğrulanmıştır."
- YASAK: humanizer/parafraz/Turnitin bağlamında herhangi bir referans; "OZDNA HUMAN" adının herhangi bir yerde geçmesi.
- Ön koşul: tezmakale.com kalıntı temizliği (ayrı rapor: tezmakale-site-denetim-raporu.md) teyit edilmeden ozDNA kamuya açık lansmanı yapılmaz.

## 5. Yapılacak Marka İşleri
- [ ] ozdna.com domain durumu kontrol + alınmadıysa al (alternatifler: ozdna.ai, ozdna.io — yalnızca redirect olarak)
- [ ] EUIPO + TÜRKPATENT trademark taraması: "ozDNA", "complyDNA", "originDNA" (Nice sınıf 9, 42)
- [ ] originDNA/complyDNA için mevcut domain-trademark çakışması taraması
- [ ] Logo: tek logo + iki modül için renk/ikon varyantı (ayrı logo değil)
- [ ] LinkedIn: yalnızca ozDNA şirket sayfası (modüller için sayfa açılmaz)
