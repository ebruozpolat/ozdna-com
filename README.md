# ozdna.com — ComplyDNA

ComplyDNA pilot landing + kaynak kod (`complydna/` API, demo UI, eval harness).

## Hosting kararı

| Yüzey | Nerede | Not |
|-------|--------|-----|
| **ozdna.com** (marketing) | **GitHub Pages** — `ebruozpolat/ozdna-com`, branch `main`, root `/` | ComplyDNA v2 landing (`index.html`) |
| **ComplyDNA API / demo** | Kurum içi / ayrı sunucu (`make serve` → `:8000/demo/`) | GitHub Pages Python çalıştırmaz |
| **Netlify (`ozdna-614`)** | **Kullanılmıyor** | Domain GitHub Pages'e taşınınca Netlify'dan `ozdna.com` kaldır |

Tek canonical marketing host: **GitHub Pages**. Çift DNS (Netlify + Pages) çakışmasını önlemek için Namecheap'te yalnızca GitHub kayıtları kalsın.

## Statik site dosyaları

| Dosya | Ne |
|-------|-----|
| `index.html` | ComplyDNA v2 landing (tek sayfa, gömülü CSS) |
| `og.png` | Sosyal paylaşım (1200×630) |
| `robots.txt` | Arama + AI crawler izinleri |
| `sitemap.xml` | Canonical URL |
| `llms.txt` | LLM ürün özeti (TR/EN) |
| `CNAME` | Custom domain: `ozdna.com` |

## Yayın (GitHub Pages)

1. `main` branch'e push.
2. GitHub → **Settings → Pages** → Deploy from branch → `main` / **`/ (root)`**.
3. **DNS (Namecheap)** — Netlify kayıtlarını kaldır, şunları ekle:

   ```
   A     @    185.199.108.153
   A     @    185.199.109.153
   A     @    185.199.110.153
   A     @    185.199.111.153
   CNAME www  ebruozpolat.github.io
   ```

4. Pages → **Enforce HTTPS** (DNS propagate sonrası, ~24 saat).

## ComplyDNA API (yerel / on-prem)

```bash
cd complydna
make setup && make bootstrap && make serve
# → http://localhost:8000/demo/
```

Detay: `complydna/README.md`
