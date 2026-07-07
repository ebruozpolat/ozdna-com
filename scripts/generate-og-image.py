#!/usr/bin/env python3
"""Generate default Open Graph image (1200×630) for ozDNA social previews."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
BG = (8, 13, 18)
ACCENT = (64, 224, 208)
TEXT = (240, 248, 255)
SUB = (139, 163, 184)

out = Path(__file__).resolve().parent.parent / "assets" / "og-image.png"
out.parent.mkdir(parents=True, exist_ok=True)

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

# Accent rail
draw.rectangle([0, 0, W, 6], fill=ACCENT)
draw.rectangle([80, 120, 88, H - 120], fill=(64, 224, 208, 40))

try:
    title_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 72)
    sub_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 32)
    tag_font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 24)
except OSError:
    title_font = ImageFont.load_default()
    sub_font = ImageFont.load_default()
    tag_font = ImageFont.load_default()

draw.text((120, 200), "ozDNA", font=title_font, fill=ACCENT)
draw.text((120, 290), "Vertical AI Infrastructure", font=sub_font, fill=TEXT)
draw.text(
    (120, 360),
    "Gateway · Routing · RAG · Cost Optimization",
    font=tag_font,
    fill=SUB,
)
draw.text((120, H - 80), "ozdna.com", font=tag_font, fill=SUB)

img.save(out, "PNG", optimize=True)
print(f"Wrote {out} ({out.stat().st_size} bytes)")
