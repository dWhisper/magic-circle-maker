import { describe, expect, it } from 'vitest';
import { normalize } from '../src/design';
import { COMMON_FIELDS, LAYER_TYPES, TYPE_FIELDS, makeLayer, typeDefaults } from '../src/layers';
import { PRESETS, randomDesign } from '../src/presets';
import { buildSvg } from '../src/render';
import { rng } from '../src/rng';
import { decodeDesign, designFromHash, encodeDesign } from '../src/share';
import type { Design, Layer, LayerType } from '../src/types';

const DEFAULT_INK = '#e9c46a';
const DEFAULT_BG = '#0e0b16';

/** base64url-encode raw bytes, the way share links are written. */
const b64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const toToken = (value: unknown): string => b64url(new TextEncoder().encode(JSON.stringify(value)));

/** A design without layer ids, which normalize() regenerates. */
const withoutIds = (d: Design) => ({ ...d, layers: d.layers.map(({ id: _id, ...rest }) => rest) });

function design(layers: Layer[], extra: Partial<Design> = {}): Design {
  return { seed: 'seed-1', ink: '#aabbcc', bg: '#010203', transparent: false, lineWeight: 1, spinSpeed: 1, tilt: 0, layers, ...extra };
}

/** Normalize a design that has a single layer and return that layer. */
const oneLayer = (layer: Record<string, unknown>): Layer => {
  const out = normalize({ layers: [layer] }).layers;
  expect(out).toHaveLength(1);
  return out[0]!;
};

describe('normalize: shape', () => {
  it.each([null, undefined, 42, 'design', true, [], [{ type: 'ring' }]])('turns %j into an empty but valid design', (input) => {
    const d = normalize(input);
    expect(d.layers).toEqual([]);
    expect(d).toMatchObject({ ink: DEFAULT_INK, bg: DEFAULT_BG, transparent: false, lineWeight: 1, spinSpeed: 1, tilt: 0 });
    expect(typeof d.seed).toBe('string');
  });

  it('keeps a valid design exactly, apart from fresh layer ids', () => {
    const d = design([
      makeLayer('star', { salt: 3, count: 7, step: 3, radius: 0.33, spin: -12, glow: 0.4, ownColor: true, color: '#ff8800' }),
      makeLayer('text', { salt: 4, text: 'Ünïcødé ✶ 魔法', script: 'runes', fontSize: 30 }),
    ], { transparent: true, lineWeight: 1.5, spinSpeed: 2.5, tilt: 40 });
    expect(withoutIds(normalize(d))).toEqual(withoutIds(d));
  });

  it('fills in anything missing from an older or partial design with defaults', () => {
    const d = normalize({ seed: 'old', layers: [{ type: 'dots', count: 9 }] });
    expect(d.seed).toBe('old');
    const layer = d.layers[0]!;
    expect(layer.count).toBe(9);
    expect(layer).toMatchObject({ visible: true, radius: 0.4, width: 2.5, size: 5, spin: 0 });
  });

  it('drops keys it does not know about', () => {
    const d = normalize({ evil: 1, layers: [{ type: 'ring', onload: 'alert(1)', style: 'x' }] });
    expect(d).not.toHaveProperty('evil');
    expect(Object.keys(d.layers[0]!).sort()).toEqual(Object.keys(makeLayer('ring')).sort());
  });

  it('never takes layer ids from the input, since they end up in SVG attributes', () => {
    const layer = oneLayer({ type: 'ring', id: '"><script>alert(1)</script>', glow: 0.5 });
    expect(layer.id).toMatch(/^L[a-z0-9]+$/);
  });

  it('does not modify its input', () => {
    const input = { ink: 'nope', layers: [{ type: 'dots', count: 9999 }] };
    const copy = structuredClone(input);
    normalize(input);
    expect(input).toEqual(copy);
  });

  it('gives the same result when run twice', () => {
    const once = normalize({ layers: [{ type: 'star', count: 99.7, step: -3, color: 'red' }], tilt: 500 });
    expect(withoutIds(normalize(once))).toEqual(withoutIds(once));
  });

  it('keeps at most 64 layers', () => {
    const d = normalize({ layers: Array.from({ length: 200 }, () => ({ type: 'ring' })) });
    expect(d.layers).toHaveLength(64);
  });
});

