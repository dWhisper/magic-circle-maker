// Built-in presets, color themes, and the balanced randomizer.
import { makeLayer as L } from './layers';
import { rng } from './rng';
import type { DesignTemplate, GlyphSet, Layer, Script } from './types';

export const THEMES: Record<string, { ink: string; bg: string }> = {
  'Gilded night':   { ink: '#e9c46a', bg: '#0e0b16' },
  'Arcane violet':  { ink: '#c4a7ff', bg: '#120a20' },
  'Hellfire':       { ink: '#ff5a36', bg: '#140606' },
  'Spectral cyan':  { ink: '#5ef2ff', bg: '#04121a' },
  'Verdant':        { ink: '#7ee08a', bg: '#07140b' },
  'Ink on vellum':  { ink: '#2a1d12', bg: '#efe3c8' },
  'Blood on bone':  { ink: '#8f1d1d', bg: '#ece6da' },
  'Frost':          { ink: '#d8f1ff', bg: '#0b1626' },
};

export const PRESETS: Record<string, () => DesignTemplate> = {
  'Summoning circle': () => ({
    theme: 'Hellfire',
    layers: [
      L('ring', { radius: 0.48, width: 3, double: true }),
      L('runes', { radius: 0.455, count: 30, band: 0.065, spin: 4 }),
      L('star', { radius: 0.385, count: 5, step: 2, width: 3, glow: 0.4 }),
      L('ring', { radius: 0.385, width: 2 }),
      L('orbits', { radius: 0.385, count: 5, size: 0.035, spin: -6 }),
      L('text', { radius: 0.2, script: 'runes', text: 'COME FORTH', fontSize: 26, spin: -8 }),
      L('ring', { radius: 0.15, width: 2 }),
      L('sigil', { radius: 0.13, count: 6, width: 2.5, glow: 0.5 }),
    ],
  }),
  'Transmutation array': () => ({
    theme: 'Spectral cyan',
    layers: [
      L('ring', { radius: 0.48, width: 3 }),
      L('text', { radius: 0.455, text: 'SOLVE ET COAGULA · AS ABOVE SO BELOW', fontSize: 20, spin: 3 }),
      L('ring', { radius: 0.43, width: 2 }),
      L('polygon', { radius: 0.43, count: 3, width: 2.5 }),
      L('polygon', { radius: 0.43, count: 3, rotation: 180, width: 1.5, dashed: true }),
      L('ring', { radius: 0.215, width: 2 }),
      L('polygon', { radius: 0.215, count: 4, rotation: 45, width: 2 }),
      L('orbits', { radius: 0.43, count: 3, size: 0.04, glow: 0.4 }),
      L('dots', { radius: 0.08, count: 6, size: 4, spin: 20 }),
    ],
  }),
  'Hexagram seal': () => ({
    theme: 'Gilded night',
    layers: [
      L('ring', { radius: 0.48, width: 2.5, double: true }),
      L('text', { radius: 0.445, script: 'runes', text: 'SEALED BY THE SIXFOLD NAME', fontSize: 22, spin: -3 }),
      L('ring', { radius: 0.41, width: 2 }),
      L('star', { radius: 0.41, count: 6, step: 2, width: 2.5, glow: 0.3 }),
      L('polygon', { radius: 0.237, count: 6, rotation: 30, width: 1.5 }),
      L('ring', { radius: 0.205, width: 1.5 }),
      L('spokes', { radius: 0.205, count: 6, inner: 0, width: 1 }),
      L('dots', { radius: 0.32, count: 6, size: 6, rotation: 30 }),
    ],
  }),
  'Elven sigil': () => ({
    theme: 'Verdant',
    layers: [
      L('ring', { radius: 0.47, width: 1 }),
      L('dots', { radius: 0.455, count: 72, size: 1.5, spin: 2 }),
      L('ring', { radius: 0.44, width: 1 }),
      L('star', { radius: 0.42, count: 7, step: 3, width: 1.25, glow: 0.35 }),
      L('orbits', { radius: 0.42, count: 7, size: 0.025, width: 1 }),
      L('phases', { radius: 0.26, count: 8, size: 0.03, width: 1, spin: -4 }),
      L('ring', { radius: 0.2, width: 1 }),
      L('arms', { radius: 0.16, count: 7, branches: 2, shortArms: false, width: 1.25 }),
    ],
  }),
  'Arcane clock': () => ({
    theme: 'Arcane violet',
    layers: [
      L('ring', { radius: 0.48, width: 3 }),
      L('spokes', { radius: 0.47, count: 60, inner: 0.95, width: 1 }),
      L('spokes', { radius: 0.47, count: 12, inner: 0.88, width: 3.5 }),
      L('runes', { radius: 0.4, count: 12, band: 0.07, spin: -2 }),
      L('ring', { radius: 0.3, width: 1.5, dashed: true, spin: 10 }),
      L('spiral', { radius: 0.27, turns: 4, inner: 0.15, width: 1.25, spin: 30, glow: 0.3 }),
      L('spokes', { radius: 0.33, count: 1, inner: 0, width: 3, spin: 6 }),
      L('spokes', { radius: 0.22, count: 1, inner: 0, width: 5, spin: 0.5, rotation: 120 }),
      L('dots', { radius: 0.0, count: 1, size: 9 }),
    ],
  }),
  'Bagua ward': () => ({
    theme: 'Ink on vellum',
    layers: [
      L('ring', { radius: 0.48, width: 3, double: true }),
      L('polygon', { radius: 0.465, count: 8, rotation: 22.5, width: 1.5 }),
      L('trigrams', { radius: 0.42, order: 'later', size: 0.07 }),
      L('ring', { radius: 0.29, width: 2 }),
      L('dots', { radius: 0.255, count: 24, size: 2 }),
      L('yinyang', { radius: 0.2, width: 2.5, spin: 12 }),
    ],
  }),
  'Frost ward': () => ({
    theme: 'Frost',
    layers: [
      L('ring', { radius: 0.48, width: 1.5, double: true, glow: 0.4 }),
      L('text', { radius: 0.445, text: 'HOLD · STILL · WINTER · KEEP', fontSize: 18 }),
      L('polygon', { radius: 0.42, count: 6, width: 1.5 }),
      L('star', { radius: 0.42, count: 12, step: 5, width: 0.75, spin: -3 }),
      L('arms', { radius: 0.36, count: 6, branches: 3, width: 2, glow: 0.6, spin: 4 }),
      L('ring', { radius: 0.08, width: 2 }),
    ],
  }),
  'Lunar rite': () => ({
    theme: 'Gilded night',
    layers: [
      L('ring', { radius: 0.48, width: 2 }),
      L('phases', { radius: 0.44, count: 12, size: 0.03, width: 1.25, spin: -2 }),
      L('ring', { radius: 0.4, width: 2 }),
      L('text', { radius: 0.37, script: 'runes', text: 'SHE WHO WAXES SHE WHO WANES', fontSize: 20, spin: 3 }),
      L('ring', { radius: 0.335, width: 1 }),
      L('star', { radius: 0.335, count: 9, step: 4, width: 1, glow: 0.25 }),
      L('orbits', { radius: 0.0, count: 1, size: 0.1, width: 2, double: true }),
    ],
  }),
  'Runestone ward': () => ({
    theme: 'Ink on vellum',
    layers: [
      L('ring', { radius: 0.48, width: 3, double: true }),
      L('runes', { radius: 0.455, glyphs: 'elder', count: 24, band: 0.07, spin: 3 }),
      L('ring', { radius: 0.37, width: 2 }),
      L('text', { radius: 0.335, script: 'futhorc', text: 'WARD THIS HALL FROM ALL HARM', fontSize: 26, spin: -2 }),
      L('ring', { radius: 0.3, width: 1.5 }),
      L('star', { radius: 0.3, count: 8, step: 3, width: 2 }),
      L('ring', { radius: 0.17, width: 2, double: true }),
      L('emblem', { radius: 0.1, icon: 'ᛉ', glow: 0.15 }),
    ],
  }),
  'Zodiac wheel': () => ({
    theme: 'Gilded night',
    layers: [
      L('ring', { radius: 0.48, width: 3 }),
      L('runes', { radius: 0.465, glyphs: 'zodiac', count: 12, band: 0.085, spin: 2 }),
      L('ring', { radius: 0.37, width: 1.5 }),
      L('spokes', { radius: 0.37, count: 12, inner: 0.55, width: 1 }),
      L('star', { radius: 0.29, count: 12, step: 5, width: 1.5, glow: 0.3, spin: -3 }),
      L('ring', { radius: 0.19, width: 2 }),
      L('emblem', { radius: 0.13, icon: 'sun', spin: -6, glow: 0.25 }),
    ],
  }),
  'Sci-fi HUD': () => ({
    theme: 'Spectral cyan',
    layers: [
      L('ring', { radius: 0.48, width: 1.5, dashed: true, spin: 6 }),
      L('spokes', { radius: 0.46, count: 90, inner: 0.96, width: 1, spin: -3 }),
      L('ring', { radius: 0.42, width: 5, dashed: true, spin: -12, glow: 0.4 }),
      L('polygon', { radius: 0.36, count: 6, width: 1.5, double: true }),
      L('spokes', { radius: 0.34, count: 4, inner: 0.7, width: 3, spin: 20 }),
      L('ring', { radius: 0.24, width: 1 }),
      L('dots', { radius: 0.2, count: 36, size: 1.5, spin: -30 }),
      L('ring', { radius: 0.1, width: 3, glow: 0.6 }),
    ],
  }),
};

