// Layer types: defaults, editor fields, and SVG renderers.
// Coordinates: viewBox -500..500, so radius 0.5 touches the edge.
import {
  EMBLEM_OPTIONS, GLYPH_SETS, RUNE_SEPARATOR, SCRIPTS, glyphOutline, glyphSetItems, glyphSetLabel,
  isOrderedSet, isRuneAlphabet, scriptLabel, transliterate,
} from './glyphs';
import { fmt as f, glyph, rng } from './rng';
import type { CommonProps, Field, Layer, LayerType, Renderer, TypeParams } from './types';

const TAU = Math.PI * 2;
const S = 1000; // radius units -> px

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
type Pt = [number, number];
const polar = (r: number, a: number): Pt => [Math.sin(a) * r, -Math.cos(a) * r]; // a=0 at top, clockwise
const circle = (r: number, extra = ''): string => `<circle r="${f(r)}" ${extra}/>`;

export const TYPES: Record<LayerType, { label: string; defaults: Partial<TypeParams> }> = {
  ring:     { label: 'Ring',           defaults: {} },
  polygon:  { label: 'Polygon',        defaults: { count: 6 } },
  star:     { label: 'Star polygon',   defaults: { count: 5, step: 2 } },
  runes:    { label: 'Rune ring',      defaults: { count: 24, band: 0.06 } },
  text:     { label: 'Text ring',      defaults: { text: 'BY EMBER AND OATH, BE BOUND', script: 'latin', fontSize: 24 } },
  dots:     { label: 'Dots',           defaults: { count: 12, size: 5 } },
  orbits:   { label: 'Orbit circles',  defaults: { count: 6, size: 0.05 } },
  spokes:   { label: 'Spokes',         defaults: { count: 12, inner: 0.6 } },
  trigrams: { label: 'Trigrams',       defaults: { order: 'earlier', size: 0.07 } },
  phases:   { label: 'Moon phases',    defaults: { count: 8, size: 0.035 } },
  arms:     { label: 'Snowflake arms', defaults: { count: 6, branches: 3, shortArms: true } },
  spiral:   { label: 'Spiral',         defaults: { turns: 3, inner: 0.1 } },
  sigil:    { label: 'Sigil lines',    defaults: { count: 7 } },
  yinyang:  { label: 'Yin-yang',       defaults: {} },
  emblem:   { label: 'Emblem',         defaults: { icon: 'sun' } },
};

export const LAYER_TYPES = Object.keys(TYPES) as LayerType[];
export const isLayerType = (v: unknown): v is LayerType =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(TYPES, v);

const BASE: CommonProps = {
  visible: true, radius: 0.4, width: 2.5, double: false, dashed: false,
  rotation: 0, spin: 0, ownColor: false, color: '#ffffff', glow: 0,
};

/** Fallbacks for every type parameter; each type's own defaults override these. */
const PARAM_DEFAULTS: TypeParams = {
  count: 6, step: 2, band: 0.06, glyphs: 'seeded', text: 'BY EMBER AND OATH, BE BOUND', script: 'latin',
  fontSize: 24, size: 0.05, inner: 0.6, order: 'earlier', turns: 3, branches: 3, shortArms: true, icon: 'sun',
};

/** Default type parameters for a given type. */
export const typeDefaults = (type: LayerType): TypeParams => ({ ...PARAM_DEFAULTS, ...TYPES[type].defaults });

