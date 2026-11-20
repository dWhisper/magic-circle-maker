import { describe, expect, it } from 'vitest';
import { normalize } from '../src/design';
import { ICON_GROUPS, ICON_PATHS, RUNE_PATHS } from '../src/glyph-data';
import {
  ALPHABETS, EMBLEMS, EMBLEM_OPTIONS, GLYPH_SETS, RUNE_ALPHABETS, RUNE_SEPARATOR, SCRIPTS, glyphOutline,
  glyphSetItems, transliterate,
} from '../src/glyphs';
import type { RuneAlphabet } from '../src/glyphs';
import { makeLayer, renderers } from '../src/layers';
import { PRESETS, randomDesign } from '../src/presets';
import type { Layer, LayerType, RenderCtx } from '../src/types';

const CTX: RenderCtx = { seed: 'test-seed', w: 2, bg: '#123456' };
const draw = (type: LayerType, props: Partial<Layer> = {}, ctx: RenderCtx = CTX): string =>
  renderers[type](makeLayer(type, { salt: 1, ...props }), ctx);

/** The glyph keys drawn as filled outlines, in drawing order, found by their path data. */
const BY_PATH = new Map<string, string>([...Object.entries(RUNE_PATHS), ...Object.entries(ICON_PATHS)].map(([k, d]) => [d, k]));
const drawnGlyphs = (svg: string): string[] =>
  [...svg.matchAll(/<path transform="translate\([^"]*\)(?: rotate\([^"]*\))? scale\([^"]*\)" d="([^"]+)"/g)]
    .map((m) => BY_PATH.get(m[1] as string) ?? '?');

describe('glyph data', () => {
  const all = { ...RUNE_PATHS, ...ICON_PATHS };

  it('has every rune in the Unicode runic block and the hand-picked symbols', () => {
    expect(Object.keys(RUNE_PATHS)).toHaveLength(89);
    expect(Object.keys(ICON_PATHS).length).toBeGreaterThan(150);
  });

  it.each(Object.entries(all))('%s is a compact, well-formed path inside its box', (_key, d) => {
    expect(d).toMatch(/^m[-\d]/);
    expect(d).toMatch(/^[mlhvqcz\d -]+$/); // relative commands and whole numbers only: nothing to inject
    // Walk the path to check every point stays within -1000..1000 (plus rounding).
    let x = 0, y = 0, sx = 0, sy = 0;
    const tokens = d.match(/[mlhvqcz]|-?\d+/g) ?? [];
    let cmd = '';
    const nums: number[] = [];
    const flush = () => {
      const per = { m: 2, l: 2, h: 1, v: 1, q: 4, c: 6 }[cmd] ?? 0;
      for (let i = 0; per && i < nums.length; i += per) {
        const g = nums.slice(i, i + per);
        if (cmd === 'h') x += g[0]!;
        else if (cmd === 'v') y += g[0]!;
        else { x += g[per - 2]!; y += g[per - 1]!; }
        if (cmd === 'm' && i === 0) { sx = x; sy = y; }
        expect(Math.abs(x), d.slice(0, 40)).toBeLessThanOrEqual(1001);
        expect(Math.abs(y), d.slice(0, 40)).toBeLessThanOrEqual(1001);
      }
      nums.length = 0;
    };
    for (const t of tokens) {
      if (/[a-z]/.test(t)) {
        flush();
        cmd = t;
        if (t === 'z') { x = sx; y = sy; }
      } else nums.push(Number(t));
    }
    flush();
  });

  it('has an outline for every rune in every alphabet and every symbol in every group', () => {
    for (const a of RUNE_ALPHABETS) for (const ch of ALPHABETS[a].runes) expect(RUNE_PATHS, `${a} ${ch}`).toHaveProperty(ch);
    for (const [g, { icons }] of Object.entries(ICON_GROUPS)) for (const i of icons) expect(ICON_PATHS, `${g} ${i}`).toHaveProperty(i);
    expect(RUNE_PATHS).toHaveProperty(RUNE_SEPARATOR);
  });

  it('only looks up real glyphs, not object properties', () => {
    for (const key of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', '']) expect(glyphOutline(key)).toBeUndefined();
  });

  it('offers every emblem it can draw, each alphabet complete, with no repeats within a group', () => {
    // Runes such as ᚠ belong to several alphabets, so they're listed under each.
    for (const g of EMBLEM_OPTIONS) {
      const values = g.options.map(([v]) => v);
      expect(new Set(values).size, g.label).toBe(values.length);
      for (const v of values) expect(glyphOutline(v), v).toBeDefined();
    }
    expect(EMBLEMS.size).toBe(new Set(EMBLEM_OPTIONS.flatMap((g) => g.options.map(([v]) => v))).size);
  });

  it('keeps the alphabets the right size and free of repeats', () => {
    const sizes = Object.fromEntries(RUNE_ALPHABETS.map((a) => [a, [...ALPHABETS[a].runes].length]));
    expect(sizes).toEqual({ elder: 24, younger: 16, futhorc: 28, medieval: 29 });
    for (const a of RUNE_ALPHABETS) expect(new Set(ALPHABETS[a].runes).size, a).toBe(sizes[a]);
  });

  it('starts each alphabet with the runes that name it (f, u, th, a/o, r, k)', () => {
    expect(ALPHABETS.elder.runes.slice(0, 6)).toBe('ᚠᚢᚦᚨᚱᚲ');
    expect(ALPHABETS.younger.runes.slice(0, 6)).toBe('ᚠᚢᚦᚬᚱᚴ');
    expect(ALPHABETS.futhorc.runes.slice(0, 6)).toBe('ᚠᚢᚦᚩᚱᚳ');
  });
});

describe('transliteration', () => {
  it.each(RUNE_ALPHABETS)('%s has a rune for every Latin letter, each with an outline', (a) => {
    for (const ch of 'abcdefghijklmnopqrstuvwxyz') {
      const out = transliterate(ch, a);
      expect(out.length, `${a}: ${ch}`).toBeGreaterThan(0);
      for (const r of out) expect(RUNE_PATHS, `${a}: ${ch} -> ${r}`).toHaveProperty(r!);
    }
  });

  it('writes words in Elder Futhark, with "th" and "ng" as single runes', () => {
    expect(transliterate('thing', 'elder')).toEqual(['ᚦ', 'ᛁ', 'ᛜ']);
    expect(transliterate('Oath', 'elder')).toEqual(['ᛟ', 'ᚨ', 'ᚦ']);
    expect(transliterate('fox', 'elder')).toEqual(['ᚠ', 'ᛟ', 'ᚲ', 'ᛊ']);
  });

  it('uses the futhorc’s extra runes for ea, st and ae', () => {
    expect(transliterate('east', 'futhorc')).toEqual(['ᛠ', 'ᛥ']);
    expect(transliterate('aesc', 'futhorc')).toEqual(['ᚫ', 'ᛋ', 'ᚳ']);
    expect(transliterate('stone', 'futhorc')).toEqual(['ᛥ', 'ᚩ', 'ᚾ', 'ᛖ']);
  });

  it('folds letters the 16-rune Younger Futhark lacks onto their nearest rune', () => {
    expect(transliterate('dog', 'younger')).toEqual(['ᛏ', 'ᚬ', 'ᚴ']);
    expect(transliterate('bp', 'younger')).toEqual(['ᛒ', 'ᛒ']);
  });

  it('marks gaps between words, once per gap, and none at the ends', () => {
    expect(transliterate('  by ember, and   oath! ', 'elder')).toEqual(['ᛒ', 'ᛁ', null, 'ᛖ', 'ᛗ', 'ᛒ', 'ᛖ', 'ᚱ', null, 'ᚨ', 'ᚾ', 'ᛞ', null, 'ᛟ', 'ᚨ', 'ᚦ']);
  });

  it('strips accents, keeps þ ð æ ø, and drops digits and symbols', () => {
    expect(transliterate('Éowyn', 'elder')).toEqual(transliterate('eowyn', 'elder'));
    expect(transliterate('þing', 'elder')).toEqual(['ᚦ', 'ᛁ', 'ᛜ']);
    expect(transliterate('æðø', 'medieval')).toEqual(['ᛅ', 'ᚧ', 'ᚯ']);
    expect(transliterate('a1b2c3', 'elder')).toEqual(['ᚨ', 'ᛒ', 'ᚲ']);
    expect(transliterate('7 ✦ 9', 'elder')).toEqual([]);
    expect(transliterate('', 'futhorc')).toEqual([]);
  });

  it('copes with any text without throwing or producing unknown runes', () => {
    const junk = 'ÀÉÎÕÜ ß ŁŊ 魔法 🜂 \u0000 <script> ' + 'ﬁ'.repeat(3);
    for (const a of RUNE_ALPHABETS) {
      for (const r of transliterate(junk, a)) if (r !== null) expect(RUNE_PATHS).toHaveProperty(r);
    }
  });
});

describe('rune ring glyph sets', () => {
  it('keeps the generated runes as the default, unchanged', () => {
    expect(makeLayer('runes').glyphs).toBe('seeded');
    expect(drawnGlyphs(draw('runes', { count: 12 }))).toEqual([]); // stroked, not outlines
  });

  it.each(RUNE_ALPHABETS)('writes the %s in traditional order, starting again when it runs out', (a: RuneAlphabet) => {
    const runes = [...ALPHABETS[a].runes];
    const n = runes.length + 5;
    expect(drawnGlyphs(draw('runes', { glyphs: a, count: n }))).toEqual([...runes, ...runes.slice(0, 5)]);
  });

  it('runs the zodiac in order from Aries', () => {
    expect(drawnGlyphs(draw('runes', { glyphs: 'zodiac', count: 12 }))).toEqual(ICON_GROUPS.zodiac.icons.slice(0, 12));
  });

  it('shows every symbol in a group before repeating any, in an order set by the seed', () => {
    const icons = glyphSetItems('arcane');
    const drawn = drawnGlyphs(draw('runes', { glyphs: 'arcane', count: icons.length }));
    expect([...drawn].sort()).toEqual([...icons].sort());
    expect(drawn).not.toEqual(icons);
    expect(drawnGlyphs(draw('runes', { glyphs: 'arcane', count: 20 }))).toEqual(drawn.slice(0, 20));
    expect(drawnGlyphs(draw('runes', { glyphs: 'arcane', count: 20 }, { ...CTX, seed: 'other' }))).not.toEqual(drawn.slice(0, 20));
    expect(drawnGlyphs(draw('runes', { glyphs: 'arcane', count: 20, salt: 2 }))).not.toEqual(drawn.slice(0, 20));
  });

  it.each(GLYPH_SETS)('draws %s glyphs filled, inside the band', (set) => {
    const svg = draw('runes', { glyphs: set, count: 10, radius: 0.4, band: 0.1 });
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    if (set !== 'seeded') {
      expect(drawnGlyphs(svg)).toHaveLength(10);
      expect(svg).toContain('<g fill="currentColor" stroke="none">');
      // Half-size at most ~0.4 of the 100px band, so glyphs stay between the band's circles.
      for (const m of svg.matchAll(/scale\(([\d.]+)\)/g)) expect(Number(m[1]) * 1000).toBeLessThanOrEqual(40);
    }
  });
});

describe('text ring rune scripts', () => {
  it.each(RUNE_ALPHABETS)('writes the incantation in %s with ᛫ between words and at the join', (a) => {
    const svg = draw('text', { script: a, text: 'by oath' });
    expect(drawnGlyphs(svg)).toEqual([...transliterate('by', a), RUNE_SEPARATOR, ...transliterate('oath', a), RUNE_SEPARATOR]);
    expect(svg).not.toContain('<textPath');
  });

  it('shows just a separator for text with no letters', () => {
    expect(drawnGlyphs(draw('text', { script: 'elder', text: '123' }))).toEqual([RUNE_SEPARATOR]);
  });

  it('scales the runes with the text size', () => {
    const scale = (fontSize: number) => Number(draw('text', { script: 'elder', text: 'a', fontSize }).match(/scale\(([\d.]+)\)/)?.[1]);
    expect(scale(40) / scale(20)).toBeCloseTo(2);
  });

  it('keeps Latin text and the generated alphabet as they were', () => {
    expect(draw('text', { script: 'latin', text: 'by oath' })).toContain('<textPath');
    expect(drawnGlyphs(draw('text', { script: 'runes', text: 'by oath' }))).toEqual([]);
  });
});

describe('emblem', () => {
  it('draws one symbol, centred, sized by its radius', () => {
    const svg = draw('emblem', { icon: 'ankh', radius: 0.2 });
    expect(drawnGlyphs(svg)).toEqual(['ankh']);
    expect(svg).toContain('translate(0 0) scale(0.2)');
  });

  it('can show a rune', () => {
    expect(drawnGlyphs(draw('emblem', { icon: 'ᛟ' }))).toEqual(['ᛟ']);
  });

  it('adds a surrounding ring when double', () => {
    expect(draw('emblem', { double: true })).toMatch(/<circle r="/);
    expect(draw('emblem')).not.toMatch(/<circle/);
  });

  it('draws nothing for an unknown symbol, rather than broken markup', () => {
    expect(draw('emblem', { icon: 'no-such-symbol' })).toBe('<g fill="currentColor" stroke="none"></g>');
  });
});

describe('sanitizing the new settings', () => {
  const layer = (l: Record<string, unknown>): Layer => normalize({ layers: [l] }).layers[0]!;

  it.each(GLYPH_SETS)('accepts glyph set %s', (g) => expect(layer({ type: 'runes', glyphs: g }).glyphs).toBe(g));
  it.each(SCRIPTS)('accepts script %s', (s) => expect(layer({ type: 'text', script: s }).script).toBe(s));
  it.each(['ankh', 'dragon', 'ᛟ', 'ᛝ', 'aries'])('accepts emblem %s', (i) => expect(layer({ type: 'emblem', icon: i }).icon).toBe(i));

  it.each(['', 'runic', 'Elder', 'triforce', '__proto__', 'constructor', 7, null])('rejects glyph set, script and emblem %j', (v) => {
    expect(layer({ type: 'runes', glyphs: v }).glyphs).toBe('seeded');
    expect(layer({ type: 'text', script: v }).script).toBe('latin');
    expect(layer({ type: 'emblem', icon: v }).icon).toBe('sun');
  });

  it('rejects symbols that exist in RPG Awesome but were left out on purpose', () => {
    for (const icon of ['triforce', 'super-mushroom', 'wifi', 'mp5', 'ice-cube']) expect(layer({ type: 'emblem', icon }).icon).toBe('sun');
  });

  it('resets settings other layer types use', () => {
    expect(layer({ type: 'ring', glyphs: 'elder', icon: 'ankh' })).toMatchObject({ glyphs: 'seeded', icon: 'sun' });
  });
});

describe('presets and the randomizer', () => {
  it('include presets that show off real runes and symbols', () => {
    const runestone = PRESETS['Runestone ward']!().layers;
    expect(runestone.map((l) => l.glyphs)).toContain('elder');
    expect(runestone.map((l) => l.script)).toContain('futhorc');
    expect(PRESETS['Zodiac wheel']!().layers.some((l) => l.type === 'emblem')).toBe(true);
  });

  it('sometimes picks real runes, symbols and emblems, and the same seed always gives the same design', () => {
    const designs = Array.from({ length: 300 }, (_, i) => randomDesign(`r-${i}`).layers);
    const all = designs.flat();
    expect(all.some((l) => l.type === 'runes' && l.glyphs === 'elder')).toBe(true);
    expect(all.some((l) => l.type === 'runes' && l.glyphs === 'seeded')).toBe(true);
    expect(all.some((l) => l.type === 'text' && l.script === 'futhorc')).toBe(true);
    expect(all.some((l) => l.type === 'emblem')).toBe(true);
    const strip = (ls: Layer[]) => ls.map(({ id: _i, salt: _s, ...rest }) => rest);
    expect(strip(randomDesign('r-7').layers)).toEqual(strip(designs[7]!));
  });
});
