// Loop-length math for animated export: how long until every spinning layer
// looks exactly as it did at the start, so a GIF or video loops without a jump.
import type { Design, Layer } from './types';

/**
 * Rotational symmetry (degrees) of a layer: after turning this far it looks identical.
 * 0 means it looks the same at any angle, so its spin is invisible.
 */
export function symmetry(l: Layer): number {
  const n = Math.max(1, Math.round(l.count || 1));
  switch (l.type) {
    case 'ring':
      return l.dashed ? 360 : 0;
    case 'polygon': case 'star': case 'dots': case 'spokes': case 'orbits': case 'arms':
      return 360 / n;
    default:
      return 360;
  }
}

interface Spin {
  l: Layer;
  speed: number; // |degrees per second|
  sym: number;
}

function spinningLayers(design: Design): Spin[] {
  return design.layers
    .filter((l) => l.visible && l.spin && design.spinSpeed)
    .map((l) => ({ l, speed: Math.abs(l.spin * design.spinSpeed), sym: symmetry(l) }))
    .filter((s) => s.sym > 0);
}

/**
 * Copy of the design with each spin nudged so it completes a whole number of
 * symmetry steps in exactly T seconds (at least one), making the loop seamless.
 */
function fitDesign(design: Design, T: number, spins: Spin[]): Design {
  const fitted = new Map<string, number>();
  for (const { l, speed, sym } of spins) {
    const k = Math.max(1, Math.round((speed * T) / sym));
    fitted.set(l.id, (Math.sign(l.spin) * k * sym) / (T * design.spinSpeed));
  }
  return { ...design, layers: design.layers.map((l) => ({ ...l, spin: fitted.get(l.id) ?? l.spin })) };
}

export interface LoopInfo {
  seconds: number;
  seamless: boolean;
  /** The design to render: the original, or a copy with spins rounded to fit. */
  design: Design;
  adjusted?: boolean;
  /** Nothing visibly spins. */
  still?: boolean;
}

const MAX_EXACT = 180;

/**
 * Loop length for a `#loop-len` choice:
 *  - `auto`: shortest exact loop (up to 3 min) with true speeds; falls back to `fit:12`
 *  - `fit:N`: a loop of N seconds with speeds rounded to match
 *  - `N`: fixed N seconds with true speeds; may jump at the loop point
 */
export function loopLength(design: Design, choice: string): LoopInfo {
  const spins = spinningLayers(design);
  if (!spins.length) return { seconds: 3, seamless: true, still: true, design };
  if (choice.startsWith('fit:')) {
    const T = parseFloat(choice.slice(4));
    return { seconds: T, seamless: true, adjusted: true, design: fitDesign(design, T, spins) };
  }
  if (choice !== 'auto') return { seconds: parseFloat(choice), seamless: false, design };
  for (let i = 20; i <= MAX_EXACT * 20; i++) {
    const T = i / 20;
    const ok = spins.every(({ speed, sym }) => {
      const r = (speed * T) % sym;
      return Math.min(r, sym - r) < 0.05;
    });
    if (ok) return { seconds: T, seamless: true, design };
  }
  return { seconds: 12, seamless: true, adjusted: true, design: fitDesign(design, 12, spins) };
}
