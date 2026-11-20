// Creating designs and sanitizing ones that arrive from share links, files or storage.
import { COMMON_FIELDS, TYPE_FIELDS, isLayerType, makeLayer, typeDefaults } from './layers';
import { EMBLEMS, GLYPH_SETS, SCRIPTS } from './glyphs';
import { randomSeed } from './rng';
import type { Design, Field, Layer, LayerType, TypeParams } from './types';

export function baseDesign(): Design {
  return {
    seed: randomSeed(), ink: '#e9c46a', bg: '#0e0b16', transparent: false,
    lineWeight: 1, spinSpeed: 1, tilt: 0, layers: [],
  };
}

/** Design-wide sliders. Their ranges are also the limits the sanitizer enforces. */
export const DESIGN_FIELDS: Field<Design>[] = [
  { key: 'ink', label: 'Ink', type: 'color' },
  { key: 'bg', label: 'Background', type: 'color' },
  { key: 'lineWeight', label: 'Line weight', type: 'range', min: 0.25, max: 4, step: 0.05, unit: '×' },
  { key: 'spinSpeed', label: 'Spin speed', type: 'range', min: 0, max: 5, step: 0.1, unit: '×' },
  { key: 'tilt', label: 'Ground tilt', type: 'range', min: 0, max: 75, step: 1, unit: '°' },
];

// ---------- Sanitizing ----------
// Designs can arrive from share links and files, so treat every value as hostile:
//  - values end up in SVG markup, so strings are checked (colours) or escaped later (text)
//  - numbers drive loop counts in the renderers, so they're clamped to the slider ranges
//    and counts are whole numbers; otherwise one link could freeze the page

const COLOR_KEYS = new Set(['ink', 'bg', 'color']);
const COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** String settings that must be one of a fixed list. */
const ENUMS: Record<string, { has(v: string): boolean }> = {
  script: new Set<string>(SCRIPTS),
  order: new Set(['earlier', 'later']),
  glyphs: new Set<string>(GLYPH_SETS),
  icon: EMBLEMS,
};
/** Settings the renderers use as loop counts or array steps. */
const INTEGER_KEYS = new Set(['count', 'step', 'branches']);
const MAX_TEXT = 500;
const MAX_LAYERS = 64;

interface Bounds {
  min: number;
  max: number;
}

function rangeBounds<T>(fields: readonly Field<T>[]): Map<string, Bounds> {
  const out = new Map<string, Bounds>();
  for (const f of fields) if (f.type === 'range') out.set(String(f.key), { min: f.min, max: f.max });
  return out;
}

const DESIGN_BOUNDS = rangeBounds(DESIGN_FIELDS);
const LAYER_BOUNDS = new Map<LayerType, Map<string, Bounds>>();
const layerBounds = (type: LayerType): Map<string, Bounds> => {
  let b = LAYER_BOUNDS.get(type);
  if (!b) {
    b = rangeBounds([...(TYPE_FIELDS[type] ?? []), ...COMMON_FIELDS]);
    LAYER_BOUNDS.set(type, b);
  }
  return b;
};

/** `v` if it's a valid value for `key`, else `fallback` (whose type defines what's valid). */
function cleanValue(key: string, fallback: unknown, v: unknown, bounds: Map<string, Bounds>): unknown {
  if (typeof fallback === 'number') {
    if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
    const b = bounds.get(key);
    let n = b ? Math.min(b.max, Math.max(b.min, v)) : v;
    if (INTEGER_KEYS.has(key)) n = Math.round(n);
    return n;
  }
  if (typeof fallback === 'boolean') return typeof v === 'boolean' ? v : fallback;
  if (typeof fallback === 'string') {
    if (typeof v !== 'string') return fallback;
    if (COLOR_KEYS.has(key)) return COLOR_RE.test(v) ? v : fallback;
    const allowed = ENUMS[key];
    if (allowed) return allowed.has(v) ? v : fallback;
    return v.slice(0, MAX_TEXT);
  }
  return fallback;
}

/** Copy of `template` where each key takes `src`'s value when that value is valid. */
function cleanObj<T extends object>(template: T, src: Record<string, unknown>, bounds: Map<string, Bounds>, skip: ReadonlyArray<keyof T> = []): T {
  const out = { ...template } as Record<string, unknown>;
  for (const k of Object.keys(template)) {
    if (!skip.includes(k as keyof T)) out[k] = cleanValue(k, out[k], src[k], bounds);
  }
  return out as T;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function cleanLayer(src: Record<string, unknown> & { type: LayerType }): Layer {
  const { type } = src;
  const layer = cleanObj(makeLayer(type), src, layerBounds(type), ['id', 'type']);
  // Settings this type doesn't use go back to defaults, so nothing hidden can
  // resurface (unclamped) if the layer is later switched to another type.
  const used = new Set((TYPE_FIELDS[type] ?? []).map((f) => String(f.key)));
  const defaults = typeDefaults(type);
  for (const k of Object.keys(defaults) as (keyof TypeParams)[]) {
    if (!used.has(k)) (layer as unknown as Record<string, unknown>)[k] = defaults[k];
  }
  return layer;
}

/** Turn untrusted input into a safe, valid Design. Unknown layer types are dropped; ids are regenerated. */
export function normalize(input: unknown): Design {
  const d = isRecord(input) ? input : {};
  const out = cleanObj(baseDesign(), d, DESIGN_BOUNDS, ['layers']);
  const rawLayers = Array.isArray(d.layers) ? d.layers : [];
  out.layers = rawLayers
    .filter((l): l is Record<string, unknown> & { type: LayerType } => isRecord(l) && isLayerType(l.type))
    .slice(0, MAX_LAYERS)
    .map(cleanLayer);
  return out;
}

/** Whether a parsed value looks like a design at all (an object with a layers list). */
export const isDesignLike = (v: unknown): boolean => isRecord(v) && Array.isArray(v.layers);
