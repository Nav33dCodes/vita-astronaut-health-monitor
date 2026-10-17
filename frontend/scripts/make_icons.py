"""Turn the raw logo (red pulse on white) into a transparent mark + a full favicon set.

Usage (from the repo root): python -I frontend/scripts/make_icons.py docs/assets/logo-source.png frontend
"""
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

SRC, FRONTEND = Path(sys.argv[1]), Path(sys.argv[2])
APP, PUBLIC, ASSETS = FRONTEND / "src/app", FRONTEND / "public/icons", FRONTEND / "src/assets"
PUBLIC.mkdir(parents=True, exist_ok=True)
ASSETS.mkdir(parents=True, exist_ok=True)

UPSCALE = 4  # work at high resolution so every downscale is clean

rgb = Image.open(SRC).convert("RGB")
rgb = rgb.resize((rgb.width * UPSCALE, rgb.height * UPSCALE), Image.LANCZOS)

# --- 1. Brand colour: median of strongly coloured pixels -------------------------
small = Image.open(SRC).convert("RGB")
ink = [p for p in small.getdata() if min(p[1], p[2]) < 110]
FG = tuple(sorted(p[i] for p in ink)[len(ink) // 2] for i in range(3))
fg_floor = min(FG[1], FG[2])

# --- 2. Un-matte from white: alpha from how far green/blue drop below 255 ------------
gb = ImageChops.darker(rgb.getchannel("G"), rgb.getchannel("B"))
alpha = gb.point(lambda v: max(0, min(255, round((255 - v) * 255 / (255 - fg_floor)))))

# --- 3. Clean mark: morphological opening removes the thin sketch strokes -----------
k = 7 * UPSCALE | 1
clean = alpha.filter(ImageFilter.MinFilter(k)).filter(ImageFilter.MaxFilter(k))
clean = clean.filter(ImageFilter.GaussianBlur(UPSCALE * 0.6))  # restore soft anti-aliased edges
clean = clean.point(lambda v: 0 if v < 10 else v)

bbox = clean.getbbox()
clean = clean.crop(bbox)
W, H = clean.size

# Spike = columns whose stroke spans a large part of the height.
cols = []
for x in range(W):
    col = clean.crop((x, 0, x + 1, H)).getbbox()
    cols.append((col[3] - col[1]) if col else 0)
spike_x = [x for x, h in enumerate(cols) if h > 0.35 * H]
SPIKE_CX = (spike_x[0] + spike_x[-1]) / 2
SPIKE_CY = H / 2


def colourise(mask: Image.Image) -> Image.Image:
    layer = Image.new("RGBA", mask.size, FG + (0,))
    layer.putalpha(mask)
    return layer


def save_mark(height_px: int, name: str):
    """Transparent wide mark (with tails) for in-app use."""
    w = round(W * height_px / H)
    colourise(clean.resize((w, height_px), Image.LANCZOS)).save(ASSETS / name, optimize=True)


def square_mark(size: int, weight: int, spike_ratio: float) -> Image.Image:
    """Mark cropped to a square around the spike; tails run off the edges."""
    mask = clean.filter(ImageFilter.MaxFilter(weight * UPSCALE | 1)) if weight else clean
    side = round(H / spike_ratio)
    left, top = round(SPIKE_CX - side / 2), round(SPIKE_CY - side / 2)
    canvas = Image.new("L", (side, side), 0)
    canvas.paste(mask, (-left, -top))
    return canvas.resize((size, size), Image.LANCZOS)


def tile(size: int, weight: int, spike_ratio: float, radius: float, inset: float = 0.0) -> Image.Image:
    """White tile (rounded or full-bleed) with the red pulse; inset keeps maskable safe zone."""
    inner = round(size * (1 - 2 * inset))
    pulse = Image.new("L", (size, size), 0)
    pulse.paste(square_mark(inner, weight, spike_ratio), ((size - inner) // 2,) * 2)

    shape = Image.new("L", (size, size), 0)
    ImageDraw.Draw(shape).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * radius), fill=255)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)), mask=shape)
    out.alpha_composite(colourise(ImageChops.multiply(pulse, shape)))
    return out


# In-app mark: 3x the 32px display height for crisp retina rendering.
save_mark(96, "logo-mark.png")

# Favicons — heavier strokes at small sizes so the pulse stays legible.
ico_frames = [tile(s, w, r, 0.22) for s, w, r in ((16, 20, 0.92), (32, 12, 0.86), (48, 9, 0.8))]
ico_frames[2].save(APP / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico_frames[:2])
tile(512, 4, 0.74, 0.22).save(APP / "icon.png", optimize=True)

# iOS applies its own mask, so full-bleed (radius 0).
tile(180, 6, 0.72, 0).convert("RGB").save(APP / "apple-icon.png", optimize=True)

# PWA manifest icons; maskable keeps content in the 80% safe zone.
tile(192, 6, 0.76, 0.22).save(PUBLIC / "icon-192.png", optimize=True)
tile(512, 4, 0.74, 0.22).save(PUBLIC / "icon-512.png", optimize=True)
tile(512, 4, 0.74, 0, inset=0.1).save(PUBLIC / "icon-maskable-512.png", optimize=True)

print("brand colour:", "#%02x%02x%02x" % FG, "| mark aspect:", round(W / H, 3))
