# /// script
# dependencies = ["fonttools[woff]>=4.50", "brotli"]
# ///
"""Build the self-hosted web fonts. Run by hand, commit the output.

    uv run scripts/subset-fonts.py

Rerun it when the type changes, or when content starts using a character outside
Latin-1 and Latin Extended-A. Until then the browser falls
back to a system font for that one character, which is what it does today for any
glyph these faces lack.

Writes client/public/fonts/*.woff2 and client/src/fonts.css. Nothing in the build reads
this script; if it is not run, the committed output is used as is.
"""

import pathlib
import os
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / ".font-cache"
FONTS_DIR = ROOT / "client" / "public" / "fonts"
CSS_OUT = ROOT / "client" / "src" / "fonts.css"
GITHUB = "https://raw.githubusercontent.com/google/fonts/main"

# ASCII and the punctuation that appears on most pages. These ship in the preloaded core file.
CORE = list(range(0x20, 0x7F)) + [ord(c) for c in "’“”‘–—…·©↓"]
# Anything else on the site: Latin-1, Latin Extended-A, plus Greek, arrows and box
# drawing that the articles already use.
EXT = list(range(0xA0, 0x180)) + [ord(c) for c in "→↑←─│└├™←≥≤≈±×²¹³⁴⁵⁶⁷⁸⁹⁰⁻₀₁₂αβγδΔμ‘’↗♥♂♀…"]

FONTS = [
    {
        "family": "Atkinson Hyperlegible Next",
        "style": "normal",
        "out": "atkinson-next",
        "src": f"{GITHUB}/ofl/atkinsonhyperlegiblenext/AtkinsonHyperlegibleNext%5Bwght%5D.ttf",
        "axes": {"wght": (400, 800)},
    },
    {
        "family": "Atkinson Hyperlegible Mono",
        "style": "normal",
        "out": "atkinson-mono",
        "src": f"{GITHUB}/ofl/atkinsonhyperlegiblemono/AtkinsonHyperlegibleMono%5Bwght%5D.ttf",
        "axes": {"wght": (400, 700)},
    },
    {
        "family": "Hepta Slab",
        "style": "normal",
        "out": "hepta-slab",
        "src": f"{GITHUB}/ofl/heptaslab/HeptaSlab%5Bwght%5D.ttf",
        # Shop names and panel heads are set 14-29px at 800.
        "axes": {"wght": (700, 800)},
    },
    {
        "family": "Big Shoulders Stencil",
        "style": "normal",
        "out": "big-shoulders-stencil",
        "src": f"{GITHUB}/ofl/bigshouldersstencil/BigShouldersStencil%5Bopsz,wght%5D.ttf",
        # One use in the whole site: an 800-weight 12px stamp.
        "axes": {"wght": (800, 800), "opsz": (12, 12)},
    },
]

# Shipped on every page: keep the whole family alive but only the common glyphs.
KEEP_FEATURES = "kern,liga,ccmp,locl,calt"


def run(args):
    # Pinned so a rerun with unchanged fonts produces byte-identical files; only a real
    # change to the type touches the binaries.
    env = {**os.environ, "SOURCE_DATE_EPOCH": "0"}
    result = subprocess.run(args, capture_output=True, text=True, env=env)
    if result.returncode:
        print(" ".join(args[:4]))
        print(result.stderr[-1500:])
        raise SystemExit(1)


def source(font):
    """The upstream TTF, cached so repeat runs need no network."""
    CACHE.mkdir(parents=True, exist_ok=True)
    cached = CACHE / font["src"].rsplit("/", 1)[-1].replace("%5B", "[").replace("%5D", "]")
    if not cached.exists():
        print(f"  fetching {font['src'].rsplit('/', 1)[-1]}")
        urllib.request.urlretrieve(font["src"], cached)
    return cached


def narrow(src, axes, out):
    """Clamp the variable axes to the values the site asks for."""
    if not axes:
        return src
    args = [f"{tag}={low}:{high}" if low != high else f"{tag}={low}" for tag, (low, high) in axes.items()]
    run([sys.executable, "-m", "fontTools.varLib.instancer", str(src), *args, "--output", str(out)])
    return out


def subset(src, chars, out):
    run([
        sys.executable, "-m", "fontTools.subset", str(src),
        f"--unicodes={','.join(f'U+{c:04X}' for c in chars)}",
        "--flavor=woff2",
        f"--layout-features={KEEP_FEATURES}",
        f"--output-file={out}",
    ])


def weight_range(path, pinned):
    """The wght the file actually carries, so the face is not mistaken for a single weight."""
    from fontTools.ttLib import TTFont

    font = TTFont(path)
    for axis in font["fvar"].axes if "fvar" in font else []:
        if axis.axisTag == "wght":
            return f"{int(axis.minValue)} {int(axis.maxValue)}"
    return str(pinned)


def ranges(path):
    """The code points actually in the file, as a CSS unicode-range."""
    from fontTools.ttLib import TTFont

    points = sorted({p for table in TTFont(path)["cmap"].tables for p in table.cmap})
    spans, start, prev = [], None, None
    for p in points:
        if start is None:
            start = prev = p
        elif p == prev + 1:
            prev = p
        else:
            spans.append((start, prev))
            start = prev = p
    if start is not None:
        spans.append((start, prev))
    return ", ".join(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}" for a, b in spans)


def main():
    FONTS_DIR.mkdir(parents=True, exist_ok=True)
    core = sorted(set(CORE))
    ext = sorted(set(EXT) - set(CORE))
    rules, total = [], 0

    for font in FONTS:
        print(f"{font['out']}:")
        src = source(font)
        narrowed = narrow(src, font["axes"], CACHE / f"{font['out']}-narrow.ttf")

        for part, chars in (("core", core), ("ext", ext)):
            out = FONTS_DIR / f"{font['out']}-{part}.woff2"
            subset(narrowed, chars, out)
            size = out.stat().st_size
            total += size
            span_list = ranges(out)
            print(f"  {part:4} {size / 1024:5.1f} KB")
            rules.append(
                "@font-face {\n"
                f"  font-family: '{font['family']}';\n"
                f"  font-style: {font['style']};\n"
                f"  font-weight: {weight_range(out, (font['axes'].get('wght') or (400, 400))[0])};\n"
                "  font-display: swap;\n"
                f"  src: url('/fonts/{out.name}') format('woff2');\n"
                f"  unicode-range: {span_list};\n"
                "}"
            )

    CSS_OUT.write_text(
        "/* Generated by scripts/subset-fonts.py. Do not edit by hand. */\n\n"
        + "\n\n".join(rules)
        + "\n"
    )
    print(f"\ntotal {total / 1024:.1f} KB -> {CSS_OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
