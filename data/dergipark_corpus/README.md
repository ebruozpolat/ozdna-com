# DergiPark Korpusu — ComplyDNA literatür taraması

**Amaç:** ComplyDNA için mevzuat/akademik literatür korpusu (5549, MASAK, AML/CFT, KVKK-finans).
**Durum (10 Tem 2026): TOHUM AŞAMASI.** `metadata.jsonl` içindeki 17 kayıt, arama motoru
indeksinden (WebSearch) toplandı — DergiPark, Claude Code'un uzak ortamından üç kanaldan da
erişilemedi (konteyner proxy'si CONNECT 403; WebFetch/Anthropic fetcher Cloudflare 403,
hem arama hem makale sayfalarında). DOI/özet/tam metin/kaynakça alanları bu yüzden boş.

## Tamamlama reçetesi — dergipark skill'i (Chrome'lu ortamda)

Skill kullanıcının kendi Chrome'unu sürdüğü için Cloudflare'e takılmaz. Lokal Cursor /
Claude in Chrome oturumunda (skill `~/.cursor/skills/dergipark` altında kurulu) şu istemi verin:

> DergiPark skill'ini kullan. Şu dört sorguyu ara: "suç gelirlerinin aklanması",
> "MASAK yükümlülükleri", "kara para aklama ile mücadele", "KVKK finansal sektör uyum".
> sortBy=newest, article_type=54 (araştırma makalesi), yıl ≥ 2020.
> Her sonucun başlık/yazar/dergi/yıl/DOI/özet/PDF linkini
> `data/dergipark_corpus/metadata.jsonl`'a JSONL olarak yaz (mevcut seed kayıtlarını
> URL üzerinden eşleştirip zenginleştir, `status:"seed"` → `"complete"`).
> Açık erişimli PDF'lerin tam metnini pdf_to_html ile çıkar,
> `data/dergipark_corpus/fulltext/<article_id>.txt` olarak kaydet.
> Kaynakçaları get_article_references ile çek, metadata'daki `references` alanına ekle.

## Notlar

- `fulltext/` şu an boş — PDF metinleri ancak skill koşusuyla gelir.
- **Telif:** DergiPark makalelerinin lisansları değişkendir (hepsi CC değildir). `fulltext/`
  içerikleri **repo'ya commit edilmeden önce** lisans kontrolü yapılmalı; varsayılan davranış
  tam metinleri commit ETMEMEK (yalnızca lokal analiz). metadata (başlık/özet linki) sorunsuz.
- `/data/*` netlify.toml'da edge'de 404'lu — bu klasör hiçbir zaman ozdna.com'da yayınlanmaz.
- 2020 öncesi görünen 2 kayıt not düşülerek tutuldu (referans değeri olabilir).
