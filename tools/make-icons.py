#!/usr/bin/env python3
"""Render apple-touch-icon.png from the same design as the inline favicon.

    python tools/make-icons.py

Writes, next to index.html:

    apple-touch-icon.png   180x180, full-bleed

Why the raster exists: the site's favicon is an SVG data URI in index.html, and
iOS ignores SVG favicons, so without this file the home-screen icon would be a
screenshot of the page. Full-bleed rather than rounded: iOS applies its own
mask, so the data URI's rx=12 would show as a rounded square inside it.

The design is that data URI's: a #0f0f0f tile with the PS monogram in #ff7a1a,
Georgia bold, centred on the 64-unit grid. index.html is the source of truth;
keep these numbers in step with it if the monogram changes.

Byte-reproducible only where Georgia is installed — the monogram is text, so a
machine without it renders a metrically different PS. The tile, its colour and
the monogram's nominal size and position come out the same everywhere.

Needs Pillow (`pip install pillow`).
"""

from __future__ import annotations

import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "apple-touch-icon.png")

TILE = (15, 15, 15)        # #0f0f0f
MONOGRAM = (255, 122, 26)  # #ff7a1a

# The inline favicon's viewBox is 64 units; the raster is 180px.
VIEWBOX = 64
SIZE = 180
TEXT_X = 32
BASELINE = 43
FONT_SIZE = 32
MARK = "PS"

FONT_CANDIDATES = [
    "C:/Windows/Fonts/georgiab.ttf",
    "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
    "/Library/Fonts/Georgia Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
]


def find_font() -> str:
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return path
    sys.exit(
        "No bold serif found. Add its path to FONT_CANDIDATES in "
        "tools/make-icons.py, then re-run."
    )


def main() -> None:
    unit = SIZE / VIEWBOX
    img = Image.new("RGBA", (SIZE, SIZE), TILE + (255,))
    font = ImageFont.truetype(find_font(), round(FONT_SIZE * unit))
    ImageDraw.Draw(img).text(
        (TEXT_X * unit, BASELINE * unit),
        MARK,
        font=font,
        fill=MONOGRAM + (255,),
        anchor="ms",          # centred on the inline SVG's text-anchor="middle"
    )
    # RGB rather than RGBA: the tile is full-bleed and therefore completely
    # opaque, so an alpha channel would be dead weight. Saved with Pillow's
    # defaults (compress_level=6, no optimize) because that is the encoder
    # path the shipped rasters came from - with optimize=True the pixels are
    # identical but the file bytes are not, which would make every future run
    # of this generator show up as a binary change.
    img.convert("RGB").save(OUT, "PNG")
    print(f"wrote apple-touch-icon.png ({SIZE}x{SIZE}, {os.path.getsize(OUT)} bytes)")


if __name__ == "__main__":
    main()
