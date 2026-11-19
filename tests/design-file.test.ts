import { describe, expect, it } from 'vitest';
import { FILE_APP, FILE_VERSION, MAX_FILE_BYTES, designFromFile, designToFile } from '../src/design-file';
import { makeLayer } from '../src/layers';
import { PRESETS } from '../src/presets';
import { rng } from '../src/rng';
import type { Design, Layer } from '../src/types';

function design(layers: Layer[], extra: Partial<Design> = {}): Design {
  return { seed: 'seed-1', ink: '#aabbcc', bg: '#010203', transparent: false, lineWeight: 1, spinSpeed: 1, tilt: 0, layers, ...extra };
}

/** A design without layer ids, which importing regenerates. */
const withoutIds = (d: Design) => ({ ...d, layers: d.layers.map(({ id: _id, ...rest }) => rest) });

/** Import and expect success. */
function load(text: string): Design {
  const result = designFromFile(text);
  if (!result.ok) throw new Error(`Expected the file to load, got: ${result.error}`);
  return result.design;
}

/** Import and expect failure; returns the message shown to the user. */
function reject(text: string): string {
  const result = designFromFile(text);
  if (result.ok) throw new Error('Expected the file to be rejected, but it loaded');
  return result.error;
}

const SIMPLE = { seed: 's', layers: [{ type: 'ring' }, { type: 'star', count: 7 }] };
const wrapped = (d: unknown, extra: Record<string, unknown> = {}): string =>
  JSON.stringify({ app: FILE_APP, version: FILE_VERSION, design: d, ...extra });

describe('saving', () => {
  it('writes the app name, format version and design', () => {
    const d = design([makeLayer('ring')]);
    const file = JSON.parse(designToFile(d));
    expect(Object.keys(file)).toEqual(['app', 'version', 'design']);
    expect(file).toMatchObject({ app: 'magic-circle-maker', version: 1 });
    expect(file.design).toEqual(d);
  });

  it('is readable: indented, ending with a newline', () => {
    const text = designToFile(design([]));
    expect(text).toContain('\n  "app": "magic-circle-maker"');
    expect(text.endsWith('}\n')).toBe(true);
  });

  // Saved files live on people's disks for years, so the format must not drift by accident.
  // If you change it on purpose, bump FILE_VERSION and keep older files loading.
  it('keeps a stable format', () => {
    const d = design([{ ...makeLayer('text', { salt: 2, text: 'OATH', script: 'runes' }), id: 'L-fixed' }]);
    expect(designToFile(d)).toMatchSnapshot();
  });
});

