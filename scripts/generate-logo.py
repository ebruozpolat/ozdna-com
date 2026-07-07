#!/usr/bin/env python3
"""Generate OZDNA monochrome logo SVGs and raster favicons."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"

# Overlapping circles (infinity / DNA cross-section)
CX1, CY, R = 22.0, 32.0, 20.0
CX2 = 42.0
OVERLAP_X = (CX1 + CX2) / 2


def in_circle(x: float, y: float, cx: float, cy: float, r: float) -> bool:
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r


def generate_dots(
    *,
    cx1: float = CX1,
    cy: float = CY,
    cx2: float = CX2,
    r: float = R,
    rings: int = 9,
    dots_per_ring_base: int = 8,
    spiral: float = 0.28,
    simplify: bool = False,
) -> list[tuple[float, float, float, float]]:
    """Return (x, y, radius, opacity) for each dot."""
    dots: list[tuple[float, float, float, float]] = []
    seen: set[tuple[int, int]] = set()

    for ring in range(1, rings + 1):
        t = ring / rings
        dist = t * r * 0.96
        count = max(4, int(dots_per_ring_base * t * (0.55 if simplify else 1.0)))
        for i in range(count):
            angle = (2 * math.pi * i / count) + ring * spiral
            for cx in (cx1, cx2):
                x = cx + dist * math.cos(angle)
                y = cy + dist * math.sin(angle)
                if not (in_circle(x, y, cx1, cy, r) or in_circle(x, y, cx2, cy, r)):
                    continue
                key = (int(round(x * 4)), int(round(y * 4)))
                if key in seen:
                    continue
                seen.add(key)

                overlap = in_circle(x, y, cx1, cy, r) and in_circle(x, y, cx2, cy, r)
                edge = min(
                    abs(math.hypot(x - cx1, y - cy) - r),
                    abs(math.hypot(x - cx2, y - cy) - r),
                )
                center_pull = 1.0 - min(1.0, math.hypot(x - OVERLAP_X, y - cy) / (r * 0.55))

                if overlap:
                    radius = (1.35 + center_pull * 0.85) * (0.75 if simplify else 1.0)
                    opacity = 0.72 + center_pull * 0.28
                else:
                    radius = (0.45 + (1.0 - t) * 0.55 + center_pull * 0.25) * (
                        0.8 if simplify else 1.0
                    )
                    opacity = 0.18 + (1.0 - t) * 0.35 + center_pull * 0.12
                    if edge < 1.4:
                        opacity *= 0.65

                if simplify and radius < 0.55:
                    continue
                dots.append((x, y, radius, min(1.0, opacity)))

    # Extra density in overlap along vertical axis
    if not simplify:
        for i in range(14):
            y_off = (i - 6.5) * 1.15
            for j in range(5):
                x = OVERLAP_X + (j - 2) * 1.05
                y = cy + y_off
                if in_circle(x, y, cx1, cy, r) and in_circle(x, y, cx2, cy, r):
                    key = (int(round(x * 4)), int(round(y * 4)))
                    if key not in seen:
                        seen.add(key)
                        br = 0.55 + abs(6.5 - i) * 0.04
                        dots.append((x, y, 1.1 + br * 0.5, 0.82 + br * 0.18))

    dots.sort(key=lambda d: d[3])
    return dots


def dots_to_svg(
    dots: list[tuple[float, float, float, float]],
    *,
    width: float,
    height: float,
    show_outlines: bool = False,
    cx1: float = CX1,
    cy: float = CY,
    cx2: float = CX2,
    r: float = R,
) -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:g} {height:g}" role="img">',
    ]
    if show_outlines:
        parts.append(
            f'  <circle cx="{cx1:g}" cy="{cy:g}" r="{r:g}" fill="none" '
            f'stroke="#FFFFFF" stroke-width="0.6" opacity="0.12"/>'
        )
        parts.append(
            f'  <circle cx="{cx2:g}" cy="{cy:g}" r="{r:g}" fill="none" '
            f'stroke="#FFFFFF" stroke-width="0.6" opacity="0.12"/>'
        )
    parts.append('  <g fill="#FFFFFF">')
    for x, y, radius, opacity in dots:
        parts.append(
            f'    <circle cx="{x:.3f}" cy="{y:.3f}" r="{radius:.3f}" opacity="{opacity:.3f}"/>'
        )
    parts.append("  </g>")
    parts.append("</svg>")
    return "\n".join(parts) + "\n"


def wordmark_svg() -> str:
    return """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 148 32" role="img" aria-label="OZDNA">
  <text x="0" y="24"
        font-family="DM Sans, Space Grotesk, system-ui, sans-serif"
        font-size="22"
        font-weight="500"
        fill="#FFFFFF"
        letter-spacing="8">OZDNA</text>
