import { describe, expect, it } from 'vitest';
import { COMMON_FIELDS, LAYER_TYPES, TYPE_FIELDS, makeLayer, renderers } from '../src/layers';
import { PRESETS } from '../src/presets';
import { buildSvg } from '../src/render';
import { glyph, rng } from '../src/rng';
import type { Design, Layer, LayerType, RenderCtx } from '../src/types';

const CTX: RenderCtx = { seed: 'test-seed', w: 2, bg: '#123456' };

function draw(type: LayerType, props: Partial<Layer> = {}, ctx: RenderCtx = CTX): string {
  return renderers[type](makeLayer(type, { salt: 1, ...props }), ctx);
}

const count = (s: string, re: RegExp): number => (s.match(re) ?? []).length;
/** All `d` attributes of glyph paths (the ones positioned with translate + rotate). */
const glyphPaths = (svg: string): string[] =>
  [...svg.matchAll(/<path transform="translate\([^"]*\) rotate\([^"]*\)" d="([^"]+)"/g)].map((m) => m[1] as string);
/** Every number in a markup string. */
const numbers = (s: string): number[] => (s.match(/-?\d+(\.\d+)?(e-?\d+)?/g) ?? []).map(Number);

function design(layers: Layer[], extra: Partial<Design> = {}): Design {
  return { seed: 's', ink: '#e9c46a', bg: '#0e0b16', transparent: false, lineWeight: 1, spinSpeed: 1, tilt: 0, layers, ...extra };
}

