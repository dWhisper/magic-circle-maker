import { describe, expect, it } from 'vitest';
import { makeLayer } from '../src/layers';
import { loopLength, symmetry } from '../src/loop';
import { PRESETS } from '../src/presets';
import type { Design, Layer, LayerType } from '../src/types';

function design(layers: Layer[], spinSpeed = 1): Design {
  return { seed: 's', ink: '#ffffff', bg: '#000000', transparent: false, lineWeight: 1, spinSpeed, tilt: 0, layers };
}
const layer = (type: LayerType, props: Partial<Layer> = {}): Layer => makeLayer(type, props);

/** How far (degrees) a layer is from looking exactly as it did at t=0 after `seconds`. */
function loopError(l: Layer, d: Design, seconds: number): number {
  const sym = symmetry(l);
  const r = Math.abs(l.spin * d.spinSpeed * seconds) % sym;
  return Math.min(r, sym - r);
}

/** Every layer that visibly spins must land back on an identical-looking angle. */
function expectSeamless(d: Design, seconds: number): void {
  for (const l of d.layers) {
    if (!l.visible || !l.spin || symmetry(l) === 0) continue;
    expect(loopError(l, d, seconds), `${l.type} spinning ${l.spin}°/s over ${seconds}s`).toBeLessThan(0.05);
  }
}

describe('symmetry', () => {
  it('treats a plain ring as looking the same at any angle', () => {
    expect(symmetry(layer('ring'))).toBe(0);
    expect(symmetry(layer('ring', { dashed: true }))).toBe(360);
  });

  it.each([
    ['polygon', 6, 60], ['star', 5, 72], ['dots', 12, 30],
    ['spokes', 24, 15], ['orbits', 4, 90], ['arms', 8, 45],
  ] as const)('repeats a %s with count %i every %i°', (type, count, deg) => {
    expect(symmetry(layer(type, { count }))).toBe(deg);
  });

  it.each(['runes', 'text', 'trigrams', 'phases', 'spiral', 'sigil', 'yinyang'] as const)(
    'needs a full turn for %s, which has no repeating pattern',
    (type) => expect(symmetry(layer(type))).toBe(360),
  );
});

describe('loopLength: nothing visibly spinning', () => {
  it.each([
    ['no layers', design([])],
    ['no spin', design([layer('star')])],
    ['a spinning plain ring', design([layer('ring', { spin: 20 })])],
    ['a hidden spinning layer', design([layer('star', { spin: 20, visible: false })])],
    ['global spin speed of 0', design([layer('star', { spin: 20 })], 0)],
  ])('reports a still design for %s', (_label, d) => {
    expect(loopLength(d, 'auto').still).toBe(true);
    expect(loopLength(d, 'fit:12').still).toBe(true);
  });

  it('does count a spinning dashed ring', () => {
    expect(loopLength(design([layer('ring', { spin: 20, dashed: true })]), 'auto').still).toBeFalsy();
  });
});

