#!/usr/bin/env python3
"""
Regenerates src/glyph-data.ts: the rune and symbol outlines used by rune rings,
rune scripts and emblems.

    python3 -m pip install fonttools
    python3 scripts/build-glyphs.py

Sources (downloaded from pinned commits; see THIRD-PARTY-NOTICES.md for licenses):
  - GL-Runen by Gutenberg Labo: every rune in the Unicode runic block (U+16A0-16F8)
  - RPG Awesome by Daniela Howe, whose icons are adapted from game-icons.net:
    a hand-picked subset suited to magic circles (see ICON_GROUPS)

Every glyph becomes a single SVG path centred on 0,0 and spanning -1000..1000 on
its larger axis (runes share one scale, so they keep their relative heights).
Coordinates are whole numbers in relative commands, which keeps the data small.
"""
import io
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
from fontTools.svgLib.path import parse_path
from fontTools.ttLib import TTFont

RUNEN_URL = 'https://raw.githubusercontent.com/Gutenberg-Labo/GL-Runen/e9d9856ad97be0a3b75454dfa26f6058345c6375/fonts/ttf/GL-Runen.ttf'
RPG_URL = 'https://raw.githubusercontent.com/nagoshiashumari/Rpg-Awesome/b7c987d25af6b23101cc7aaf492ce1426d4b4894/fonts/rpgawesome-webfont.svg'
OUT = Path(__file__).resolve().parent.parent / 'src' / 'glyph-data.ts'
HALF = 1000  # output coordinates span -HALF..HALF