describe('normalize: layer types', () => {
  it.each(LAYER_TYPES)('keeps a %s layer', (type) => {
    expect(oneLayer({ type }).type).toBe(type);
  });

  it.each(['circle', 'RING', '', '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', 7, null, undefined, {}])(
    'drops a layer with type %j',
    (type) => expect(normalize({ layers: [{ type }, { type: 'ring' }] }).layers.map((l) => l.type)).toEqual(['ring']),
  );

  it.each([null, 5, 'ring', ['ring']])('drops a layer entry that is %j instead of an object', (entry) => {
    expect(normalize({ layers: [entry] }).layers).toEqual([]);
  });
});

describe('normalize: colours', () => {
  it.each(['#abc', '#abcd', '#aabbcc', '#AABBCC', '#aabbccdd'])('accepts %s', (c) => {
    expect(normalize({ ink: c, bg: c }).ink).toBe(c);
    expect(oneLayer({ type: 'ring', color: c }).color).toBe(c);
  });

  it.each([
    '"/><script>alert(1)</script>', 'red', 'rgb(0,0,0)', '#12', '#12345', '#1234567', '#gggggg',
    '#aabbcc;fill:url(javascript:alert(1))', ' #aabbcc', '#aabbcc ', 'url(#x)', '', 123, null, ['#aabbcc'],
  ])('rejects %j and uses the default', (c) => {
    const d = normalize({ ink: c, bg: c, layers: [{ type: 'ring', color: c }] });
    expect(d.ink).toBe(DEFAULT_INK);
    expect(d.bg).toBe(DEFAULT_BG);
    expect(d.layers[0]!.color).toBe('#ffffff');
  });
});