// Balanced random design: work inward from the edge, picking a band per step.
// Glyph choices draw from their own generator, so adding them didn't change
// any other part of the design a given seed produces.
const RANDOM_GLYPHS: readonly GlyphSet[] = [
  'seeded', 'seeded', 'seeded', 'seeded', 'elder', 'elder', 'futhorc', 'younger', 'medieval', 'zodiac', 'arcane', 'elements',
];
const RANDOM_SCRIPTS: readonly Script[] = ['runes', 'runes', 'elder', 'futhorc', 'younger'];
const RANDOM_EMBLEMS = ['sun', 'moon-sun', 'ankh', 'circle-of-circles', 'aura', 'eyeball', 'hand-emblem',
  'crystal-ball', 'trefoil-lily', 'radial-balance', 'fire-symbol', 'snowflake', 'ᛟ', 'ᛉ', 'ᛞ', 'ᛝ'] as const;

export function randomDesign(seed: string): DesignTemplate {
  const r = rng('design:' + seed);
  const g = rng('glyph-choice:' + seed);
  const layers: Layer[] = [];
  let rad = r.range(0.46, 0.49);
  layers.push(L('ring', { radius: rad, width: r.range(2, 3.5), double: r.chance(0.6) }));
  const spinDir = (): number => r.pick([-1, 1]) * r.int(0, 8);

  const bandKinds = ['runes', 'runes', 'text', 'dots', 'spokes', 'phases', 'trigrams'] as const;
  const bands = r.int(1, 2);
  for (let i = 0; i < bands; i++) {
    const kind = r.pick(bandKinds);
    rad -= 0.015;
    if (kind === 'runes') {
      const band = r.range(0.05, 0.075);
      layers.push(L('runes', { radius: rad, band, count: r.int(16, 36), spin: spinDir(), glyphs: g.pick(RANDOM_GLYPHS) }));
      rad -= band + 0.01;
    } else if (kind === 'text') {
      const fs = r.int(18, 24);
      const script = r.pick(['latin', 'runes'] as const) === 'latin' ? 'latin' : g.pick(RANDOM_SCRIPTS);
      layers.push(L('text', { radius: rad - fs * 0.0006, fontSize: fs, script, spin: spinDir() }));
      rad -= fs * 0.0016 + 0.01;
    } else if (kind === 'dots') {
      layers.push(L('dots', { radius: rad, count: r.int(8, 48), size: r.range(2, 5) }));
      rad -= 0.025;
    } else if (kind === 'spokes') {
      layers.push(L('spokes', { radius: rad, count: r.pick([12, 24, 36, 60]), inner: 0.92, width: 1 }));
      rad -= 0.05;
    } else if (kind === 'phases') {
      layers.push(L('phases', { radius: rad - 0.03, count: r.pick([8, 12]), size: 0.028, width: 1.25 }));
      rad -= 0.07;
    } else {
      layers.push(L('trigrams', { radius: rad - 0.01, size: 0.06, order: r.pick(['earlier', 'later']) }));
      rad -= 0.14;
    }
    layers.push(L('ring', { radius: rad, width: r.range(1, 2.5) }));
  }

  // Central geometry
  const n = r.pick([5, 6, 7, 8, 9, 12]);
  const step = n === 6 ? 2 : r.int(2, Math.floor((n - 1) / 2));
  layers.push(L('star', { radius: rad, count: n, step, width: r.range(1.5, 3), glow: r.range(0, 0.5), spin: spinDir() }));
  if (r.chance(0.5)) layers.push(L('polygon', { radius: rad, count: n, width: 1.25, rotation: r.chance(0.5) ? 180 / n : 0 }));
  if (r.chance(0.6)) layers.push(L('orbits', { radius: rad, count: n, size: r.range(0.02, 0.045) }));

  const inner = rad * r.range(0.3, 0.45);
  layers.push(L('ring', { radius: inner, width: r.range(1.5, 2.5), double: r.chance(0.4) }));
  const core = r.pick(['sigil', 'yinyang', 'spiral', 'arms', 'star', 'dots'] as const);
  // Every entry is evaluated (and draws from the RNG) so a seed always gives the same design.
  const coreProps: Record<typeof core, Partial<Layer>> = {
    sigil: { count: r.int(5, 8), width: 2.5, glow: 0.4 },
    yinyang: { width: 2 },
    spiral: { turns: r.int(2, 5), inner: 0.1, width: 1.5 },
    arms: { count: n, branches: r.int(1, 3), width: 1.5 },
    star: { count: n, step: 2, width: 1.5 },
    dots: { count: n, size: 4 },
  };
  const spin = spinDir();
  if (g.chance(0.2)) layers.push(L('emblem', { radius: inner * 0.62, spin, icon: g.pick(RANDOM_EMBLEMS), glow: 0.15 }));
  else layers.push(L(core, { radius: inner * 0.82, spin, ...coreProps[core] }));

  return { theme: r.pick(Object.keys(THEMES)), layers };
}