describe('every layer type', () => {
  it.each(LAYER_TYPES)('%s renders markup with valid numbers using its defaults', (type) => {
    const out = draw(type);
    expect(out.length).toBeGreaterThan(0);
    expect(out).not.toMatch(/NaN|undefined|Infinity|null/);
  });

  // Push every slider to its limits: nothing should produce broken numbers.
  it.each(LAYER_TYPES)('%s stays valid at every slider extreme', (type) => {
    const ranges = [...(TYPE_FIELDS[type] ?? []), ...COMMON_FIELDS].filter((f) => f.type === 'range');
    for (const field of ranges) {
      for (const value of [field.min, field.max]) {
        for (const double of [false, true]) {
          const out = draw(type, { [field.key]: value, double } as Partial<Layer>);
          expect(out, `${field.key}=${value} double=${double}`).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });
});

describe('ring', () => {
  it('draws one circle at the layer radius', () => {
    expect(draw('ring', { radius: 0.4 })).toBe('<circle r="400" />');
  });

  it('adds an inner circle for a double line, offset by the stroke width', () => {
    const out = draw('ring', { radius: 0.4, double: true });
    expect(count(out, /<circle/g)).toBe(2);
    expect(out).toContain('r="393.6"'); // 400 - 2 * 3.2
  });
});

describe('polygon', () => {
  it('has one vertex per side, starting at the top', () => {
    const out = draw('polygon', { count: 7, radius: 0.3 });
    const points = out.match(/points="([^"]+)"/)?.[1]?.split(' ') ?? [];
    expect(points).toHaveLength(7);
    expect(points[0]).toBe('0,-300');
  });

  it('puts every vertex on the radius', () => {
    const out = draw('polygon', { count: 9, radius: 0.25 });
    const points = (out.match(/points="([^"]+)"/)?.[1] ?? '').split(' ').map((p) => p.split(',').map(Number));
    for (const [x = 0, y = 0] of points) expect(Math.hypot(x, y)).toBeCloseTo(250, 0);
  });
});

describe('star polygon', () => {
  const pathData = (out: string): string => out.match(/ d="([^"]+)"/)?.[1] ?? '';

  it('draws {5/2} as one closed path through all 5 points', () => {
    const d = pathData(draw('star', { count: 5, step: 2 }));
    expect(count(d, /M/g)).toBe(1);
    expect(count(d, /L/g)).toBe(5);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('draws {6/2} as two separate triangles (a hexagram)', () => {
    const d = pathData(draw('star', { count: 6, step: 2 }));
    expect(count(d, /M/g)).toBe(2);
    expect(count(d, /L/g)).toBe(6);
  });

  it('draws {8/3} as a single path visiting all 8 points', () => {
    const d = pathData(draw('star', { count: 8, step: 3 }));
    expect(count(d, /M/g)).toBe(1);
    expect(count(d, /L/g)).toBe(8);
  });

  it('clamps a step that is too large to the largest valid one', () => {
    expect(draw('star', { count: 5, step: 9 })).toBe(draw('star', { count: 5, step: 2 }));
  });

  it('adds a second, smaller star for a double line', () => {
    expect(count(draw('star', { double: true }), /<path/g)).toBe(2);
  });
});

describe('rune ring', () => {
  it('draws one glyph per count between two bounding circles', () => {
    const out = draw('runes', { count: 17 });
    expect(glyphPaths(out)).toHaveLength(17);
    expect(count(out, /<circle r=/g)).toBe(2);
  });

  it('adds two more circles for a double line', () => {
    expect(count(draw('runes', { double: true }), /<circle r=/g)).toBe(4);
  });

  it('is fully determined by the design seed and the layer salt', () => {
    expect(draw('runes')).toBe(draw('runes'));
    expect(draw('runes')).not.toBe(draw('runes', {}, { ...CTX, seed: 'other-seed' }));
    expect(draw('runes', { salt: 1 })).not.toBe(draw('runes', { salt: 2 }));
  });
});

describe('text ring', () => {
  it('escapes markup in the incantation', () => {
    const out = draw('text', { text: '<script>alert("x")</script> & co' });
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co');
  });

  it('runs the text along a circular path it defines itself', () => {
    const out = draw('text', { text: 'HELLO' });
    const id = out.match(/<path id="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(out).toContain(`href="#${id}"`);
  });

  it('repeats short text to go all the way round', () => {
    const out = draw('text', { text: 'HI', radius: 0.45, fontSize: 20 });
    expect(count(out, /HI/g)).toBeGreaterThan(10);
  });

  describe('seeded rune alphabet', () => {
    it('writes one glyph per letter and a dot for each space plus the end', () => {
      const out = draw('text', { script: 'runes', text: 'AB AB' });
      expect(glyphPaths(out)).toHaveLength(4);
      expect(count(out, /<circle cx=/g)).toBe(2);
    });

    it('always uses the same glyph for the same letter', () => {
      const [a1, b1, a2, b2] = glyphPaths(draw('text', { script: 'runes', text: 'ABAB', fontSize: 20 }));
      expect(a1).toBe(a2);
      expect(b1).toBe(b2);
      expect(a1).not.toBe(b1);
    });

    it('ignores letter case', () => {
      expect(draw('text', { script: 'runes', text: 'rune' })).toBe(draw('text', { script: 'runes', text: 'RUNE' }));
    });

    it('depends on the design seed but not the layer, so a script is consistent across a design', () => {
      const text = { script: 'runes' as const, text: 'OATH' };
      expect(glyphPaths(draw('text', { ...text, salt: 1 }))).toEqual(glyphPaths(draw('text', { ...text, salt: 99 })));
      expect(glyphPaths(draw('text', text))).not.toEqual(glyphPaths(draw('text', text, { ...CTX, seed: 'another' })));
    });
  });
});

describe('dots, orbits and spokes', () => {
  it('draws one filled dot per count at the given size', () => {
    const out = draw('dots', { count: 12, size: 3.5 });
    expect(count(out, /<circle/g)).toBe(12);
    expect(count(out, /r="3.5"/g)).toBe(12);
  });

  it('draws one orbit circle per count, two each when doubled', () => {
    expect(count(draw('orbits', { count: 5 }), /<circle/g)).toBe(5);
    expect(count(draw('orbits', { count: 5, double: true }), /<circle/g)).toBe(10);
  });

  it('draws one spoke per count, from the inner start to the radius', () => {
    const out = draw('spokes', { count: 24, inner: 0, radius: 0.3 });
    expect(count(out, /M/g)).toBe(24);
    expect(out).toContain('M0 0L0 -300');
  });
});

describe('trigrams', () => {
  // 8 trigrams x 3 lines = 24 lines; 12 of them are broken (two segments each).
  it.each(['earlier', 'later'] as const)('%s heaven order draws all 8 trigrams with 36 line segments', (order) => {
    const out = draw('trigrams', { order });
    expect(count(out, /<path/g)).toBe(8);
    expect(count(out, /H/g)).toBe(36);
  });

  it('starts the earlier heaven order with qian (three solid lines)', () => {
    const first = draw('trigrams', { order: 'earlier' }).match(/<path[^>]*>/)?.[0] ?? '';
    expect(count(first, /H/g)).toBe(3);
  });

  it('starts the later heaven order with li (solid, broken, solid)', () => {
    const first = draw('trigrams', { order: 'later' }).match(/<path[^>]*>/)?.[0] ?? '';
    expect(count(first, /H/g)).toBe(4);
  });
});

describe('moon phases', () => {
  it('draws a new moon first (unlit) and a full moon halfway round', () => {
    const moons = draw('phases', { count: 8 }).match(/<g [^>]*>.*?<\/g>/g) ?? [];
    expect(moons).toHaveLength(8);
    expect(moons[0]).not.toContain('fill="currentColor"');
    expect(moons[4]).toMatch(/<circle r="[^"]+" fill="currentColor"/);
    for (const i of [1, 2, 3, 5, 6, 7]) expect(moons[i]).toMatch(/<path[^>]*fill="currentColor"/);
  });

  it('mirrors the waning half', () => {
    const moons = draw('phases', { count: 8 }).match(/<g [^>]*>.*?<\/g>/g) ?? [];
    expect(moons[3]).not.toContain('scale(-1 1)');
    expect(moons[5]).toContain('scale(-1 1)');
  });
});

describe('snowflake arms', () => {
  it('draws arms, two strokes per branch, and short arms between', () => {
    const out = draw('arms', { count: 6, branches: 2, shortArms: true });
    expect(count(out, /M/g)).toBe(6 + 6 * 2 * 2 + 6);
  });

  it('can leave out the short arms', () => {
    expect(count(draw('arms', { count: 6, branches: 0, shortArms: false }), /M/g)).toBe(6);
  });
});

describe('spiral', () => {
  it('runs from the inner start to the outer radius', () => {
    const d = draw('spiral', { radius: 0.3, inner: 0.5, turns: 2 }).match(/ d="([^"]+)"/)?.[1] ?? '';
    const pts = d.split(/[ML]/).filter(Boolean).map((p) => p.split(' ').map(Number));
    const [x0 = 0, y0 = 0] = pts[0] ?? [];
    const [x1 = 0, y1 = 0] = pts[pts.length - 1] ?? [];
    expect(Math.hypot(x0, y0)).toBeCloseTo(150, 0);
    expect(Math.hypot(x1, y1)).toBeCloseTo(300, 0);
  });
});

describe('sigil lines', () => {
  it('connects every node and marks the start and end', () => {
    const out = draw('sigil', { count: 7 });
    expect(count(out.match(/ d="([^"]+)"/)?.[1] ?? '', /L/g)).toBe(6);
    expect(count(out, /<circle/g)).toBe(1);
  });

  it('stays inside its radius', () => {
    const d = draw('sigil', { count: 14, radius: 0.2 }).match(/ d="([^"]+)"/)?.[1] ?? '';
    for (const p of d.split(/[ML]/).filter(Boolean)) {
      const [x = 0, y = 0] = p.split(' ').map(Number);
      expect(Math.hypot(x, y)).toBeLessThanOrEqual(200);
    }
  });

  it('is fully determined by the design seed and the layer salt', () => {
    expect(draw('sigil')).toBe(draw('sigil'));
    expect(draw('sigil')).not.toBe(draw('sigil', { salt: 2 }));
    expect(draw('sigil')).not.toBe(draw('sigil', {}, { ...CTX, seed: 'other' }));
  });
});

describe('yin-yang', () => {
  it('cuts the dot in the filled half using the background colour', () => {
    expect(draw('yinyang')).toContain(`fill="${CTX.bg}"`);
  });
});

describe('glyph', () => {
  it('is deterministic per key', () => {
    expect(glyph('k', 10)).toBe(glyph('k', 10));
    expect(glyph('k', 10)).not.toBe(glyph('j', 10));
  });

  it('only uses path commands and stays within its size', () => {
    for (let i = 0; i < 300; i++) {
      const d = glyph(`key-${i}`, 10);
      expect(d).toMatch(/^M[-\d. LMa]+$/);
      for (const n of numbers(d.replace(/a[^MLa]*/g, ''))) expect(Math.abs(n)).toBeLessThanOrEqual(10);
    }
  });
});

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = rng('seed');
    const b = rng('seed');
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });

  it('keeps int() within its inclusive bounds', () => {
    const r = rng('bounds');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const v = r.int(3, 6);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });
});