describe('normalize: value types', () => {
  it.each(['0.3', '', [], [0.3], {}, true, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'uses the default for a number setting given %j',
    (v) => {
      expect(oneLayer({ type: 'ring', radius: v }).radius).toBe(0.4);
      expect(normalize({ tilt: v }).tilt).toBe(0);
    },
  );

  it.each(['false', 'true', 0, 1, null, {}, []])('uses the default for an on/off setting given %j', (v) => {
    expect(oneLayer({ type: 'ring', visible: v }).visible).toBe(true);
    expect(normalize({ transparent: v }).transparent).toBe(false);
  });

  it.each([42, {}, ['text'], true])('uses the default for a text setting given %j', (v) => {
    expect(oneLayer({ type: 'text', text: v }).text).toBe(typeDefaults('text').text);
  });

  it('accepts only known choices for script and trigram order', () => {
    expect(oneLayer({ type: 'text', script: 'runes' }).script).toBe('runes');
    expect(oneLayer({ type: 'text', script: 'cyrillic' }).script).toBe('latin');
    expect(oneLayer({ type: 'trigrams', order: 'later' }).order).toBe('later');
    expect(oneLayer({ type: 'trigrams', order: 'middle' }).order).toBe('earlier');
  });

  it('caps long text', () => {
    expect(oneLayer({ type: 'text', text: 'x'.repeat(5000) }).text).toHaveLength(500);
    expect(normalize({ seed: 's'.repeat(5000) }).seed).toHaveLength(500);
  });
});

describe('normalize: limits', () => {
  // Numbers outside the slider ranges could make a renderer loop billions of
  // times and freeze the page, so they're clamped to what the sliders allow.
  const rangesFor = (type: LayerType) =>
    [...(TYPE_FIELDS[type] ?? []), ...COMMON_FIELDS].flatMap((f) => (f.type === 'range' ? [f] : []));

  it.each(LAYER_TYPES)('clamps every %s setting to its slider range', (type) => {
    for (const field of rangesFor(type)) {
      expect(oneLayer({ type, [field.key]: 1e12 })[field.key], `${field.key} high`).toBe(field.max);
      expect(oneLayer({ type, [field.key]: -1e12 })[field.key], `${field.key} low`).toBe(field.min);
    }
  });

  it('clamps design-wide settings', () => {
    expect(normalize({ lineWeight: 1e9, spinSpeed: 1e9, tilt: 1e9 })).toMatchObject({ lineWeight: 4, spinSpeed: 5, tilt: 75 });
    expect(normalize({ lineWeight: -1, spinSpeed: -1, tilt: -1 })).toMatchObject({ lineWeight: 0.25, spinSpeed: 0, tilt: 0 });
  });

  it('rounds counts to whole numbers, which the star and other loops rely on', () => {
    const star = oneLayer({ type: 'star', count: 7.4, step: 2.6 });
    expect(star.count).toBe(7);
    expect(star.step).toBe(3);
    expect(oneLayer({ type: 'arms', branches: 2.5 }).branches).toBe(3);
  });

  it('resets settings a layer type does not use to that type’s defaults', () => {
    // A dots layer has no use for turns or text; a huge value there must not survive
    // to become a real setting if the layer is later switched to another type.
    const dots = oneLayer({ type: 'dots', turns: 1e9, text: 'hidden', branches: 50 });
    expect(dots).toMatchObject({ turns: typeDefaults('dots').turns, text: typeDefaults('dots').text, branches: typeDefaults('dots').branches });
  });
});

describe('normalize: real designs pass through unchanged', () => {
  it.each(Object.keys(PRESETS))('%s preset', (name) => {
    const d = design(PRESETS[name]!().layers.map((l, i) => ({ ...l, salt: i })));
    expect(withoutIds(normalize(d))).toEqual(withoutIds(d));
  });

  it('randomized designs', () => {
    for (let i = 0; i < 200; i++) {
      const d = design(randomDesign(`random-${i}`).layers);
      expect(withoutIds(normalize(d)), `random-${i}`).toEqual(withoutIds(d));
    }
  });
});

describe('normalize: nothing hostile reaches the SVG', () => {
  // Throw junk at every field, sanitize it, render it, and check the markup stays inert.
  const NASTY = [
    '"/><script>alert(1)</script>', "'><img src=x onerror=alert(1)>", 'javascript:alert(1)',
    '</textPath></text><script>x</script>', '&lt;&#x3C;', '#aabbcc" onload="alert(1)', 1e308, -1e308,
    Number.NaN, null, true, [], {}, '__proto__', 'constructor', 0, -0, 0.5, 7.25, '1e9',
  ];
  const KEYS = [...Object.keys(makeLayer('text')), 'onload', '__proto__'];

  it('for 300 randomly junk-filled designs', () => {
    const r = rng('fuzz');
    for (let i = 0; i < 300; i++) {
      const layers = Array.from({ length: r.int(1, 6) }, () => {
        const layer: Record<string, unknown> = { type: r.chance(0.8) ? r.pick(LAYER_TYPES) : r.pick(NASTY) };
        for (const k of KEYS) if (r.chance(0.5)) layer[k] = r.pick(NASTY);
        return layer;
      });
      const input = { seed: r.pick(NASTY), ink: r.pick(NASTY), bg: r.pick(NASTY), tilt: r.pick(NASTY), layers };
      const svg = buildSvg(normalize(input), { t: 1.5 });
      // Incantation text is shown to the reader, so hostile strings may legitimately
      // appear there as escaped text. It must never contain a raw tag opener, though.
      const texts = [...svg.matchAll(/<textPath[^>]*>([^]*?)<\/textPath>/g)].map((m) => m[1] ?? '');
      for (const t of texts) expect(t, `case ${i}: text`).not.toContain('<');
      // Everything outside the text must be plain markup. Report the offending snippet, if any.
      const markup = svg.replace(/(<textPath[^>]*>)[^]*?(<\/textPath>)/g, '$1$2');
      const bad =
        markup.match(/.{0,60}(?:<script|<img|javascript:|\son\w+=).{0,60}/i)?.[0] ?? // tags, URLs, handlers: any case
        markup.match(/.{0,60}(?:NaN|Infinity).{0,60}/)?.[0]; // broken numbers: exact case ("dominant" contains "nan")
      expect(bad, `case ${i}: markup`).toBeUndefined();
    }
  });
});

describe('share links', () => {
  it('round-trip a design, including non-Latin text', () => {
    const d = design([makeLayer('text', { salt: 1, text: 'Ünïcødé ✶ 魔法 🜂', script: 'latin' })]);
    expect(withoutIds(decodeDesign(encodeDesign(d)))).toEqual(withoutIds(d));
  });

  it('only use URL-safe characters', () => {
    const d = design([makeLayer('text', { text: '???>>>~~~' + '\u{1F702}'.repeat(30) })]);
    expect(encodeDesign(d)).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('read a hash in the #d=... form', () => {
    const d = design([makeLayer('ring', { radius: 0.21 })]);
    expect(designFromHash('#d=' + encodeDesign(d))?.layers[0]?.radius).toBe(0.21);
  });

  it('still load links made by the original JavaScript version', () => {
    // A real link generated by the app before the TypeScript conversion.
    const legacy = 'eyJzZWVkIjoid3lyZC1lbWJlci04NyIsImluayI6IiNkOGYxZmYiLCJiZyI6IiMwYjE2MjYiLCJ0cmFuc3BhcmVudCI6ZmFsc2UsImxpbmVXZWlnaHQiOjEsInNwaW5TcGVlZCI6MSwidGlsdCI6MCwibGF5ZXJzIjpbeyJpZCI6Ikxtd214ejlnNjJyIiwic2FsdCI6MCwidHlwZSI6InJpbmciLCJ2aXNpYmxlIjp0cnVlLCJyYWRpdXMiOjAuNDY1Njg4MDM3MzI1MTYyNDUsIndpZHRoIjozLjIyMDg2NTA4ODA0OTMyMjQsImRvdWJsZSI6dHJ1ZSwiZGFzaGVkIjpmYWxzZSwicm90YXRpb24iOjAsInNwaW4iOjAsIm93bkNvbG9yIjpmYWxzZSwiY29sb3IiOiIjZmZmZmZmIiwiZ2xvdyI6MH0seyJpZCI6Ikxtd214ejlnNjJzIiwic2FsdCI6MSwidHlwZSI6InJ1bmVzIiwidmlzaWJsZSI6dHJ1ZSwicmFkaXVzIjowLjQ1MDY4ODAzNzMyNTE2MjQ0LCJ3aWR0aCI6Mi41LCJkb3VibGUiOmZhbHNlLCJkYXNoZWQiOmZhbHNlLCJyb3RhdGlvbiI6MCwic3BpbiI6Miwib3duQ29sb3IiOmZhbHNlLCJjb2xvciI6IiNmZmZmZmYiLCJnbG93IjowLCJjb3VudCI6MjIsImJhbmQiOjAuMDUyODM1MDMwMTc4NTM5NDZ9XX0';
    const d = designFromHash('#d=' + legacy);
    expect(d).not.toBeNull();
    expect(d!.seed).toBe('wyrd-ember-87');
    expect(d!.ink).toBe('#d8f1ff');
    expect(d!.layers.map((l) => l.type)).toEqual(['ring', 'runes']);
    expect(d!.layers[1]).toMatchObject({ count: 22, spin: 2, salt: 1 });
  });

  it.each([
    ['an empty hash', ''],
    ['a bare #', '#'],
    ['no token', '#d='],
    ['another hash', '#section-2'],
    ['a different key', '#x=' + toToken({ layers: [] })],
    ['characters outside base64url', '#d=abc$def'],
    ['extra text after the token', '#d=' + toToken({ layers: [] }) + '&x=1'],
    ['invalid base64', '#d=a'],
    ['base64 that is not JSON', '#d=' + b64url(new TextEncoder().encode('not json'))],
    ['bytes that are not UTF-8', '#d=' + b64url(new Uint8Array([0xff, 0xfe, 0x7b]))],
  ])('ignore %s', (_label, hash) => {
    expect(designFromHash(hash)).toBeNull();
  });

  // Loading a link replaces (and auto-saves over) the current design, so a link
  // that isn't actually a design must be ignored rather than load an empty one.
  it.each([1, 'text', null, true, [], [{ type: 'ring' }], {}, { seed: 'x' }, { layers: 'ring' }])(
    'ignore valid JSON that is not a design: %j',
    (value) => expect(designFromHash('#d=' + toToken(value))).toBeNull(),
  );

  it('accept a design with no layers', () => {
    expect(designFromHash('#d=' + toToken({ layers: [] }))?.layers).toEqual([]);
  });
});
