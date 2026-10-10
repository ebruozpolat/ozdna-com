# docs/strategy — ürün karar kayıtları (PDR)

Bu klasör, ozDNA ürün kararlarının **tek yaşayan kaynağıdır**. Her ürün için tek bir PDR dosyası tutulur; yeni kararlar yeni dosya açılarak değil, **aynı dosya sürümlenerek** işlenir.

| Dosya | Ürün | Güncel sürüm |
|---|---|---|
| `CONTRACT-DNA-PDR.md` | Contract DNA (Deal Diff) — AI mimarisi ve fiyatlandırma | v1.0 (10 Ekim 2026) |

## Sürümleme kuralı

1. **Dosya adı sabit kalır** (`CONTRACT-DNA-PDR.md`); geçmiş sürümler git geçmişinde durur, `git log -p docs/strategy/CONTRACT-DNA-PDR.md` ile görülür.
2. Başlıktaki **Sürüm** ve **Tarih** alanları güncellenir; dosya sonundaki **Sürüm geçmişi** tablosuna bir satır eklenir.
3. **Minör (v1.1, v1.2…):** bir [HİPOTEZ]/[AÇIK] maddesinin netleşmesi, rakam güncellemesi, ölçüm sonucu eklenmesi.
   **Majör (v2.0…):** bir [YÖN KARARI]'nın değişmesi, paket yapısının veya ana model stratejisinin yeniden kurulması.
4. Bir madde ölçümle teyit edildiğinde etiketi değişir (ör. [HİPOTEZ] → [YÖN KARARI]) ve sürüm geçmişinde dayanağı (pilot, benchmark, DPA vb.) kısaca yazılır.
5. Kapanan açık kararlar §10 tablosundan silinmez; ilgili bölüme taşınır ve sürüm geçmişinde not düşülür.
6. Commit mesajı: `strategy(contract-dna): vX.Y — <kısa özet>`.