describe('buildSvg', () => {
  const ring = (props: Partial<Layer> = {}): Layer => makeLayer('ring', { salt: 0, radius: 0.3, ...props });

  it('leaves out hidden layers', () => {
    const svg = buildSvg(design([ring(), ring({ visible: false })]), { t: 0 });
    expect(count(svg, /data-layer=/g)).toBe(1);
  });

  it('applies rotation plus spin × spin speed × time', () => {
    const svg = buildSvg(design([ring({ rotation: 10, spin: 20 })], { spinSpeed: 0.5 }), { t: 3 });
    expect(svg).toContain('transform="rotate(40)"');
  });

  it('uses the ink colour unless the layer has its own', () => {
    const svg = buildSvg(design([ring(), ring({ ownColor: true, color: '#ff0000' })]), { t: 0 });
    expect(svg).toContain('style="color:#e9c46a"');
    expect(svg).toContain('style="color:#ff0000"');
  });

  it('scales stroke width by the line weight', () => {
    const svg = buildSvg(design([ring({ width: 2 })], { lineWeight: 1.5 }), { t: 0 });
    expect(svg).toContain('stroke-width="3"');
  });

  it('adds a glow filter only to glowing layers', () => {
    const glowing = ring({ glow: 0.5 });
    const svg = buildSvg(design([glowing, ring()]), { t: 0 });
    expect(count(svg, /<filter /g)).toBe(1);
    expect(svg).toContain(`filter="url(#glow-${glowing.id})"`);
  });

  it('dashes dashed layers in proportion to their stroke width', () => {
    expect(buildSvg(design([ring({ dashed: true, width: 2 })]), { t: 0 })).toContain('stroke-dasharray="10 7"');
  });

  it('squashes the circle vertically for ground tilt', () => {
    expect(buildSvg(design([ring()], { tilt: 60 }), { t: 0 })).toContain('transform="scale(1 0.5)"');
  });

  it('draws a background unless transparent, and lets options override the design', () => {
    expect(buildSvg(design([ring()]), { t: 0 })).toContain('fill="#0e0b16"');
    expect(buildSvg(design([ring()], { transparent: true }), { t: 0 })).not.toContain('<rect');
    expect(buildSvg(design([ring()], { transparent: true }), { t: 0, transparent: false, bg: '#00ff00' })).toContain('fill="#00ff00"');
  });

  it('gives exports an intrinsic size', () => {
    const svgTag = (svg: string): string => svg.match(/^<svg[^>]*>/)?.[0] ?? '';
    expect(svgTag(buildSvg(design([]), { t: 0, forExport: true }))).toContain('width="1000" height="1000"');
    expect(svgTag(buildSvg(design([]), { t: 0 }))).not.toContain('width=');
  });
});

describe('preset output', () => {
  // Locks in exactly what every preset draws. These snapshots were taken after the
  // TypeScript port was confirmed to match the original JavaScript version exactly.
  // Layer ids are random, so they're normalized before comparing.
  it.each(Object.keys(PRESETS))('%s', (name) => {
    const template = PRESETS[name]!();
    const d = design(template.layers.map((l, i) => ({ ...l, salt: i })), { seed: 'golden-seed' });
    expect(buildSvg(d, { t: 0 }).replace(/L[a-z0-9]{9,14}/g, 'ID')).toMatchSnapshot();
  });
});