# Symbols chosen for magic circles. Left out on purpose: modern objects (batteries,
# Wi-Fi, firearms...) and icons of other games' trademarks.
ICON_GROUPS = {
    'zodiac': ('Zodiac', 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces ophiuchus'),
    'elements': ('Elements', 'fire fire-symbol flame-symbol small-fire fire-ring frostfire burning-embers water-drop droplet droplets '
                 'ocean-emblem splash snowflake frost-emblem lightning lightning-bolt lightning-trio focused-lightning '
                 'lightning-storm leaf zigzag-leaf sprout sprout-emblem clover lava poison-cloud heat-haze'),
    'celestial': ('Celestial', 'sun sun-symbol sunbeams moon-sun burning-meteor aura'),
    'arcane': ('Arcane', 'ankh omega circle-of-circles crystal-ball crystal-wand fairy-wand rune-stone scroll-unfurled book '
               'burning-book quill-ink candle-fire candle lit-candelabra incense potion bubbling-potion round-bottom-flask '
               'flask fizzing-flask vial corked-tube heart-bottle bottle-vapors hourglass mirror key key-basic three-keys '
               'arcane-mask eyeball burning-eye bleeding-eye hand-emblem hand cut-palm skull death-skull crossed-bones '
               'crown-of-thorns queen-crown crown trefoil-lily radial-balance kaleidoscope cycle regeneration fluffy-swirl '
               'spiral-shell interdiction hood tombstone gem gem-pendant emerald sapphire diamond crystals crystal-cluster '
               'lantern-flame torch horns'),
    'creatures': ('Creatures', 'dragon dragon-wing two-dragons wyvern hydra sea-serpent raven wolf-head wolf-howl lion snake '
                  'venomous-snake spider-face octopus tentacle batwings butterfly fairy angel-wings feathered-wing bird-claw '
                  'fox cat beetle dragonfly'),
    'arms': ('Arms & armour', 'crossed-swords broadsword relic-blade spinning-sword lightning-sword fireball-sword trident '
             'flaming-trident scythe sickle halberd shield round-shield heavy-shield fire-shield eye-shield knight-helmet '
             'axe daggers crossbow hammer anvil castle-emblem tower'),
    'suits': ('Card suits', 'spades hearts diamonds clovers'),
}


class RelPathPen(BasePen):
    """Writes an outline as a compact SVG path: rounded absolute points, relative commands."""

    def __init__(self):
        super().__init__(None)
        self.out = []
        self.cur = (0, 0)
        self.start = (0, 0)

    def _pt(self, p):
        return (round(p[0]), round(p[1]))

    def _rel(self, *pts):
        x0, y0 = self.cur
        return [(x - x0, y - y0) for x, y in pts]

    def _emit(self, cmd, rel):
        nums = ' '.join(f'{dx} {dy}' for dx, dy in rel)
        self.out.append(cmd + re.sub(r' -', '-', nums))

    def _moveTo(self, p):
        p = self._pt(p)
        self._emit('m', self._rel(p))
        self.cur = self.start = p

    def _lineTo(self, p):
        p = self._pt(p)
        (dx, dy), = self._rel(p)
        if dx == 0 and dy == 0:
            return
        if dy == 0:
            self.out.append(f'h{dx}')
        elif dx == 0:
            self.out.append(f'v{dy}')
        else:
            self._emit('l', [(dx, dy)])
        self.cur = p

    def _qCurveToOne(self, p1, p2):
        p1, p2 = self._pt(p1), self._pt(p2)
        self._emit('q', self._rel(p1, p2))
        self.cur = p2

    def _curveToOne(self, p1, p2, p3):
        p1, p2, p3 = self._pt(p1), self._pt(p2), self._pt(p3)
        self._emit('c', self._rel(p1, p2, p3))
        self.cur = p3

    def _closePath(self):
        self.out.append('z')
        self.cur = self.start

    def path(self):
        d = ''.join(self.out)
        return re.sub(r'(?<=\d) (?=\d)', ' ', d)


def outline(draw, transform):
    pen = RelPathPen()
    draw(TransformPen(pen, transform))
    return pen.path()


def bounds(draw):
    pen = BoundsPen(None)
    draw(pen)
    return pen.bounds


def fetch(url):
    # curl rather than urllib: some macOS Python installs ship without CA certificates.
    return subprocess.run(['curl', '-fsSL', url], check=True, capture_output=True).stdout


def build_runes():
    font = TTFont(io.BytesIO(fetch(RUNEN_URL)))
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    codes = sorted(c for c in cmap if 0x16A0 <= c <= 0x16F8)

    def draw_fn(code):
        return lambda pen: glyphs[cmap[code]].draw(pen)

    # One scale for every rune, from the tallest of the Elder Futhark, centred on its height.
    elder = [ord(c) for c in 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ']
    boxes = [bounds(draw_fn(c)) for c in elder]
    y_min = min(b[1] for b in boxes)
    y_max = max(b[3] for b in boxes)
    scale = 2 * HALF / (y_max - y_min)
    y_mid = (y_min + y_max) / 2

    out = {}
    for code in codes:
        b = bounds(draw_fn(code))
        if b is None:
            continue
        x_mid = (b[0] + b[2]) / 2
        # Flip y (fonts point up, SVG points down) and centre.
        t = (scale, 0, 0, -scale, -x_mid * scale, y_mid * scale)
        out[chr(code)] = outline(draw_fn(code), t)
    return out


def rune_label(ch):
    # "RUNIC LETTER FEHU FEOH FE F" -> "Fehu"; punctuation keeps its full name.
    name = unicodedata.name(ch, '')
    rest = name.replace('RUNIC LETTER ', '')
    if rest == name:
        return name.replace('RUNIC ', '').title()
    words = rest.split()
    skip = {'LONG-BRANCH-', 'SHORT-TWIG-', 'DOTTED-', 'OPEN-', 'LONG-BRANCH', 'SHORT-TWIG'}
    first = next((w for w in words if w not in skip), words[0])
    return first.replace('-', ' ').title()


def build_icons():
    svg = fetch(RPG_URL).decode('utf-8')
    paths = dict(re.findall(r'<glyph[^>]*?glyph-name="([^"]+)"[^>]*?\sd="([^"]*)"', svg))
    out = {}
    groups = {}
    for key, (label, names) in ICON_GROUPS.items():
        groups[key] = {'label': label, 'icons': names.split()}
        for name in names.split():
            if name not in paths:
                sys.exit(f'RPG Awesome has no icon named {name!r}')
            d = paths[name]
            draw = lambda pen, d=d: parse_path(d, pen)
            b = bounds(draw)
            scale = 2 * HALF / max(b[2] - b[0], b[3] - b[1])
            t = (scale, 0, 0, -scale, -(b[0] + b[2]) / 2 * scale, (b[1] + b[3]) / 2 * scale)
            out[name] = outline(draw, t)
    return out, groups


def main():
    runes = build_runes()
    icons, groups = build_icons()
    labels = {ch: rune_label(ch) for ch in runes}
    js = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    OUT.write_text(
        '// Generated by scripts/build-glyphs.py. Do not edit by hand.\n'
        '// Runes: GL-Runen by Gutenberg Labo (free licence).\n'
        '// Symbols: RPG Awesome by Daniela Howe (SIL OFL 1.1), adapted from game-icons.net (CC BY 3.0).\n'
        '// Paths are centred on 0,0 and span -1000..1000. See THIRD-PARTY-NOTICES.md.\n\n'
        f'export const RUNE_PATHS: Readonly<Record<string, string>> = {js(runes)};\n\n'
        f'export const RUNE_LABELS: Readonly<Record<string, string>> = {js(labels)};\n\n'
        f'export const ICON_PATHS: Readonly<Record<string, string>> = {js(icons)};\n\n'
        f'export const ICON_GROUPS = {js(groups)} as const;\n',
        encoding='utf-8',
    )
    print(f'{OUT.name}: {len(runes)} runes, {len(icons)} symbols, {OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
