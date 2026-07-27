#!/usr/bin/env python3
"""One-shot helper: inject OG/Twitter tags into oversight HTML pages (ledger B5)."""
from __future__ import annotations

import re
from pathlib import Path

OG_SNIPPET = """\
<meta property="og:type" content="website" />
<meta property="og:site_name" content="ozDNA" />
<meta property="og:title" content="{title}" />
<meta property="og:description" content="{desc}" />
<meta property="og:url" content="{url}" />
<meta property="og:image" content="https://ozdna.com/og.png" />
<meta property="og:image:alt" content="ozDNA" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="{title}" />
<meta name="twitter:description" content="{desc}" />
<meta name="twitter:image" content="https://ozdna.com/og.png" />
"""


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    for html in sorted(root.rglob("*.html")):
        if html.name == "404.html":
            continue
        text = html.read_text(encoding="utf-8")
        if "og:image" in text:
            print("skip (already has og)", html.relative_to(root.parent))
            continue
        title_m = re.search(r"<title>(.*?)</title>", text, re.S)
        desc_m = re.search(r'<meta name="description" content="(.*?)"', text, re.S)
        canon_m = re.search(r'<link rel="canonical" href="(.*?)"', text)
        if not (title_m and desc_m and canon_m):
            print("skip (missing meta)", html.relative_to(root.parent))
            continue
        title = re.sub(r"\s+", " ", title_m.group(1)).strip()
        desc = desc_m.group(1).strip()
        url = canon_m.group(1).strip()
        block = OG_SNIPPET.format(title=title, desc=desc, url=url)
        if re.search(r'<meta name="robots"[^>]*>', text):
            text2, n = re.subn(
                r'(<meta name="robots"[^>]*>\s*)', r"\1" + block, text, count=1
            )
        else:
            text2, n = re.subn(
                r'(<meta name="description" content="[^"]*"\s*/>\s*)',
                r"\1" + block,
                text,
                count=1,
            )
        if n != 1:
            print("FAILED insert", html.relative_to(root.parent))
            continue
        html.write_text(text2, encoding="utf-8")
        print("ok", html.relative_to(root.parent))


if __name__ == "__main__":
    main()