// ---------- Editor field definitions ----------
export const COMMON_FIELDS: Field<Layer>[] = [
  { key: 'radius', label: 'Radius', type: 'range', min: 0, max: 0.5, step: 0.005 },
  { key: 'width', label: 'Line width', type: 'range', min: 0.25, max: 12, step: 0.25, unit: 'px' },
  { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
  { key: 'spin', label: 'Spin', type: 'range', min: -90, max: 90, step: 1, unit: '°/s' },
  { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.05 },
  { key: 'double', label: 'Double line', type: 'check' },
  { key: 'dashed', label: 'Dashed', type: 'check' },
  { key: 'ownColor', label: 'Own color', type: 'check' },
  { key: 'color', label: 'Color', type: 'color', showIf: (l) => l.ownColor },
];

export const TYPE_FIELDS: Partial<Record<LayerType, Field<Layer>[]>> = {
  polygon: [{ key: 'count', label: 'Sides', type: 'range', min: 3, max: 24, step: 1 }],
  star: [
    { key: 'count', label: 'Points', type: 'range', min: 5, max: 24, step: 1 },
    { key: 'step', label: 'Step', type: 'range', min: 2, max: 11, step: 1 },
  ],
  runes: [
    { key: 'glyphs', label: 'Glyphs', type: 'select', options: GLYPH_SETS.map((g) => [g, glyphSetLabel(g)] as const) },
    { key: 'count', label: 'Count', type: 'range', min: 4, max: 72, step: 1 },
    { key: 'band', label: 'Band height', type: 'range', min: 0.02, max: 0.15, step: 0.005 },
  ],
  text: [
    { key: 'text', label: 'Incantation', type: 'textarea' },
    { key: 'script', label: 'Script', type: 'select', options: SCRIPTS.map((sc) => [sc, scriptLabel(sc)] as const) },
    { key: 'fontSize', label: 'Size', type: 'range', min: 8, max: 64, step: 1 },
  ],
  dots: [
    { key: 'count', label: 'Count', type: 'range', min: 1, max: 120, step: 1 },
    { key: 'size', label: 'Dot size', type: 'range', min: 1, max: 24, step: 0.5 },
  ],
  orbits: [
    { key: 'count', label: 'Count', type: 'range', min: 1, max: 24, step: 1 },
    { key: 'size', label: 'Circle size', type: 'range', min: 0.01, max: 0.2, step: 0.005 },
  ],
  spokes: [
    { key: 'count', label: 'Count', type: 'range', min: 1, max: 120, step: 1 },
    { key: 'inner', label: 'Inner start', type: 'range', min: 0, max: 0.98, step: 0.01 },
  ],
  trigrams: [
    { key: 'order', label: 'Order', type: 'select', options: [['earlier', 'Earlier Heaven'], ['later', 'Later Heaven']] },
    { key: 'size', label: 'Symbol size', type: 'range', min: 0.03, max: 0.15, step: 0.005 },
  ],
  phases: [
    { key: 'count', label: 'Phases', type: 'range', min: 4, max: 24, step: 1 },
    { key: 'size', label: 'Moon size', type: 'range', min: 0.01, max: 0.1, step: 0.0025 },
  ],
  arms: [
    { key: 'count', label: 'Arms', type: 'range', min: 3, max: 16, step: 1 },
    { key: 'branches', label: 'Branches', type: 'range', min: 0, max: 6, step: 1 },
    { key: 'shortArms', label: 'Short arms between', type: 'check' },
  ],
  spiral: [
    { key: 'turns', label: 'Turns', type: 'range', min: 0.5, max: 14, step: 0.5 },
    { key: 'inner', label: 'Inner start', type: 'range', min: 0, max: 0.9, step: 0.01 },
  ],
  sigil: [{ key: 'count', label: 'Nodes', type: 'range', min: 3, max: 14, step: 1 }],
  emblem: [{ key: 'icon', label: 'Symbol', type: 'picker', groups: EMBLEM_OPTIONS }],
};

let counter = 0;
export const newLayerId = (): string => 'L' + Date.now().toString(36) + (counter++).toString(36);
export const randomSalt = (): number => Math.floor(Math.random() * 1e6);

export function makeLayer(type: LayerType, props: Partial<Layer> = {}): Layer {
  return {
    id: newLayerId(),
    salt: randomSalt(),
    type,
    ...BASE,
    ...typeDefaults(type),
    ...props,
  };
}

// ---------- Renderers: (layer, ctx) -> inner SVG markup ----------

function polyPoints(n: number, r: number, offset = 0): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) pts.push(polar(r, (i / n) * TAU + offset));
  return pts;
}
const ptsAttr = (pts: Pt[]): string => pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const deg = (rad: number): number => f((rad * 180) / Math.PI);

