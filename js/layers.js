// Layer types: defaults, editor fields, and SVG renderers.
// Coordinates: viewBox -500..500, so radius 0.5 touches the edge.
(function (MC) {
  const f = MC.fmt;
  const TAU = Math.PI * 2;
  const S = 1000; // radius units -> px

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const polar = (r, a) => [Math.sin(a) * r, -Math.cos(a) * r]; // a=0 at top, clockwise
  const circle = (r, extra = '') => `<circle r="${f(r)}" ${extra}/>`;

  const TYPES = {
    ring:     { label: 'Ring',            defaults: {} },
    polygon:  { label: 'Polygon',         defaults: { count: 6 } },
    star:     { label: 'Star polygon',    defaults: { count: 5, step: 2 } },
    runes:    { label: 'Rune ring',       defaults: { count: 24, band: 0.06 } },
    text:     { label: 'Text ring',       defaults: { text: 'BY EMBER AND OATH, BE BOUND', script: 'latin', fontSize: 24 } },
    dots:     { label: 'Dots',            defaults: { count: 12, size: 5 } },
    orbits:   { label: 'Orbit circles',   defaults: { count: 6, size: 0.05 } },
    spokes:   { label: 'Spokes',          defaults: { count: 12, inner: 0.6 } },
    trigrams: { label: 'Trigrams',        defaults: { order: 'earlier', size: 0.07 } },
    phases:   { label: 'Moon phases',     defaults: { count: 8, size: 0.035 } },
    arms:     { label: 'Snowflake arms',  defaults: { count: 6, branches: 3, shortArms: true } },
    spiral:   { label: 'Spiral',          defaults: { turns: 3, inner: 0.1 } },
    sigil:    { label: 'Sigil lines',     defaults: { count: 7 } },
    yinyang:  { label: 'Yin-yang',        defaults: {} },
  };

  const BASE = {
    visible: true, radius: 0.4, width: 2.5, double: false, dashed: false,
    rotation: 0, spin: 0, ownColor: false, color: '#ffffff', glow: 0,
  };

  // Editor field definitions.
  const COMMON_FIELDS = [
    { key: 'radius', label: 'Radius', type: 'range', min: 0.01, max: 0.5, step: 0.005 },
    { key: 'width', label: 'Line width', type: 'range', min: 0.25, max: 12, step: 0.25, unit: 'px' },
    { key: 'rotation', label: 'Rotation', type: 'range', min: -180, max: 180, step: 1, unit: '°' },
    { key: 'spin', label: 'Spin', type: 'range', min: -90, max: 90, step: 1, unit: '°/s' },
    { key: 'glow', label: 'Glow', type: 'range', min: 0, max: 1, step: 0.05 },
    { key: 'double', label: 'Double line', type: 'check' },
    { key: 'dashed', label: 'Dashed', type: 'check' },
    { key: 'ownColor', label: 'Own color', type: 'check' },
    { key: 'color', label: 'Color', type: 'color', showIf: (l) => l.ownColor },
  ];

  const TYPE_FIELDS = {
    polygon: [{ key: 'count', label: 'Sides', type: 'range', min: 3, max: 24, step: 1 }],
    star: [
      { key: 'count', label: 'Points', type: 'range', min: 5, max: 24, step: 1 },
      { key: 'step', label: 'Step', type: 'range', min: 2, max: 11, step: 1 },
    ],
    runes: [
      { key: 'count', label: 'Glyphs', type: 'range', min: 4, max: 72, step: 1 },
      { key: 'band', label: 'Band height', type: 'range', min: 0.02, max: 0.15, step: 0.005 },
    ],
    text: [
      { key: 'text', label: 'Incantation', type: 'textarea' },
      { key: 'script', label: 'Script', type: 'select', options: [['latin', 'Latin letters'], ['runes', 'Seeded rune alphabet']] },
      { key: 'fontSize', label: 'Size', type: 'range', min: 8, max: 64, step: 1 },
    ],
    dots: [
      { key: 'count', label: 'Count', type: 'range', min: 2, max: 120, step: 1 },
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
  };

  let counter = 0;
  function makeLayer(type, props = {}) {
    return {
      id: 'L' + Date.now().toString(36) + (counter++).toString(36),
      salt: Math.floor(Math.random() * 1e6),
      type,
      ...BASE,
      ...TYPES[type].defaults,
      ...props,
    };
  }

  // ---- Renderers: (layer, ctx) -> inner SVG markup ----
  // ctx: { seed, w (stroke width), bg }
  const R = {};

  R.ring = (l, c) => {
    const r = l.radius * S;
    let out = circle(r);
    if (l.double) out += circle(r - c.w * 3.2);
    return out;
  };

  function polyPoints(n, r, offset = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) pts.push(polar(r, (i / n) * TAU + offset));
    return pts;
  }
  const ptsAttr = (pts) => pts.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');

  R.polygon = (l, c) => {
    const r = l.radius * S;
    let out = `<polygon points="${ptsAttr(polyPoints(l.count, r))}"/>`;
    if (l.double) {
      const r2 = r - (c.w * 3.2) / Math.cos(Math.PI / l.count);
      out += `<polygon points="${ptsAttr(polyPoints(l.count, r2))}"/>`;
    }
    return out;
  };

  function gcd(a, b) { return b ? gcd(b, a % b) : a; }
  R.star = (l, c) => {
    const n = l.count;
    const k = Math.max(1, Math.min(l.step, Math.floor((n - 1) / 2)));
    const draw = (r) => {
      const pts = polyPoints(n, r);
      const cycles = gcd(n, k);
      let d = '';
      for (let s = 0; s < cycles; s++) {
        let i = s;
        d += `M${f(pts[i][0])} ${f(pts[i][1])}`;
        do { i = (i + k) % n; d += `L${f(pts[i][0])} ${f(pts[i][1])}`; } while (i !== s);
        d += 'Z';
      }
      return `<path d="${d}" stroke-linejoin="miter"/>`;
    };
    let out = draw(l.radius * S);
    if (l.double) out += draw(l.radius * S - c.w * 4);
    return out;
  };

  function glyphsAround(keys, rMid, s, sw) {
    const n = keys.length;
    let out = `<g stroke-width="${f(sw)}" stroke-linecap="round" stroke-linejoin="round">`;
    keys.forEach((key, i) => {
      const a = (i / n) * TAU;
      const [x, y] = polar(rMid, a);
      if (key === null) {
        out += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(sw, s * 0.12))}" fill="currentColor" stroke="none"/>`;
      } else {
        out += `<path transform="translate(${f(x)} ${f(y)}) rotate(${f((a * 180) / Math.PI)})" d="${MC.glyph(key, s)}"/>`;
      }
    });
    return out + '</g>';
  }

  R.runes = (l, c) => {
    const r = l.radius * S;
    const band = l.band * S;
    let out = circle(r) + circle(r - band);
    if (l.double) out += circle(r + c.w * 3.2) + circle(r - band - c.w * 3.2);
    const keys = [];
    for (let i = 0; i < l.count; i++) keys.push(`${c.seed}:${l.salt}:${i}`);
    const s = band * 0.3;
    out += glyphsAround(keys, r - band / 2, s, Math.max(0.5, c.w * 0.75));
    return out;
  };

  R.text = (l, c) => {
    const r = l.radius * S;
    const raw = (l.text || '').trim() || '·';
    if (l.script === 'runes') {
      // Each letter maps to a glyph from a per-seed alphabet, so the same word
      // always reads the same way in a given design: a usable constructed script.
      const keys = [...raw.toUpperCase()].map((ch) => (/\s/.test(ch) ? null : `alpha:${c.seed}:${ch}`));
      keys.push(null);
      const s = l.fontSize * 0.5;
      return glyphsAround(keys, r, s, Math.max(1.2, c.w * 0.85)) + (l.double ? circle(r + s * 1.8) + circle(r - s * 1.8) : '');
    }
    const circ = TAU * r;
    const unit = raw + ' ✦ ';
    const approx = unit.length * l.fontSize * 0.62;
    const reps = Math.max(1, Math.floor(circ / approx));
    const str = unit.repeat(reps);
    const id = 'tp-' + l.id;
    let out = `<path id="${id}" fill="none" stroke="none" d="M0 ${f(-r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(r)}A${f(r)} ${f(r)} 0 1 1 0 ${f(-r)}"/>`;
    out += `<text font-family="Georgia, 'Times New Roman', serif" font-size="${l.fontSize}" letter-spacing="1" fill="currentColor" stroke="none" dominant-baseline="middle">` +
      `<textPath href="#${id}" xlink:href="#${id}" textLength="${f(circ * 0.995)}" lengthAdjust="spacing">${esc(str)}</textPath></text>`;
    if (l.double) out += circle(r + l.fontSize * 0.75) + circle(r - l.fontSize * 0.75);
    return out;
  };

  R.dots = (l) => {
    const r = l.radius * S;
    return polyPoints(l.count, r)
      .map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(l.size)}" fill="currentColor" stroke="none"/>`)
      .join('');
  };

  R.orbits = (l, c) => {
    const r = l.radius * S, s = l.size * S;
    return polyPoints(l.count, r)
      .map(([x, y]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(s)}"/>` +
        (l.double ? `<circle cx="${f(x)}" cy="${f(y)}" r="${f(Math.max(1, s - c.w * 3))}"/>` : ''))
      .join('');
  };

  R.spokes = (l) => {
    const r = l.radius * S, ri = r * l.inner;
    let d = '';
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * TAU;
      const [x1, y1] = polar(ri, a), [x2, y2] = polar(r, a);
      d += `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
    }
    return `<path d="${d}"/>`;
  };

  // Lines listed bottom (inner) to top (outer); 1 = solid, 0 = broken.
  const TRI = {
    qian: [1, 1, 1], dui: [1, 1, 0], li: [1, 0, 1], zhen: [1, 0, 0],
    xun: [0, 1, 1], kan: [0, 1, 0], gen: [0, 0, 1], kun: [0, 0, 0],
  };
  const ORDERS = {
    earlier: ['qian', 'xun', 'kan', 'gen', 'kun', 'zhen', 'li', 'dui'],
    later: ['li', 'kun', 'dui', 'qian', 'kan', 'gen', 'zhen', 'xun'],
  };
  R.trigrams = (l) => {
    const r = l.radius * S, s = l.size * S;
    const gap = s * 0.42, half = s * 0.7, brk = s * 0.13, sw = s * 0.17;
    let out = '';
    ORDERS[l.order || 'earlier'].forEach((name, i) => {
      let d = '';
      TRI[name].forEach((solid, j) => {
        const y = -(r - (2 - j) * gap);
        d += solid ? `M${f(-half)} ${f(y)}H${f(half)}` : `M${f(-half)} ${f(y)}H${f(-brk)}M${f(brk)} ${f(y)}H${f(half)}`;
      });
      out += `<path transform="rotate(${i * 45})" d="${d}" stroke-width="${f(sw)}" stroke-linecap="butt"/>`;
    });
    return out;
  };

  R.phases = (l) => {
    const r = l.radius * S, s = l.size * S;
    let out = '';
    for (let i = 0; i < l.count; i++) {
      const a = (i / l.count) * TAU;
      const [x, y] = polar(r, a);
      const p = i / l.count; // 0 = new, 0.5 = full
      const k = Math.cos(p * TAU);
      const waning = p > 0.5;
      let lit = '';
      if (Math.abs(p - 0.5) < 1e-6) lit = `<circle r="${f(s)}" fill="currentColor" stroke="none"/>`;
      else if (p > 0) {
        const sweep = k > 0 ? 0 : 1;
        lit = `<path ${waning ? 'transform="scale(-1 1)"' : ''} fill="currentColor" stroke="none" d="M0 ${f(-s)}A${f(s)} ${f(s)} 0 0 1 0 ${f(s)}A${f(Math.abs(k) * s)} ${f(s)} 0 0 ${sweep} 0 ${f(-s)}Z"/>`;
      }
      out += `<g transform="translate(${f(x)} ${f(y)}) rotate(${f((a * 180) / Math.PI)})"><circle r="${f(s)}"/>${lit}</g>`;
    }
    return out;
  };

  R.arms = (l) => {
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
  };

  R.spiral = (l) => {
    const r = l.radius * S, ri = r * l.inner;
    const steps = Math.ceil(80 * l.turns);
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const [x, y] = polar(ri + (r - ri) * t, l.turns * TAU * t);
      d += (i ? 'L' : 'M') + f(x) + ' ' + f(y);
    }
    return `<path d="${d}" stroke-linecap="round"/>`;
  };

  R.sigil = (l, c) => {
    const r = l.radius * S;
    const rnd = MC.rng(`sigil:${c.seed}:${l.salt}`);
    const pts = [];
    for (let i = 0; i < l.count; i++) {
      const a = rnd() * TAU, d = Math.sqrt(rnd()) * r * 0.92;
      pts.push(polar(d, a));
    }
    let d = pts.map((p, i) => (i ? 'L' : 'M') + f(p[0]) + ' ' + f(p[1])).join('');
    let out = `<path d="${d}" stroke-linejoin="round" stroke-linecap="round"/>`;
    const [sx, sy] = pts[0], [ex, ey] = pts[pts.length - 1];
    const nr = Math.max(4, c.w * 2.4);
    out += `<circle cx="${f(sx)}" cy="${f(sy)}" r="${f(nr)}"/>`; // start mark
    out += `<path d="M${f(ex - nr)} ${f(ey)}H${f(ex + nr)}" stroke-linecap="round"/>`; // end bar
    return out;
  };

  R.yinyang = (l, c) => {
    const r = l.radius * S, h = r / 2, dot = r / 7;
    return circle(r) +
      `<path fill="currentColor" stroke="none" d="M0 ${f(-r)}A${f(h)} ${f(h)} 0 0 1 0 0A${f(h)} ${f(h)} 0 0 0 0 ${f(r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(-r)}Z"/>` +
      `<circle cy="${f(-h)}" r="${f(dot)}" fill="${c.bg}" stroke="none"/>` +
      `<circle cy="${f(h)}" r="${f(dot)}" fill="currentColor" stroke="none"/>`;
  };

  MC.TYPES = TYPES;
  MC.COMMON_FIELDS = COMMON_FIELDS;
  MC.TYPE_FIELDS = TYPE_FIELDS;
  MC.makeLayer = makeLayer;
  MC.renderers = R;
})(window.MC);