</svg>
"""


def lockup_svg(mark_dots: list[tuple[float, float, float, float]]) -> str:
    mark_w, mark_h = 48.0, 48.0
    scale = mark_h / 64.0
    gap = 10.0
    word_w = 148.0
    total_w = mark_w + gap + word_w
    total_h = 48.0

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_w:g} {total_h:g}" '
        f'role="img" aria-label="OZDNA">',
        f'  <g transform="translate(0 0) scale({scale:g})">',
        '    <g fill="#FFFFFF">',
    ]
    for x, y, radius, opacity in mark_dots:
        lines.append(
            f'      <circle cx="{x:.3f}" cy="{y:.3f}" r="{radius:.3f}" opacity="{opacity:.3f}"/>'
        )
    lines.extend(
        [
            "    </g>",
            "  </g>",
            f'  <text x="{mark_w + gap:g}" y="33"',
            '        font-family="DM Sans, Space Grotesk, system-ui, sans-serif"',
            '        font-size="22"',
            '        font-weight="500"',
            '        fill="#FFFFFF"',
            '        letter-spacing="8">OZDNA</text>',
            "</svg>",
        ]
    )
    return "\n".join(lines) + "\n"


def render_png(
    dots: list[tuple[float, float, float, float]],
    size: int,
    out_path: Path,
    *,
    bg: tuple[int, int, int, int] | None = None,
    pad: float = 4.0,
) -> None:
    img = Image.new("RGBA", (size, size), bg or (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    scale = (size - pad * 2) / 64.0
    ox = oy = pad

    for x, y, radius, opacity in dots:
        cx = ox + x * scale
        cy = oy + y * scale
        r = max(0.5, radius * scale)
        alpha = int(255 * opacity)
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(255, 255, 255, alpha),
        )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path, format="PNG")


def main() -> None:
    full_dots = generate_dots()
    favicon_dots = generate_dots(rings=6, dots_per_ring_base=6, simplify=True)

    (ASSETS / "logo-mark.svg").write_text(
        dots_to_svg(full_dots, width=64, height=64),
        encoding="utf-8",
    )
    (ASSETS / "logo-wordmark.svg").write_text(wordmark_svg(), encoding="utf-8")
    (ASSETS / "logo.svg").write_text(lockup_svg(full_dots), encoding="utf-8")
    favicon_dots_32 = [
        (x * 0.5, y * 0.5, radius * 0.5, opacity) for x, y, radius, opacity in favicon_dots
    ]
    (ROOT / "favicon.svg").write_text(
        dots_to_svg(favicon_dots_32, width=32, height=32),
        encoding="utf-8",
    )

    fav_png_dots = favicon_dots_32

    render_png(fav_png_dots, 16, ROOT / "favicon-16.png")
    render_png(fav_png_dots, 32, ROOT / "favicon-32.png")
    render_png(full_dots, 180, ASSETS / "apple-touch-icon.png", pad=8.0)

    img16 = Image.open(ROOT / "favicon-16.png")
    img32 = Image.open(ROOT / "favicon-32.png")
    img32.save(ROOT / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32)])

    print("Generated logo SVGs and favicon PNG/ICO assets")


if __name__ == "__main__":
    main()