describe('round trips', () => {
  it.each(Object.keys(PRESETS))('%s survives saving and opening', (name) => {
    const d = design(PRESETS[name]!().layers.map((l, i) => ({ ...l, salt: i })), { seed: `seed-${name}` });
    expect(withoutIds(load(designToFile(d)))).toEqual(withoutIds(d));
  });

  it('keeps every design-wide setting and non-Latin text', () => {
    const d = design([makeLayer('text', { salt: 1, text: 'Ünïcødé ✶ 魔法 🜂', fontSize: 40 })], {
      transparent: true, lineWeight: 2.5, spinSpeed: 0.3, tilt: 55, ink: '#123', bg: '#abcdef80',
    });
    expect(withoutIds(load(designToFile(d)))).toEqual(withoutIds(d));
  });

  it('gives every layer a fresh id', () => {
    const d = design([makeLayer('ring'), makeLayer('star')]);
    const ids = load(designToFile(d)).layers.map((l) => l.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(d.layers.map((l) => l.id)).not.toContain(id);
  });
});

describe('files that open', () => {
  it('a file saved by the original JavaScript version', () => {
    // Same structure the JS version's "Save .json" wrote, with its 2-space indent.
    const legacy = `{
  "app": "magic-circle-maker",
  "version": 1,
  "design": {
    "seed": "ichor-lumen-84",
    "ink": "#ff5a36",
    "bg": "#140606",
    "transparent": false,
    "lineWeight": 1,
    "spinSpeed": 1,
    "tilt": 0,
    "layers": [
      { "id": "Lmwmxz9g62r", "salt": 0, "type": "ring", "visible": true, "radius": 0.48, "width": 3,
        "double": true, "dashed": false, "rotation": 0, "spin": 0, "ownColor": false, "color": "#ffffff", "glow": 0 },
      { "id": "Lmwmxz9g62s", "salt": 1, "type": "runes", "visible": true, "radius": 0.455, "width": 2.5,
        "double": false, "dashed": false, "rotation": 0, "spin": 4, "ownColor": false, "color": "#ffffff", "glow": 0,
        "count": 30, "band": 0.065 }
    ]
  }
}`;
    const d = load(legacy);
    expect(d).toMatchObject({ seed: 'ichor-lumen-84', ink: '#ff5a36', bg: '#140606' });
    expect(d.layers.map((l) => l.type)).toEqual(['ring', 'runes']);
    expect(d.layers[1]).toMatchObject({ count: 30, band: 0.065, spin: 4, salt: 1 });
  });

  it('a bare design, as used by share links and browser storage', () => {
    expect(load(JSON.stringify(SIMPLE)).layers).toHaveLength(2);
  });

  it('a wrapped design without a version or app name', () => {
    expect(load(JSON.stringify({ app: FILE_APP, design: SIMPLE })).layers).toHaveLength(2);
    expect(load(JSON.stringify({ design: SIMPLE })).layers).toHaveLength(2);
  });

  it('a design with no layers', () => {
    expect(load(wrapped({ layers: [] })).layers).toEqual([]);
  });

  it('a file from a newer version, keeping whatever this version understands', () => {
    const d = load(wrapped({ ...SIMPLE, newSetting: 'x', layers: [{ type: 'ring', futureOption: 3 }, { type: 'hologram' }] }, { version: 99 }));
    expect(d.layers.map((l) => l.type)).toEqual(['ring']);
  });

  it('a file starting with a byte-order mark (as some Windows editors save)', () => {
    expect(load('\uFEFF' + wrapped(SIMPLE)).layers).toHaveLength(2);
  });

  it('a file with extra whitespace or Windows line endings', () => {
    expect(load('\r\n\t  ' + designToFile(design([makeLayer('ring')])).replace(/\n/g, '\r\n') + '\r\n\r\n').layers).toHaveLength(1);
  });

  it('a file exactly at the size limit', () => {
    const base = wrapped(SIMPLE);
    const text = base + ' '.repeat(MAX_FILE_BYTES - base.length);
    expect(text.length).toBe(MAX_FILE_BYTES);
    expect(load(text).layers).toHaveLength(2);
  });
});

describe('files that are refused, leaving the current design alone', () => {
  const NOT_JSON = 'That file isn’t a design file (it isn’t valid JSON).';
  const NO_DESIGN = 'That file doesn’t contain a magic circle design.';

  it.each([
    ['an empty file', ''],
    ['plain text', 'Chapter 3: the warding circle'],
    ['truncated JSON', wrapped(SIMPLE).slice(0, -10)],
    ['an image', '\x89PNG\r\n\x1a\n\0\0\0\rIHDR'],
    ['an SVG export', '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>'],
  ])('%s, as not JSON', (_label, text) => {
    expect(reject(text)).toBe(NOT_JSON);
  });

  it.each([
    ['null', 'null'],
    ['a number', '42'],
    ['a string', '"magic"'],
    ['a list', '[]'],
    ['a list holding a design', JSON.stringify([SIMPLE])],
    ['an empty object', '{}'],
    ['a package.json', JSON.stringify({ name: 'some-project', version: '1.0.0', dependencies: {} })],
    ['a settings object without layers', JSON.stringify({ seed: 'x', ink: '#ffffff' })],
    ['layers that are not a list', JSON.stringify({ layers: 'ring' })],
    ['a wrapper without a design', JSON.stringify({ app: FILE_APP, version: 1 })],
    ['a wrapper whose design is empty', wrapped(null)],
    ['a wrapper whose design is not a design', wrapped({ seed: 'x' })],
    ['a wrapper holding a list', wrapped([SIMPLE])],
  ])('%s, as not containing a design', (_label, text) => {
    expect(reject(text)).toBe(NO_DESIGN);
  });

  it('a file from another app, even if it has a design inside', () => {
    expect(reject(JSON.stringify({ app: 'another-app', version: 1, design: SIMPLE }))).toBe('That file is from a different app.');
    expect(reject(JSON.stringify({ app: null, design: SIMPLE }))).toBe('That file is from a different app.');
  });

  it('a file over the size limit, without parsing it', () => {
    const base = wrapped(SIMPLE);
    expect(reject(base + ' '.repeat(MAX_FILE_BYTES - base.length + 1))).toBe('That file is too large to be a design file.');
  });
});

describe('untrusted contents', () => {
  it('are sanitized the same way as share links', () => {
    const d = load(wrapped({
      ink: '"/><script>alert(1)</script>',
      layers: [
        { type: 'dots', count: 1e9, id: '"><script>', onload: 'alert(1)' },
        { type: 'star', count: 5.3 },
        { type: '__proto__' },
      ],
    }));
    expect(d.ink).toBe('#e9c46a');
    expect(d.layers.map((l) => l.type)).toEqual(['dots', 'star']);
    expect(d.layers[0]!.count).toBe(120);
    expect(d.layers[0]!.id).toMatch(/^L[a-z0-9]+$/);
    expect(d.layers[0]).not.toHaveProperty('onload');
    expect(d.layers[1]!.count).toBe(5);
  });

  it('never make the importer throw', () => {
    const r = rng('file-fuzz');
    const pieces = ['{', '}', '[', ']', '"app"', '"design"', '"layers"', ':', ',', 'null', '1e999', '"magic-circle-maker"', '{"type":"ring"}', '"\\u0000"', '\uFEFF', ' '];
    for (let i = 0; i < 2000; i++) {
      const text = Array.from({ length: r.int(0, 12) }, () => r.pick(pieces)).join('');
      expect(() => designFromFile(text), JSON.stringify(text)).not.toThrow();
    }
  });
});
