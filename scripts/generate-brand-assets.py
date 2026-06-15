#!/usr/bin/env python3
"""Generate ozDNA brand SVG assets and PNG/ICO favicons."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

PINK = "#E8567A"
TEAL = "#40E0D0"
PURPLE = "#8B82A8"
CHARCOAL = "#2D3436"
WHITE = "#F0F3F6"


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def lerp_color(a: str, b: str, t: float) -> str:
    ar, ag, ab = hex_to_rgb(a)
    br, bg, bb = hex_to_rgb(b)
    r = int(ar + (br - ar) * t)
    g = int(ag + (bg - ag) * t)
    b_ = int(ab + (bb - ab) * t)
    return f"#{r:02X}{g:02X}{b_:02X}"


def mark_gradient_color(x: float, y: float, size: float) -> str:
    nx, ny = x / size, y / size
    tl = 1 - math.hypot(nx, ny)
    br = 1 - math.hypot(1 - nx, 1 - ny)
    bl = 1 - math.hypot(nx, 1 - ny)
    tr = 1 - math.hypot(1 - nx, ny)
    center = 1 - math.hypot(nx - 0.5, ny - 0.5) * 1.4
    pink_w = max(tl, br)
    teal_w = max(bl, tr)
    if center > 0.35:
        return lerp_color(PINK if pink_w > teal_w else TEAL, PURPLE, min(1.0, center))
    if pink_w > teal_w:
        return lerp_color(PINK, PURPLE, 0.25 + pink_w * 0.2)
    return lerp_color(TEAL, PURPLE, 0.25 + teal_w * 0.2)


def in_figure_eight(x: float, y: float, cx: float, cy: float, r: float) -> bool:
    left = (x - (cx - r * 0.55)) ** 2 + (y - cy) ** 2 <= r**2
    right = (x - (cx + r * 0.55)) ** 2 + (y - cy) ** 2 <= r**2
    return left or right


def stipple_dots(
    size: float,
    spacing: float,
    dot_r: float,
    cx: float,
    cy: float,
    loop_r: float,
    *,
    jitter: float = 0.0,
) -> str:
    dots: list[str] = []
    cols = int(size / spacing) + 2
    for row in range(cols):
        for col in range(cols):
            x = col * spacing + spacing * 0.5
            y = row * spacing + spacing * 0.5
            if row % 2:
                x += spacing * 0.5
            if jitter:
                x += math.sin(row * 2.1 + col * 1.7) * jitter
                y += math.cos(row * 1.9 + col * 2.3) * jitter
            if not in_figure_eight(x, y, cx, cy, loop_r):
                continue
            color = mark_gradient_color(x, y, size)
            opacity = 0.55 + 0.35 * (1 - abs(x - cx) / (loop_r * 1.1))
            dots.append(
                f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{dot_r:.2f}" '
                f'fill="{color}" opacity="{opacity:.2f}"/>'
            )
    return "\n    ".join(dots)


def mark_defs(size: float, id_prefix: str = "") -> str:
    pid = f"{id_prefix}" if id_prefix else ""
    return f"""  <defs>
    <linearGradient id="{pid}mark-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{PINK}"/>
      <stop offset="28%" stop-color="{TEAL}"/>
      <stop offset="50%" stop-color="{PURPLE}"/>
      <stop offset="72%" stop-color="{TEAL}"/>
      <stop offset="100%" stop-color="{PINK}"/>
    </linearGradient>
    <clipPath id="{pid}mark-clip">
      <circle cx="{size * 0.34:.2f}" cy="{size * 0.5:.2f}" r="{size * 0.28:.2f}"/>
      <circle cx="{size * 0.66:.2f}" cy="{size * 0.5:.2f}" r="{size * 0.28:.2f}"/>
    </clipPath>
  </defs>"""


def mark_group(size: float, id_prefix: str = "", *, spacing: float = 3.2, dot_r: float = 0.85) -> str:
    cx, cy, loop_r = size * 0.5, size * 0.5, size * 0.28
    dots = stipple_dots(size, spacing, dot_r, cx, cy, loop_r)
    pid = f"{id_prefix}" if id_prefix else ""
    return f"""  <g clip-path="url(#{pid}mark-clip)">
    <rect width="{size}" height="{size}" fill="url(#{pid}mark-grad)"/>
    {dots}
  </g>"""


def wordmark_paths(fill: str) -> str:
    return f"""  <g fill="{fill}" aria-hidden="true">
    <!-- O with center dot -->
    <path d="M18 4 C8.06 4 0 12.06 0 22 C0 31.94 8.06 40 18 40 C27.94 40 36 31.94 36 22 C36 12.06 27.94 4 18 4 Z M18 10 C24.63 10 30 15.37 30 22 C30 28.63 24.63 34 18 34 C11.37 34 6 28.63 6 22 C6 15.37 11.37 10 18 10 Z"/>
    <circle cx="18" cy="22" r="3.2"/>
    <!-- Z with horizontal gap -->
    <path d="M44 4 H76 V10 H54 L76 30 V36 H44 V30 H66 L44 10 Z M44 18 H76 V22 H44 Z" fill-rule="evenodd"/>
    <!-- D: solid stem, gap through bowl -->
    <path d="M84 4 H96 V36 H84 Z"/>
    <path d="M96 4 H112 C124.15 4 134 13.85 134 20 C134 26.15 124.15 36 112 36 H96 Z M96 10 V30 H112 C120.84 30 128 24.84 128 20 C128 15.16 120.84 10 112 10 Z M96 18 H134 V22 H96 Z" fill-rule="evenodd"/>
    <!-- N -->
    <path d="M142 4 H154 V22 L170 4 H182 V36 H170 V18 L154 36 H142 Z"/>
    <!-- A: inverted V, no crossbar -->
    <path d="M198 36 L210 4 H216 L208 24 L200 36 Z"/>
    <path d="M208 24 L216 4 H222 L230 36 L222 36 L214 18 Z"/>
  </g>"""


def write_logo_mark() -> None:
    size = 64
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="OZDNA mark">
{mark_defs(size)}
{mark_group(size)}
</svg>
"""
    (ASSETS / "logo-mark.svg").write_text(svg)


