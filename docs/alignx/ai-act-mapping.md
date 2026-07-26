# ozDNA ↔ EU AI Act Eşlemesi (Site ve Hibe Metinlerinin Kaynağı)

## Bileşen Eşlemesi
| ozDNA bileşeni | AI Act maddesi | Eşleme gerekçesi |
|---|---|---|
| DT 5.0 sınıflandırma | Art. 9 — Risk yönetim sistemi | Sistem/iş yükünün risk katmanına oturtulması; sürekli, yaşam döngüsü boyunca |
| Council (oylama + veto + fail-closed judge) | Art. 14 — İnsan gözetimi | Gözetim mekanizmasının yazılımsal uygulanması; durdurma/veto yetkisi, otomasyona aşırı güvenin engellenmesi |
| Ledger (hash-chained, append-only) | Art. 12 — Kayıt tutma | Otomatik olay kaydı; izlenebilirlik, sonradan değiştirilemezlik |
| Attestation çıktısı | Art. 13 — Şeffaflık | Deployer'a/denetçiye kararın gerekçesini ve sınırlarını anlaşılır sunma |
| Risk-orantılı yönlendirme (genel) | Recital'lerdeki risk-based approach | Regülasyonun temel mantığının runtime'a çevrilmesi — anlatının çatı cümlesi |

## Zaman Çizelgesi (Omnibus sonrası — güncel, Temmuz 2026)
| Yükümlülük | Tarih | ozDNA ilgisi |
|---|---|---|
| Art. 50 şeffaflık yükümlülükleri | 2 Ağustos 2026 | Limited-risk sistemlerde bildirim; attestation çıktısı destekler |
| Annex III yüksek-risk alanları (biyometri, kritik altyapı, eğitim, istihdam vb.) | 2 Aralık 2027 | Ana pazar penceresi: kurumların hazırlık dönemi = satış dönemi |
| Ürüne gömülü sistemler (makine vb.) | 2 Ağustos 2028 | İkincil |
| GPAI (piyasada olan modeller) | 2 Ağustos 2027 | Dolaylı |

## Anlatı Notları
- 2027 penceresi hibe başvurusunda AVANTAJ olarak kurgulanır: "uyum tarihine kadar aracı olgunlaştırma" net zaman ufku verir.
- "Compliance guarantee" dili YASAK; doğru fiiller: *implements, operationalises, evidences, supports*.
- Türkiye bağlamı: bağlayıcı ulusal AI kanunu yok; Brussels Effect üzerinden EU kullanıcısına hizmet veren TR kurumları kapsama girer — KVHS/CASP anlatısının köprüsü bu.
- Dual-use hassasiyeti: Türkiye Horizon Europe ortağı olmakla birlikte dual-use çağrılarında kısıtlı; tüm metinlerde "compliance & oversight" çerçevesi korunur, "security" çerçevesine kayılmaz.

## Doğrulama Notu
Madde numaraları ve tarihler bu dosya yazıldığı tarihte (25 Tem 2026) günceldir. Omnibus trilogue süreci resmi yayımla sonuçlanmadan yayına alınacak her materyalde tarihler tekrar doğrulanmalıdır — Claude Code: yayın öncesi görevlerde bu dosyayı otorite kabul et ama kullanıcıya "tarihleri son kez doğrulayalım mı" diye sormayı unutma.