/** Glyphs evenly spaced around a circle; a null key draws a small dot (word gap). */
function glyphsAround(keys: Array<string | null>, rMid: number, s: number, sw: number): string {
  const n = keys.length;
  let out = `<g stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round">`;
  keys.forEach((key, i) => {
    const a = (i / n) * TAU;
    const [x, y] = polar(rMid, a);
    if (key === null) {
      out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(sw, s * 0.12))}" fill="currentColor" stroke="none"/>`;
    } else {
      out += `<path transform="translate(${f(x)} ${f(y)}) rotate(${deg(a)})" d="${glyph(key, s)}"/>`;
    }
  });
  return out + '</g>';
}

/** Scale factors need more precision than coordinates: a glyph may be drawn at 0.005×. */
const fs = (n: number): number => Math.round(n * 1e5) / 1e5;

/** A filled glyph outline (rune or symbol) centred at x,y, rotated, with half-size `half`. */
function outlineAt(key: string, x: number, y: number, rotDeg: number, half: number): string {
  const d = glyphOutline(key);
  if (!d) return '';
  const rot = rotDeg ? ` rotate(${f(rotDeg)})` : '';
  return `<path transform="translate(${f(x)} ${f(y)})${rot} scale(${fs(half / 1000)})" d="${d}"/>`;
}

/** Filled glyphs evenly spaced around a circle, upright towards the outside. */
function outlinesAround(keys: readonly string[], rMid: number, half: number): string {
  const n = keys.length;
  let out = '<g fill="currentColor" stroke="none">';
  keys.forEach((key, i) => {
    const a = (i / n) * TAU;
    const [x, y] = polar(rMid, a);
    out += outlineAt(key, x, y, deg(a), half);
  });
  return out + '</g>';
}