def write_logo_wordmark() -> None:
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 230 40" role="img" aria-label="OZDNA">
{wordmark_paths(CHARCOAL)}
</svg>
"""
    (ASSETS / "logo-wordmark.svg").write_text(svg)


def write_logo_combined() -> None:
    mark_size = 40
    gap = 10
    word_w = 230
    total_w = mark_size + gap + word_w
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w} 40" role="img" aria-label="OZDNA">
  <svg x="0" y="0" width="{mark_size}" height="{mark_size}" viewBox="0 0 64 64">
{mark_defs(64, "nav-")}
{mark_group(64, "nav-")}
  </svg>
  <svg x="{mark_size + gap}" y="0" width="{word_w}" height="40" viewBox="0 0 230 40">
{wordmark_paths(WHITE)}
  </svg>
</svg>
"""
    (ASSETS / "logo.svg").write_text(svg)


def write_favicon_svg() -> None:
    size = 32
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" role="img" aria-label="OZDNA">
{mark_defs(size, "fav-")}
{mark_group(size, "fav-", spacing=4.5, dot_r=1.1)}
</svg>
"""
    (ROOT / "favicon.svg").write_text(svg)


def draw_mark_pil(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size / 2, size / 2
    loop_r = size * 0.28
    offset = loop_r * 0.55
    spacing = max(2.5, size / 10)
    dot_r = max(0.8, size / 28)

    for row in range(int(size / spacing) + 2):
        for col in range(int(size / spacing) + 2):
            x = col * spacing + spacing * 0.5
            y = row * spacing + spacing * 0.5
            if row % 2:
                x += spacing * 0.5
            if not in_figure_eight(x, y, cx, cy, loop_r):
                continue
            color = mark_gradient_color(x, y, size)
            r, g, b = hex_to_rgb(color)
            opacity = int(180 + 60 * (1 - abs(x - cx) / (loop_r * 1.1)))
            draw.ellipse(
                [x - dot_r, y - dot_r, x + dot_r, y + dot_r],
                fill=(r, g, b, min(255, opacity)),
            )

    # Soft gradient underlay for small sizes
    if size <= 32:
        for loop_cx in (cx - offset, cx + offset):
            for angle in range(0, 360, 12):
                rad = math.radians(angle)
                px = loop_cx + math.cos(rad) * loop_r * 0.85
                py = cy + math.sin(rad) * loop_r * 0.85
                color = mark_gradient_color(px, py, size)
                r, g, b = hex_to_rgb(color)
                draw.ellipse(
                    [px - 1.2, py - 1.2, px + 1.2, py + 1.2],
                    fill=(r, g, b, 40),
                )

    return img


def write_raster_icons() -> None:
    draw_icon = draw_mark_pil
    draw_icon(16).save(ROOT / "favicon-16.png", format="PNG")
    draw_icon(32).save(ROOT / "favicon-32.png", format="PNG")
    draw_icon(180).save(ASSETS / "apple-touch-icon.png", format="PNG")
    draw_icon(512).save(ASSETS / "icon-512.png", format="PNG")

    img16 = Image.open(ROOT / "favicon-16.png")
    img32 = Image.open(ROOT / "favicon-32.png")
    img32.save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])
    img16.close()
    img32.close()


def main() -> None:
    ASSETS.mkdir(parents=True, exist_ok=True)
    write_logo_mark()
    write_logo_wordmark()
    write_logo_combined()
    write_favicon_svg()
    write_raster_icons()
    print("Generated brand SVGs and favicon PNG/ICO assets")


if __name__ == "__main__":
    main()