describe('loopLength: auto (exact speeds)', () => {
  it('finds the time a star takes to turn one point', () => {
    // A 5-point star repeats every 72°; at 12°/s that's 6 s.
    const d = design([layer('star', { count: 5, spin: 12 })]);
    const info = loopLength(d, 'auto');
    expect(info).toMatchObject({ seconds: 6, seamless: true });
    expect(info.adjusted).toBeFalsy();
    expect(info.design).toBe(d);
  });

  it('uses the shortest time that works for every layer', () => {
    // 10°/s and 15°/s full turns: 36 s and 24 s, so they first line up at 72 s.
    const d = design([layer('runes', { spin: 10 }), layer('runes', { spin: -15 })]);
    expect(loopLength(d, 'auto').seconds).toBe(72);
  });

  it('accounts for the global spin speed', () => {
    expect(loopLength(design([layer('star', { count: 5, spin: 12 })], 2), 'auto').seconds).toBe(3);
  });

  it('accepts a loop that floating-point rounding lands a hair short of', () => {
    // 3°/s × 0.6 = 1.7999999999999998°/s, so after 50 s a square has turned
    // 89.99999999999999°: one full step (90°) in reality, just under it in floats.
    const d = design([layer('polygon', { count: 4, spin: 3 })], 0.6);
    expect(loopLength(d, 'auto').seconds).toBe(50);
  });

  it('treats spinning backwards the same as forwards', () => {
    const fwd = loopLength(design([layer('dots', { count: 12, spin: 30 })]), 'auto');
    const back = loopLength(design([layer('dots', { count: 12, spin: -30 })]), 'auto');
    expect(fwd.seconds).toBe(1);
    expect(back.seconds).toBe(1);
  });

  it('ignores layers whose spin is invisible', () => {
    const d = design([layer('star', { count: 5, spin: 12 }), layer('ring', { spin: 7 }), layer('runes', { spin: 1, visible: false })]);
    expect(loopLength(d, 'auto').seconds).toBe(6);
  });

  it('falls back to a 12 s loop with rounded speeds when no exact loop exists within 3 minutes', () => {
    // A rune ring at 1°/s takes 360 s to come round.
    const info = loopLength(design([layer('runes', { spin: 1 })]), 'auto');
    expect(info).toMatchObject({ seconds: 12, seamless: true, adjusted: true });
    expectSeamless(info.design, info.seconds);
  });
});

describe('loopLength: fit:N (rounded speeds)', () => {
  it('loops in exactly N seconds', () => {
    const d = design([layer('star', { count: 7, spin: 9 }), layer('runes', { spin: -23 })]);
    for (const n of [6, 12]) {
      const info = loopLength(d, `fit:${n}`);
      expect(info).toMatchObject({ seconds: n, seamless: true, adjusted: true });
      expectSeamless(info.design, n);
    }
  });

  it('keeps each spin close to the original and in the same direction', () => {
    const d = design([layer('runes', { spin: -23 })]);
    const fitted = loopLength(d, 'fit:12').design.layers[0]!;
    expect(fitted.spin).toBe(-30); // nearest whole turn in 12 s
  });

  it('speeds a very slow layer up to at least one step, rather than stopping it', () => {
    const fitted = loopLength(design([layer('runes', { spin: 4 })]), 'fit:12').design.layers[0]!;
    expect(fitted.spin).toBe(30);
  });

  it('respects the global spin speed when rounding', () => {
    const d = design([layer('star', { count: 5, spin: 7 })], 2);
    const info = loopLength(d, 'fit:6');
    expectSeamless(info.design, 6);
    expect(info.design.spinSpeed).toBe(2);
  });

  it('leaves non-spinning layers and the original design untouched', () => {
    const still = layer('polygon', { count: 6 });
    const spinning = layer('star', { count: 5, spin: 7 });
    const d = design([still, spinning]);
    const info = loopLength(d, 'fit:6');
    expect(info.design).not.toBe(d);
    expect(info.design.layers[0]).toEqual(still);
    expect(d.layers[1]!.spin).toBe(7);
  });
});

describe('loopLength: fixed length', () => {
  it('uses the given length with true speeds, without promising a seamless loop', () => {
    const d = design([layer('runes', { spin: 7 })]);
    const info = loopLength(d, '5');
    expect(info).toMatchObject({ seconds: 5, seamless: false });
    expect(info.design).toBe(d);
  });
});

describe('every preset', () => {
  // Presets are what most people export, so check each one loops cleanly with every seamless option.
  const cases = Object.keys(PRESETS).flatMap((name) => ['auto', 'fit:6', 'fit:12'].map((choice) => [name, choice] as const));

  it.each(cases)('%s loops seamlessly with %s', (name, choice) => {
    const d = design(PRESETS[name]!().layers);
    const info = loopLength(d, choice);
    expect(info.still).toBeFalsy();
    expect(info.seconds).toBeGreaterThan(0);
    expect(info.seconds).toBeLessThanOrEqual(180);
    expectSeamless(info.design, info.seconds);
  });
});
