#!/usr/bin/env python3
"""Generate original Ticket Contracts Marketplace logo (144x144) and banner (1120x548).

Original artwork drawn with Pillow. No third-party marks, no Atlassian brand elements.
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

TEAL = (13, 92, 84, 255)          # #0D5C54
TEAL_DEEP = (8, 58, 54, 255)      # #083A36
INK = (22, 32, 42, 255)           # #16202A
PAPER = (247, 243, 234, 255)      # #F7F3EA
CREAM = (236, 229, 214, 255)
WHITE = (255, 255, 255, 255)
MUTED = (196, 208, 204, 255)

INTER = Path(
    "/usr/share/fonts/truetype/sand-box/google/Inter/Inter-VariableFont_opsz,wght.ttf"
)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "marketplace"


def font(size: int, weight: int, opsz: float = 14) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(INTER), size)
    f.set_variation_by_axes([opsz, weight])
    return f


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius: int, fill) -> None:
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_mark(size: int, tile: bool = True) -> Image.Image:
    """Ticket stub + check on a rounded teal tile (or just the mark, for reuse)."""
    scale = 8
    s = size * scale
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if tile:
        margin = int(s * 0.02)
        rounded_rect(d, (margin, margin, s - 1 - margin, s - 1 - margin), int(s * 0.22), TEAL)

    # Ticket body
    tx0, ty0 = int(s * 0.22), int(s * 0.20)
    tx1, ty1 = int(s * 0.80), int(s * 0.80)
    ticket = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    td = ImageDraw.Draw(ticket)
    rounded_rect(td, (tx0, ty0, tx1, ty1), int(s * 0.08), PAPER)

    # Perforated left edge: punch holes, then a vertical stitch
    mask = Image.new("L", (s, s), 255)
    md = ImageDraw.Draw(mask)
    hole_r = int(s * 0.035)
    cx = tx0
    for i in range(3):
        cy = int(ty0 + (ty1 - ty0) * (0.22 + i * 0.28))
        md.ellipse((cx - hole_r, cy - hole_r, cx + hole_r, cy + hole_r), fill=0)
    ticket.putalpha(ImageChops_min(ticket.split()[-1], mask))

    # Stitch line
    td = ImageDraw.Draw(ticket)
    stitch_x = tx0 + int(s * 0.10)
    td.line((stitch_x, ty0 + int(s * 0.06), stitch_x, ty1 - int(s * 0.06)), fill=CREAM, width=max(2, s // 90))

    # Check mark
    stroke = max(6, s // 18)
    p1 = (int(s * 0.38), int(s * 0.52))
    p2 = (int(s * 0.50), int(s * 0.66))
    p3 = (int(s * 0.70), int(s * 0.36))
    td.line([p1, p2, p3], fill=TEAL, width=stroke, joint="curve")
    # rounded caps
    r = stroke // 2
    for p in (p1, p2, p3):
        td.ellipse((p[0] - r, p[1] - r, p[0] + r, p[1] + r), fill=TEAL)

    im = Image.alpha_composite(im, ticket)
    return im.resize((size, size), Image.Resampling.LANCZOS)


def ImageChops_min(a: Image.Image, b: Image.Image) -> Image.Image:
    from PIL import ImageChops
    return ImageChops.darker(a, b)


def make_logo(path: Path) -> None:
    logo = draw_mark(144, tile=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    logo.save(path, "PNG", optimize=True)


def make_banner(path: Path) -> None:
    W, H = 1120, 548
    scale = 2
    w, h = W * scale, H * scale
    im = Image.new("RGBA", (w, h), INK)
    d = ImageDraw.Draw(im)

    # Soft teal wash on the left
    wash = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    wd = ImageDraw.Draw(wash)
    for i in range(40):
        alpha = int(40 - i)
        x1 = int(w * 0.55 * (i / 40))
        wd.rectangle((0, 0, x1, h), fill=(13, 92, 84, alpha))
    im = Image.alpha_composite(im, wash)
    d = ImageDraw.Draw(im)

    # Subtle large ticket silhouette on the right, very faint
    ghost = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ghost)
    gx0, gy0 = int(w * 0.72), int(h * -0.08)
    gx1, gy1 = int(w * 1.08), int(h * 1.12)
    gd.rounded_rectangle((gx0, gy0, gx1, gy1), radius=int(h * 0.08), outline=(255, 255, 255, 22), width=8)
    stitch = gx0 + int((gx1 - gx0) * 0.16)
    gd.line((stitch, gy0 + 40, stitch, gy1 - 40), fill=(255, 255, 255, 18), width=4)
    im = Image.alpha_composite(im, ghost)

    # Logo tile
    mark = draw_mark(int(h * 0.42), tile=True)
    mx, my = int(w * 0.075), (h - mark.height) // 2
    im.paste(mark, (mx, my), mark)

    text_left = mx + mark.width + int(w * 0.045)
    title_font = font(int(h * 0.15), 700, opsz=28)
    tag_font = font(int(h * 0.058), 450, opsz=18)
    partner_font = font(int(h * 0.048), 500, opsz=16)

    d = ImageDraw.Draw(im)
    title = "Ticket Contracts"
    tag_lines = ["Agents read context.", "Who checks what they write?"]
    partner = "NightMoose"

    def size_of(text, fnt):
        box = d.textbbox((0, 0), text, font=fnt)
        return box[2] - box[0], box[3] - box[1], box[1]

    tw, th, tasc = size_of(title, title_font)
    line_sizes = [size_of(line, tag_font) for line in tag_lines]
    tagh = sum(s[1] for s in line_sizes) + int(h * 0.012)
    pw, ph, _ = size_of(partner, partner_font)

    gap1, gap2 = int(h * 0.03), int(h * 0.065)
    block = th + gap1 + tagh + gap2 + ph
    y = (h - block) // 2 - tasc

    d.text((text_left, y), title, font=title_font, fill=PAPER)
    ty = y + th + gap1
    line_gap = int(h * 0.012)
    for i, line in enumerate(tag_lines):
        d.text((text_left, ty), line, font=tag_font, fill=MUTED)
        ty += line_sizes[i][1] + line_gap
    rule_y = ty + int(gap2 * 0.15)
    d.line((text_left, rule_y, text_left + int(w * 0.08), rule_y), fill=TEAL, width=3)
    d.text((text_left, ty + gap2 - line_gap), partner, font=partner_font, fill=CREAM)

    out = im.resize((W, H), Image.Resampling.LANCZOS).convert("RGB")
    path.parent.mkdir(parents=True, exist_ok=True)
    out.save(path, "PNG", optimize=True)


def main() -> None:
    logo = OUT / "logo-144x144.png"
    banner = OUT / "banner-1120x548.png"
    make_logo(logo)
    make_banner(banner)
    for p in (logo, banner):
        im = Image.open(p)
        print(f"{p.relative_to(ROOT)} {im.size} {im.mode} {p.stat().st_size} bytes")


if __name__ == "__main__":
    main()
