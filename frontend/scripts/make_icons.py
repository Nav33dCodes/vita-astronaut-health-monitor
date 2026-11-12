"""Render the VITA "V" monogram (matches src/app/icon.svg) into the PNG icon set.

Usage (from frontend/): python -I scripts/make_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
PUBLIC, APP = ROOT / "public/icons", ROOT / "src/app"
PUBLIC.mkdir(parents=True, exist_ok=True)

INK, WHITE, ACCENT = (17, 17, 20, 255), (255, 255, 255, 255), (91, 108, 255, 255)
SS = 4  # supersampling for clean edges


def monogram(size: int, *, rounded: bool, inset: float = 0.0) -> Image.Image:
    s = size * SS
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if rounded:
        d.rounded_rectangle((0, 0, s - 1, s - 1), radius=int(s * 0.22), fill=INK)
    else:
        d.rectangle((0, 0, s, s), fill=INK)
    # Geometry from the 64-unit SVG, shrunk toward the centre by `inset` for maskable safe zones.
    k = s / 64 * (1 - inset)
    off = s * inset / 2
    p = lambda x, y: (off + x * k, off + y * k)
    w = int(6.5 * k)
    pts = [p(19, 18), p(32, 47), p(45, 18)]
    d.line(pts, fill=WHITE, width=w, joint="curve")
    for x, y in pts:
        d.ellipse((x - w / 2, y - w / 2, x + w / 2, y + w / 2), fill=WHITE)
    cx, cy = p(50, 45)
    r = 4 * k
    d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ACCENT)
    return img.resize((size, size), Image.LANCZOS)


monogram(192, rounded=True).save(PUBLIC / "icon-192.png")
monogram(512, rounded=True).save(PUBLIC / "icon-512.png")
monogram(512, rounded=False, inset=0.3).save(PUBLIC / "icon-maskable-512.png")
monogram(180, rounded=False).save(APP / "apple-icon.png")
print("icons written")
