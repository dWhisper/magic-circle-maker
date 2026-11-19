// Creating designs and sanitizing ones that arrive from share links, files or storage.
import { isLayerType, makeLayer } from './layers';
import { randomSeed } from './rng';
import type { Design, Layer } from './types';

export function baseDesign(): Design {
  return {
    seed: randomSeed(), ink: '#e9c46a', bg: '#0e0b16', transparent: false,
    lineWeight: 1, spinSpeed: 1, tilt: 0, layers: [],
  };
}

// Designs can arrive from share links / files, and their values end up in
// SVG markup, so copy only known keys with the expected type and format.
const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
const ENUMS: Record<string, readonly string[]> = { script: ['latin', 'runes'], order: ['earlier', 'later'] };
const MAX_LAYERS = 64;

function cleanValue(key: string, fallback: unknown, v: unknown): unknown {
  if (v === undefined || v === null) return fallback;
  if (typeof fallback === 'number') {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof fallback === 'boolean') return !!v;
  if (typeof fallback === 'string') {
    if (COLOR_RE.test(fallback)) return typeof v === 'string' && COLOR_RE.test(v) ? v : fallback;
    const allowed = ENUMS[key];
    if (allowed) return typeof v === 'string' && allowed.includes(v) ? v : fallback;
    return String(v).slice(0, 500);
  }
  return fallback;
}

/** Copy of `template` where each key takes `src`'s value if it has the right type. */
function cleanObj<T extends object>(template: T, src: Record<string, unknown>, skip: ReadonlyArray<keyof T> = []): T {
  const out = { ...template } as Record<string, unknown>;
  for (const k of Object.keys(template)) {
    if (!skip.includes(k as keyof T)) out[k] = cleanValue(k, out[k], src[k]);
  }
  return out as T;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Turn untrusted input into a valid Design. Unknown layer types are dropped; ids are regenerated. */
export function normalize(input: unknown): Design {
  const d = isRecord(input) ? input : {};
  const out = cleanObj(baseDesign(), d, ['layers']);
  const rawLayers = Array.isArray(d.layers) ? d.layers : [];
  out.layers = rawLayers
    .filter((l): l is Record<string, unknown> & { type: Layer['type'] } => isRecord(l) && isLayerType(l.type))
    .slice(0, MAX_LAYERS)
    .map((l) => cleanObj(makeLayer(l.type), l, ['id', 'type']));
  return out;
}
