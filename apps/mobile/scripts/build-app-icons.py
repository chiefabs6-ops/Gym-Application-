"""
Generates the app icon set and splash image from the source artwork
(assets/branding/source-emblem.png: neon Spartan helmet + dumbbell on black).
Output: apps/mobile/assets/branding/

  icon.png                  1024² full icon (legacy launchers, Play listing)
  adaptive-foreground.png   1024² emblem inside the 66% adaptive-icon safe zone (black matches backgroundColor)
  adaptive-monochrome.png   1024² single-colour emblem for Android 13+ themed icons
  splash-icon.png           1024² emblem (shown centred on the black splash background)

app.json uses #000000 for the adaptive-icon and splash backgrounds so the artwork's black blends in.

Usage:  python scripts/build-app-icons.py
"""
from pathlib import Path

from PIL import Image, ImageOps

OUT = Path(__file__).resolve().parent.parent / "assets" / "branding"
SOURCE = OUT / "source-emblem.png"
SIZE = 1024
BLACK = (0, 0, 0, 255)


def emblem(scale: float) -> Image.Image:
    """Source artwork scaled to `scale` × canvas, centred on a black 1024² canvas."""
    src = Image.open(SOURCE).convert("RGBA")
    side = round(SIZE * scale)
    art = src.resize((side, side), Image.LANCZOS)
    canvas = Image.new("RGBA", (SIZE, SIZE), BLACK)
    off = (SIZE - side) // 2
    canvas.alpha_composite(art, (off, off))
    return canvas


def mono(img: Image.Image) -> Image.Image:
    """White silhouette whose alpha is the artwork's brightness (Android tints themed icons itself)."""
    lum = ImageOps.autocontrast(img.convert("L"))
    alpha = lum.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 1.6)))
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(alpha)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    # Full icon: launchers apply their own mask, so fill most of the tile.
    emblem(0.98).convert("RGB").save(OUT / "icon.png", optimize=True)

    # Adaptive foreground: the emblem spans ~85% of the source, scaled so it sits in the 66% safe zone.
    fg = emblem(0.78)
    fg.save(OUT / "adaptive-foreground.png", optimize=True)
    mono(fg).save(OUT / "adaptive-monochrome.png", optimize=True)

    # Splash: background colour comes from app.json.
    emblem(0.90).save(OUT / "splash-icon.png", optimize=True)

    for f in sorted(OUT.glob("*.png")):
        print(f"{f.name}: {f.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
