// Seeded randomness + procedural rune glyphs.
window.MC = window.MC || {};

(function (MC) {
  // String -> 32-bit hash (xmur3)
  function hash(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }

  // Deterministic PRNG (mulberry32) seeded from a string.
  function rng(seedStr) {
    let a = hash(String(seedStr));
    const next = function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.chance = (p) => next() < p;
    return next;
  }

  const f = (n) => Math.round(n * 100) / 100;

  // A rune is 2-4 strokes on a 3x5 grid, usually anchored by a stem.
  // Returns an SVG path "d" string centred on 0,0 with half-height s.
  function glyph(key, s) {
    const r = rng('glyph:' + key);
    const gx = [-0.6, 0, 0.6];
    const gy = [-1, -0.5, 0, 0.5, 1];
    const pt = () => [r.pick(gx), r.pick(gy)];
    const segs = [];
    const hasStem = r.chance(0.7);
    if (hasStem) {
      const sx = r.pick([0, 0, -0.6, 0.6]);
      segs.push([[sx, -1], [sx, 1]]);
    }
    const strokes = r.int(hasStem ? 1 : 2, hasStem ? 3 : 4);
    for (let i = 0; i < strokes; i++) {
      let a = pt(), b = pt();
      let guard = 0;
      while (a[0] === b[0] && a[1] === b[1] && guard++ < 10) b = pt();
      // Bias toward diagonal "branch" strokes that touch the stem.
      if (hasStem && r.chance(0.5)) a = [segs[0][0][0], r.pick(gy)];
      segs.push([a, b]);
    }
    let d = segs
      .map(([a, b]) => `M${f(a[0] * s)} ${f(a[1] * s)}L${f(b[0] * s)} ${f(b[1] * s)}`)
      .join('');
    // Occasional ornament: a small ring or a dot.
    if (r.chance(0.18)) {
      const [cx, cy] = [r.pick(gx), r.pick([-0.5, 0, 0.5])];
      const cr = s * 0.22;
      d += `M${f(cx * s + cr)} ${f(cy * s)}a${f(cr)} ${f(cr)} 0 1 0 ${f(-2 * cr)} 0a${f(cr)} ${f(cr)} 0 1 0 ${f(2 * cr)} 0`;
    }
    return d;
  }

  const WORDS = ['ember', 'veil', 'thorn', 'oath', 'moth', 'cinder', 'lumen', 'hollow', 'rune', 'wyrd',
    'sable', 'aster', 'gloam', 'ichor', 'nadir', 'zenith', 'myrrh', 'brine', 'quill', 'ward'];
  function randomSeed() {
    const r = rng(String(Math.random()));
    return `${r.pick(WORDS)}-${r.pick(WORDS)}-${r.int(10, 99)}`;
  }

  MC.hash = hash;
  MC.rng = rng;
  MC.glyph = glyph;
  MC.fmt = f;
  MC.randomSeed = randomSeed;
})(window.MC);
