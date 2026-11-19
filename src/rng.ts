// Seeded randomness + procedural rune glyphs.

export interface Rng {
  (): number;
  range(lo: number, hi: number): number;
  int(lo: number, hi: number): number;
  pick<T>(arr: readonly T[]): T;
  chance(p: number): boolean;
}

/** String -> 32-bit hash (xmur3). */
export function hash(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** Deterministic PRNG (mulberry32) seeded from a string. */
export function rng(seedStr: string): Rng {
  let a = hash(String(seedStr));
  const next = (() => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
  next.pick = <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)] as T;
  next.chance = (p) => next() < p;
  return next;
}

/** Round to 2 decimals for compact SVG output. */
export const fmt = (n: number): number => Math.round(n * 100) / 100;

type Pt = readonly [number, number];

/**
 * A rune is 2-4 strokes on a 3x5 grid, usually anchored by a stem.
 * Returns an SVG path "d" string centred on 0,0 with half-height s.
 */
export function glyph(key: string, s: number): string {
  const r = rng('glyph:' + key);
  const gx = [-0.6, 0, 0.6] as const;
  const gy = [-1, -0.5, 0, 0.5, 1] as const;
  const pt = (): Pt => [r.pick(gx), r.pick(gy)];
  const segs: Array<[Pt, Pt]> = [];
  let stemX: number | null = null;
  if (r.chance(0.7)) {
    stemX = r.pick([0, 0, -0.6, 0.6]);
    segs.push([[stemX, -1], [stemX, 1]]);
  }
  const strokes = r.int(stemX !== null ? 1 : 2, stemX !== null ? 3 : 4);
  for (let i = 0; i < strokes; i++) {
    let a = pt();
    let b = pt();
    let guard = 0;
    while (a[0] === b[0] && a[1] === b[1] && guard++ < 10) b = pt();
    // Bias toward diagonal "branch" strokes that touch the stem.
    if (stemX !== null && r.chance(0.5)) a = [stemX, r.pick(gy)];
    segs.push([a, b]);
  }
  let d = segs
    .map(([a, b]) => `M${fmt(a[0] * s)} ${fmt(a[1] * s)}L${fmt(b[0] * s)} ${fmt(b[1] * s)}`)
    .join('');
  // Occasional ornament: a small ring.
  if (r.chance(0.18)) {
    const cx = r.pick(gx);
    const cy = r.pick([-0.5, 0, 0.5]);
    const cr = s * 0.22;
    d += `M${fmt(cx * s + cr)} ${fmt(cy * s)}a${fmt(cr)} ${fmt(cr)} 0 1 0 ${fmt(-2 * cr)} 0a${fmt(cr)} ${fmt(cr)} 0 1 0 ${fmt(2 * cr)} 0`;
  }
  return d;
}

const WORDS = ['ember', 'veil', 'thorn', 'oath', 'moth', 'cinder', 'lumen', 'hollow', 'rune', 'wyrd',
  'sable', 'aster', 'gloam', 'ichor', 'nadir', 'zenith', 'myrrh', 'brine', 'quill', 'ward'] as const;

export function randomSeed(): string {
  const r = rng(String(Math.random()));
  return `${r.pick(WORDS)}-${r.pick(WORDS)}-${r.int(10, 99)}`;
}
