#!/usr/bin/env python3
"""Crop Marketplace listing screenshots to 1840x900 and 580x330.

Looks in /workspace/ticketgate-verify/prod (or --input) for production captures.
If none are present, exits 0 and prints what it expected. Writes into
docs/marketplace/.

Filename hints (case-insensitive):

  highlight-1-held    held, sup-5, highlight-1
  highlight-2-masked  mask, masked, pii, sup-3, highlight-2
  highlight-3-explain explain, rovo, confirm, reply, highlight-3

If exactly three images are in the input directory and none match those hints,
they are assigned in sorted order as highlights 1, 2, and 3.

The 1840x900 crop keeps as much Jira chrome as will fit. The 580x330 crop is a
downscaled slice of the main column (skipping the left nav). Override boxes
with --tight x,y,w,h once per highlight if a recapture needs a different crop.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = Path("/workspace/ticketgate-verify/prod")
DEFAULT_OUTPUT = ROOT / "docs" / "marketplace"

HIGHLIGHTS = (
    ("highlight-1-held", ("held", "sup-5", "highlight-1")),
    ("highlight-2-masked", ("mask", "masked", "pii", "sup-3", "highlight-2")),
    ("highlight-3-explain", ("explain", "rovo", "confirm", "reply", "highlight-3")),
)
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".webp"}


def list_images(folder: Path) -> list[Path]:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_SUFFIXES)


def assign(images: list[Path]) -> dict[str, Path]:
    used: set[Path] = set()
    mapping: dict[str, Path] = {}
    lower = {p: p.name.lower() for p in images}
    for name, hints in HIGHLIGHTS:
        for p, n in lower.items():
            if p in used:
                continue
            if any(h in n for h in hints):
                mapping[name] = p
                used.add(p)
                break
    leftover = [p for p in images if p not in used]
    if len(mapping) == 0 and len(images) == 3:
        for (name, _), p in zip(HIGHLIGHTS, images):
            mapping[name] = p
    elif leftover and len(mapping) < 3:
        # Do not guess beyond an exact three-file fallback.
        pass
    return mapping


def crop_1840(im: Image.Image, prefer_bottom: bool = False) -> Image.Image:
    w, h = im.size
    if w < 1840 or h < 900:
        raise SystemExit(f"image is {w}x{h}; need at least 1840x900")
    left = min(40, w - 1840) if w >= 1880 else (w - 1840) // 2
    top = (h - 900) if prefer_bottom else 0
    if top < 0:
        top = 0
    if top + 900 > h:
        top = h - 900
    return im.crop((left, top, left + 1840, top + 900))


def crop_580(im: Image.Image, tight: tuple[int, int, int, int] | None = None) -> Image.Image:
    w, h = im.size
    if tight:
        x, y, bw, bh = tight
    else:
        # Skip typical left nav (~13%) and take a 20:11 slice of the main column.
        x = int(w * 0.13)
        y = int(h * 0.18)
        bw = min(int(w * 0.55), w - x)
        bh = int(bw * 330 / 580)
        if y + bh > h:
            y = max(0, h - bh)
    piece = im.crop((x, y, x + bw, y + bh))
    return piece.resize((580, 330), Image.Resampling.LANCZOS)


def parse_tight(values: list[str]) -> dict[str, tuple[int, int, int, int]]:
    out: dict[str, tuple[int, int, int, int]] = {}
    for item in values:
        # name:x,y,w,h
        if ":" not in item:
            raise SystemExit(f"--tight expects name:x,y,w,h, got {item!r}")
        name, box = item.split(":", 1)
        parts = [int(p) for p in box.split(",")]
        if len(parts) != 4:
            raise SystemExit(f"--tight box must be x,y,w,h, got {item!r}")
        out[name] = tuple(parts)  # type: ignore[assignment]
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--input", type=Path, default=DEFAULT_INPUT)
    ap.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    ap.add_argument(
        "--prefer-bottom",
        action="store_true",
        help="anchor the 1840x900 crop at the bottom (keeps a lower panel that would otherwise be clipped)",
    )
    ap.add_argument(
        "--tight",
        action="append",
        default=[],
        help="override 580x330 source box, e.g. highlight-2-masked:248,400,1040,592",
    )
    args = ap.parse_args()
    tight = parse_tight(args.tight)

    images = list_images(args.input)
    if not images:
        print(f"No images in {args.input}. Capture production screenshots there, then rerun.")
        print("Expected three shots: a held proposal (SUP-5), a masked write (SUP-3),")
        print("and a Rovo confirm or reply that explains the decision.")
        return 0

    mapping = assign(images)
    if not mapping:
        print(f"Found {len(images)} image(s) in {args.input} but could not match highlights:")
        for p in images:
            print(f"  {p.name}")
        print("Rename to include held, masked/pii, or explain/rovo/confirm, or pass exactly three files.")
        return 1

    args.output.mkdir(parents=True, exist_ok=True)
    for name, src in mapping.items():
        im = Image.open(src).convert("RGB")
        prefer_bottom = args.prefer_bottom or name == "highlight-2-masked"
        wide = crop_1840(im, prefer_bottom=prefer_bottom)
        tight_box = tight.get(name)
        crop = crop_580(im, tight_box)
        p1 = args.output / f"{name}-1840x900.png"
        p2 = args.output / f"{name}-580x330.png"
        wide.save(p1, "PNG", optimize=True)
        crop.save(p2, "PNG", optimize=True)
        print(f"{src.name} ({im.size[0]}x{im.size[1]}) -> {p1.name} {wide.size}, {p2.name} {crop.size}")

    missing = [name for name, _ in HIGHLIGHTS if name not in mapping]
    if missing:
        print("Still missing: " + ", ".join(missing))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