/** Seeded order of a set's glyphs, so every glyph appears before any repeats. */
function shuffled<T>(items: readonly T[], key: string): T[] {
  const r = rng(key);
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(0, i);
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

// Trigram lines listed bottom (inner) to top (outer); 1 = solid, 0 = broken.
type TrigramName = 'qian' | 'dui' | 'li' | 'zhen' | 'xun' | 'kan' | 'gen' | 'kun';
const TRI: Record<TrigramName, readonly [number, number, number]> = {
  qian: [1, 1, 1], dui: [1, 1, 0], li: [1, 0, 1], zhen: [1, 0, 0],
  xun: [0, 1, 1], kan: [0, 1, 0], gen: [0, 0, 1], kun: [0, 0, 0],
};
const ORDERS: Record<Layer['order'], readonly TrigramName[]> = {
  earlier: ['qian', 'xun', 'kan', 'gen', 'kun', 'zhen', 'li', 'dui'],
  later: ['li', 'kun', 'dui', 'qian', 'kan', 'gen', 'zhen', 'xun'],
};

export const renderers: Record<LayerType, Renderer> = {
  ring: (l, c) => {
    const r = l.radius * S;
    let out = circle(r);
    if (l.double) out += circle(r - c.w * 3.2);
    return out;
  },

  polygon: (l, c) => {
    const r = l.radius * S;
    let out = `<polygon points="${ptsAttr(polyPoints(l.count, r))}"/>`;
    if (l.double) {
      const r2 = r - (c.w * 3.2) / Math.cos(Math.PI / l.count);
      out += `<polygon points="${ptsAttr(polyPoints(l.count, r2))}"/>`;
    }
    return out;
  },

  star: (l, c) => {
    const n = l.count;
    const k = Math.max(1, Math.min(l.step, Math.floor((n - 1) / 2)));
    const draw = (r: number): string => {
      const pts = polyPoints(n, r);
      const at = (i: number): Pt => pts[i] as Pt;
      let d = '';
      for (let s = 0; s < gcd(n, k); s++) {
        let i = s;
        d += `M${f(at(i)[0])} ${f(at(i)[1])}`;
        do {
          i = (i + k) % n;
          d += `L${f(at(i)[0])} ${f(at(i)[1])}`;
        } while (i !== s);
        d += 'Z';
      }
      return `<path d="${d}" stroke-linejoin="miter"/>`;
    };
    let out = draw(l.radius * S);
    if (l.double) out += draw(l.radius * S - c.w * 4);
    return out;
  },

  runes: (l, c) => {
    const r = l.radius * S;
    const band = l.band * S;
    let out = circle(r) + circle(r - band);
    if (l.double) out += circle(r + c.w * 3.2) + circle(r - band - c.w * 3.2);
    if (l.glyphs === 'seeded') {
      const keys: string[] = [];
      for (let i = 0; i < l.count; i++) keys.push(`${c.seed}:${l.salt}:${i}`);
      return out + glyphsAround(keys, r - band / 2, band * 0.3, Math.max(0.5, c.w * 0.75));
    }
    // Alphabets and the zodiac run in order; other symbol sets in a seeded order.
    const set = glyphSetItems(l.glyphs);
    const order = isOrderedSet(l.glyphs) ? set : shuffled(set, `set:${c.seed}:${l.salt}`);
    const keys = Array.from({ length: l.count }, (_, i) => order[i % order.length] as string);
    // Runes are taller than wide; symbols are drawn a little larger to fill the band.
    const half = band * (isRuneAlphabet(l.glyphs) ? 0.33 : 0.38);
    return out + outlinesAround(keys, r - band / 2, half);
  },

  text: (l, c) => {
    const r = l.radius * S;
    const raw = (l.text || '').trim() || '·';
    if (isRuneAlphabet(l.script)) {
      // Real runes, written phonetically from the Latin text, words split by ᛫.
      const keys = transliterate(raw, l.script).map((k) => k ?? RUNE_SEPARATOR);
      keys.push(RUNE_SEPARATOR);
      const half = l.fontSize * 0.5;
      return outlinesAround(keys, r, half) + (l.double ? circle(r + half * 1.8) + circle(r - half * 1.8) : '');
    }
    if (l.script === 'runes') {
      // Each letter maps to a glyph from a per-seed alphabet, so the same word
      // always reads the same way in a given design: a usable constructed script.
      const keys: Array<string | null> = [...raw.toUpperCase()].map((ch) => (/\s/.test(ch) ? null : `alpha:${c.seed}:${ch}`));
      keys.push(null);
      const s = l.fontSize * 0.5;
      return glyphsAround(keys, r, s, Math.max(1.2, c.w * 0.85)) + (l.double ? circle(r + s * 1.8) + circle(r - s * 1.8) : '');
    }
    const circ = TAU * r;
    const unit = raw + ' ✦ ';
    const approx = unit.length * l.fontSize * 0.62;
    const str = unit.repeat(Math.max(1, Math.floor(circ / approx)));
    const id = 'tp-' + l.id;
    let out = `<path id="${id}" fill="none" stroke="none" d="M0 ${f(-r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(-r)}"/>`;
    out += `<text font-family="Georgia, 'Times New Roman', serif" font-size="${l.fontSize}" letter-spacing="1" fill="currentColor" stroke="none" dominant-baseline="middle">` +
      `<textPath href="#${id}" xlink:href="#${id}" textLength="${f(circ * 0.995)}" lengthAdjust="spacing">${esc(str)}</textPath></text>`;
    if (l.double) out += circle(r + l.fontSize * 0.75) + circle(r - l.fontSize * 0.75);
    return out;
  },

  dots: (l) =>
    polyPoints(l.count, l.radius * S)
      .map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(l.size)}" fill="currentColor" stroke="none"/>`)
      .join(''),

  orbits: (l, c) => {
    const s = l.size * S;
    return polyPoints(l.count, l.radius * S)
      .map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}"/>` +
        (l.double ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(1, s - c.w * 3))}"/>` : ''))
      .join('');
  },

  spokes: (l) => {
    const r = l.radius * S;
    const ri = r * l.inner;
    let d = '';
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * TAU;
      const [x1, y1] = polar(ri, a);
      const [x2, y2] = polar(r, a);
      d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
    }
    return `<path d="${d}"/>`;
  },

  trigrams: (l) => {
    const r = l.radius * S;
    const s = l.size * S;
    const gap = s * 0.42, half = s * 0.7, brk = s * 0.13, sw = s * 0.17;
    return ORDERS[l.order].map((name, i) => {
      let d = '';
      TRI[name].forEach((solid, j) => {
        const y = -(r - (2 - j) * gap);
        d += solid ? `M${f(-half)} ${f(y)}H${f(half)}` : `M${f(-half)} ${f(y)}H${f(-brk)}M${f(brk)} ${f(y)}H${f(half)}`;
      });
      return `<path transform="rotate(${i * 45})" d="${d}" stroke-width="${f(sw)}" stroke-linecap="butt"/>`;
    }).join('');
  },

  phases: (l) => {
    const r = l.radius * S;
    const s = l.size * S;
    let out = '';
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * TAU;
      const [x, y] = polar(r, a);
      const p = i / l.count; // 0 = new, 0.5 = full
      const k = Math.cos(p * TAU);
      let lit = '';
      if (Math.abs(p - 0.5) < 1e-6) {
        lit = `<circle r="${f(s)}" fill="currentColor" stroke="none"/>`;
      } else if (p > 0) {
        const sweep = k > 0 ? 0 : 1;
        lit = `<path ${p > 0.5 ? 'transform="scale(-1 1)"' : ''} fill="currentColor" stroke="none" d="M0 ${f(-s)}A${f(s)} ${f(s)} 0 0 1 0 ${f(s)}A${f(Math.abs(k) * s)} ${f(s)} 0 0 ${sweep} 0 ${f(-s)}Z"/>`;
      }
      out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${deg(a)})"><circle r="${f(s)}"/>${lit}</g>`;
    }
    return out;
  },

  arms: (l) => {
    const r = l.radius * S;
    let d = '';
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * TAU;
      const [x, y] = polar(r, a);
      d += `M0 0L${f(x)} ${f(y)}`;
      for (let b = 1; b <= l.branches; b++) {
        const t = b / (l.branches + 1);
        const len = r * 0.22 * (1 - t * 0.55);
        const [bx, by] = polar(r * t, a);
        for (const side of [-1, 1]) {
          const [ex, ey] = polar(len, a + side * (Math.PI / 4));
          d += `M${f(bx)} ${f(by)}l${f(ex)} ${f(ey)}`;
        }
      }
      if (l.shortArms) {
        const [sx, sy] = polar(r * 0.42, a + Math.PI / l.count);
        d += `M0 0L${f(sx)} ${f(sy)}`;
      }
    }
    return `<path d="${d}" stroke-linecap="round"/>`;
  },

  spiral: (l) => {
    const r = l.radius * S;
    const ri = r * l.inner;
    const steps = Math.ceil(80 * l.turns);
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = polar(ri + (r - ri) * t, l.turns * TAU * t);
      d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
    }
    return `<path d="${d}" stroke-linecap="round"/>`;
  },

  sigil: (l, c) => {
    const r = l.radius * S;
    const rnd = rng(`sigil:${c.seed}:${l.salt}`);
    const pts: Pt[] = [];
    for (let i = 0; i < l.count; i++) {
      const a = rnd() * TAU;
      const dist = Math.sqrt(rnd()) * r * 0.92;
      pts.push(polar(dist, a));
    }
    const d = pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('');
    let out = `<path d="${d}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const [sx, sy] = pts[0] as Pt;
    const [ex, ey] = pts[pts.length - 1] as Pt;
    const nr = Math.max(4, c.w * 2.4);
    out += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(nr)}"/>`; // start mark
    out += `<path d="M${f(ex - nr)} ${f(ey)}H${f(ex + nr)}" stroke-linecap="round"/>`; // end bar
    return out;
  },

  yinyang: (l, c) => {
    const r = l.radius * S;
    const h = r / 2;
    const dot = r / 7;
    return circle(r) +
      `<path fill="currentColor" stroke="none" d="M0 ${f(-r)}A${f(h)} ${f(h)} 0 0 1 0 0A${f(h)} ${f(h)} 0 0 0 0 ${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(-r)}Z"/>` +
      `<circle cy="${f(-h)}" r="${f(dot)}" fill="${c.bg}" stroke="none"/>` +
      `<circle cy="${f(h)}" r="${f(dot)}" fill="currentColor" stroke="none"/>`;
  },

  emblem: (l) =>
    `<g fill="currentColor" stroke="none">${outlineAt(l.icon, 0, 0, 0, l.radius * S)}</g>` +
    (l.double ? circle(l.radius * S * 1.12) : ''),
};
