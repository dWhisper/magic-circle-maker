// UI wiring, rendering, animation, persistence, export.
(function (MC) {
  const $ = (sel) => document.querySelector(sel);
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'mcm.current.v1';
  const LIB_KEY = 'mcm.library.v1';

  const state = {
    design: null,
    selectedId: null,
    playing: true,
    t: 0, // seconds of accumulated spin time
  };

  // ---------- Design helpers ----------
  function baseDesign() {
    return { seed: MC.randomSeed(), ink: '#e9c46a', bg: '#0e0b16', transparent: false, lineWeight: 1, spinSpeed: 1, tilt: 0, layers: [] };
  }

  function applyPreset(result, keepSeed) {
    const d = state.design || baseDesign();
    const theme = MC.THEMES[result.theme];
    d.layers = result.layers.map((l, i) => ({ ...l, salt: i }));
    if (theme) { d.ink = theme.ink; d.bg = theme.bg; }
    if (!keepSeed) d.seed = MC.randomSeed();
    state.design = d;
    state.selectedId = d.layers[0] && d.layers[0].id;
    state.t = 0;
    refreshAll();
  }

  const selected = () => state.design.layers.find((l) => l.id === state.selectedId);

  // ---------- Rendering ----------
  function buildSvg(design, { forExport = false, ink, bg, transparent, t } = {}) {
    if (t === undefined) t = state.t;
    ink = ink || design.ink;
    bg = bg || design.bg;
    if (transparent === undefined) transparent = design.transparent;
    const tiltScale = Math.cos((design.tilt * Math.PI) / 180);
    let defs = '';
    let body = '';
    design.layers.forEach((l) => {
      if (!l.visible) return;
      const color = l.ownColor ? l.color : ink;
      const w = l.width * design.lineWeight;
      const ctx = { seed: design.seed, w, bg };
      let inner = '';
      try { inner = MC.renderers[l.type](l, ctx); } catch (e) { console.error(e); }
      let filter = '';
      if (l.glow > 0) {
        const fid = 'glow-' + l.id;
        const sd = MC.fmt(2 + l.glow * 14);
        defs += `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${sd}" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
        filter = ` filter="url(#${fid})"`;
      }
      const dash = l.dashed ? ` stroke-dasharray="${MC.fmt(w * 5)} ${MC.fmt(w * 3.5)}"` : '';
      const rot = MC.fmt(l.rotation + l.spin * design.spinSpeed * t);
      body += `<g data-layer="${l.id}" transform="rotate(${rot})" style="color:${color}" fill="none" stroke="currentColor" stroke-width="${MC.fmt(w)}"${dash}${filter}>${inner}</g>`;
    });
    const bgRect = transparent ? '' : `<rect x="-500" y="-500" width="1000" height="1000" fill="${bg}"/>`;
    return `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-500 -500 1000 1000"${forExport ? ' width="1000" height="1000"' : ''}>` +
      `<defs>${defs}</defs>${bgRect}<g id="world" transform="scale(1 ${MC.fmt(tiltScale)})">${body}</g></svg>`;
  }

  function render() {
    const d = state.design;
    const host = $('#stage');
    host.innerHTML = buildSvg(d, { transparent: false });
    host.style.setProperty('--stage-bg', d.bg);
    drawSelection();
    persist();
  }

  function drawSelection() {
    const svg = $('#stage svg');
    const l = selected();
    const old = svg.querySelector('.ui-sel');
    if (old) old.remove();
    if (!l || !l.visible) return;
    const g = document.createElementNS(SVGNS, 'circle');
    g.setAttribute('class', 'ui-sel');
    g.setAttribute('r', Math.max(4, l.radius * 1000));
    g.setAttribute('fill', 'none');
    svg.querySelector('#world').appendChild(g);
  }

  function updateRotations() {
    const d = state.design;
    d.layers.forEach((l) => {
      if (!l.spin) return;
      const el = document.querySelector(`#stage [data-layer="${l.id}"]`);
      if (el) el.setAttribute('transform', `rotate(${MC.fmt(l.rotation + l.spin * d.spinSpeed * state.t)})`);
    });
  }

  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (state.playing) { state.t += dt; updateRotations(); }
    requestAnimationFrame(tick);
  }

  // ---------- Layer list ----------
  function renderLayerList() {
    const list = $('#layer-list');
    list.innerHTML = '';
    state.design.layers.forEach((l, i) => {
      const li = document.createElement('li');
      li.className = 'layer-item' + (l.id === state.selectedId ? ' selected' : '') + (l.visible ? '' : ' hidden-layer');
      li.innerHTML = `
        <button class="vis" title="Toggle visibility" aria-label="Toggle visibility">${l.visible ? '◉' : '○'}</button>
        <span class="lname">${i + 1}. ${MC.TYPES[l.type].label}</span>
        <span class="lmeta">${l.radius.toFixed(2)}</span>`;
      li.addEventListener('click', (e) => {
        if (e.target.closest('.vis')) { l.visible = !l.visible; refreshAll(); return; }
        state.selectedId = l.id;
        renderLayerList(); renderEditor(); drawSelection();
      });
      list.appendChild(li);
    });
  }

  function layerAction(action) {
    const layers = state.design.layers;
    const i = layers.findIndex((l) => l.id === state.selectedId);
    if (action === 'add') {
      const type = $('#add-type').value;
      const ref = layers[i];
      const nl = MC.makeLayer(type, { radius: ref ? Math.max(0.05, ref.radius - 0.05) : 0.4 });
      layers.splice(i < 0 ? layers.length : i + 1, 0, nl);
      state.selectedId = nl.id;
    } else if (i < 0) {
      return;
    } else if (action === 'dup') {
      const copy = { ...layers[i], id: MC.makeLayer('ring').id, salt: Math.floor(Math.random() * 1e6) };
      layers.splice(i + 1, 0, copy);
      state.selectedId = copy.id;
    } else if (action === 'del') {
      layers.splice(i, 1);
      state.selectedId = (layers[i] || layers[i - 1] || {}).id || null;
    } else if (action === 'up' && i > 0) {
      [layers[i - 1], layers[i]] = [layers[i], layers[i - 1]];
    } else if (action === 'down' && i < layers.length - 1) {
      [layers[i + 1], layers[i]] = [layers[i], layers[i + 1]];
    } else if (action === 'reroll') {
      layers[i].salt = Math.floor(Math.random() * 1e6);
    }
    refreshAll();
  }

  // ---------- Field builder (shared by layer + design editors) ----------
  function fieldRow(field, obj, onChange) {
    const row = document.createElement('label');
    row.className = 'field field-' + field.type;
    const id = 'f-' + field.key + '-' + Math.random().toString(36).slice(2, 7);
    const val = obj[field.key];
    if (field.type === 'range') {
      const decimals = (String(field.step).split('.')[1] || '').length;
      const show = (v) => Number(v).toFixed(decimals) + (field.unit || '');
      row.innerHTML = `<span class="flabel">${field.label}<output>${show(val)}</output></span>
        <input id="${id}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${val}">`;
      const input = row.querySelector('input');
      const out = row.querySelector('output');
      input.addEventListener('input', () => { obj[field.key] = parseFloat(input.value); out.textContent = show(input.value); onChange(field); });
    } else if (field.type === 'check') {
      row.innerHTML = `<input id="${id}" type="checkbox" ${val ? 'checked' : ''}><span class="flabel">${field.label}</span>`;
      const input = row.querySelector('input');
      input.addEventListener('change', () => { obj[field.key] = input.checked; onChange(field); });
    } else if (field.type === 'color') {
      row.innerHTML = `<span class="flabel">${field.label}</span><input id="${id}" type="color" value="${val}">`;
      const input = row.querySelector('input');
      input.addEventListener('input', () => { obj[field.key] = input.value; onChange(field); });
    } else if (field.type === 'select') {
      row.innerHTML = `<span class="flabel">${field.label}</span><select id="${id}">${field.options
        .map(([v, t]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
      const input = row.querySelector('select');
      input.addEventListener('change', () => { obj[field.key] = input.value; onChange(field); });
    } else if (field.type === 'textarea' || field.type === 'text') {
      const tag = field.type === 'textarea' ? 'textarea' : 'input';
      row.innerHTML = `<span class="flabel">${field.label}</span><${tag} id="${id}" ${tag === 'input' ? 'type="text"' : 'rows="2"'}></${tag}>`;
      const input = row.querySelector(tag);
      input.value = val;
      input.addEventListener('input', () => { obj[field.key] = input.value; onChange(field); });
    }
    return row;
  }

  function renderEditor() {
    const host = $('#layer-editor');
    host.innerHTML = '';
    const l = selected();
    if (!l) { host.innerHTML = '<p class="muted">No layer selected. Add one above.</p>'; return; }

    const typeField = { key: 'type', label: 'Type', type: 'select', options: Object.entries(MC.TYPES).map(([k, v]) => [k, v.label]) };
    host.appendChild(fieldRow(typeField, l, () => {
      Object.assign(l, { ...MC.TYPES[l.type].defaults, ...pickExisting(l, MC.TYPES[l.type].defaults) });
      refreshAll();
    }));

    const fields = [...(MC.TYPE_FIELDS[l.type] || []), ...MC.COMMON_FIELDS];
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    fields.forEach((fd) => {
      if (fd.showIf && !fd.showIf(l)) return;
      grid.appendChild(fieldRow(fd, l, (field) => {
        render(); renderLayerListMeta();
        if (field.key === 'ownColor') renderEditor();
      }));
    });
    host.appendChild(grid);

    if (l.type === 'runes' || l.type === 'sigil') {
      const b = document.createElement('button');
      b.className = 'btn small';
      b.textContent = '↻ Reroll this layer’s ' + (l.type === 'runes' ? 'glyphs' : 'sigil');
      b.addEventListener('click', () => layerAction('reroll'));
      host.appendChild(b);
    }
  }

  // Keep shared params (e.g. count) when switching types if already set.
  function pickExisting(l, defaults) {
    const out = {};
    Object.keys(defaults).forEach((k) => { if (l[k] !== undefined) out[k] = l[k]; });
    return out;
  }

  function renderLayerListMeta() {
    const items = document.querySelectorAll('#layer-list .lmeta');
    state.design.layers.forEach((l, i) => { if (items[i]) items[i].textContent = l.radius.toFixed(2); });
  }

  // ---------- Design panel ----------
  const DESIGN_FIELDS = [
    { key: 'ink', label: 'Ink', type: 'color' },
    { key: 'bg', label: 'Background', type: 'color' },
    { key: 'lineWeight', label: 'Line weight', type: 'range', min: 0.25, max: 4, step: 0.05, unit: '×' },
    { key: 'spinSpeed', label: 'Spin speed', type: 'range', min: 0, max: 5, step: 0.1, unit: '×' },
    { key: 'tilt', label: 'Ground tilt', type: 'range', min: 0, max: 75, step: 1, unit: '°' },
  ];

  function renderDesignPanel() {
    const d = state.design;
    $('#seed').value = d.seed;
    const host = $('#design-fields');
    host.innerHTML = '';
    DESIGN_FIELDS.forEach((fd) => host.appendChild(fieldRow(fd, d, () => render())));
  }

  function setupStatic() {
    // Presets
    const pre = $('#presets');
    Object.keys(MC.PRESETS).forEach((name) => {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = name;
      b.addEventListener('click', () => applyPreset(MC.PRESETS[name](), true));
      pre.appendChild(b);
    });
    // Themes
    const th = $('#themes');
    Object.entries(MC.THEMES).forEach(([name, t]) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.title = name;
      b.setAttribute('aria-label', name);
      b.style.background = `radial-gradient(circle at 50% 50%, ${t.ink} 0 28%, ${t.bg} 30%)`;
      b.addEventListener('click', () => { state.design.ink = t.ink; state.design.bg = t.bg; renderDesignPanel(); render(); });
      th.appendChild(b);
    });
    // Add-layer type select
    $('#add-type').innerHTML = Object.entries(MC.TYPES).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

    // Toolbar
    $('#btn-random').addEventListener('click', () => {
      const seed = MC.randomSeed();
      state.design.seed = seed;
      applyPreset(MC.randomDesign(seed), true);
    });
    $('#btn-play').addEventListener('click', () => {
      state.playing = !state.playing;
      $('#btn-play').textContent = state.playing ? '❚❚ Pause' : '▶ Spin';
    });
    $('#btn-reset-spin').addEventListener('click', () => { state.t = 0; render(); });
    $('#btn-share').addEventListener('click', shareLink);

    document.querySelectorAll('[data-layer-action]').forEach((b) =>
      b.addEventListener('click', () => layerAction(b.dataset.layerAction)));

    // Seed
    $('#seed').addEventListener('change', (e) => { state.design.seed = e.target.value.trim() || MC.randomSeed(); render(); });
    $('#btn-reseed').addEventListener('click', () => { state.design.seed = MC.randomSeed(); $('#seed').value = state.design.seed; render(); });

    // Export
    $('#btn-svg').addEventListener('click', exportSvg);
    $('#btn-png').addEventListener('click', () => exportPng(false));
    $('#btn-stencil').addEventListener('click', () => exportPng(true));
    $('#btn-json').addEventListener('click', exportJson);
    $('#file-json').addEventListener('change', importJson);
    $('#transparent').addEventListener('change', (e) => { state.design.transparent = e.target.checked; persist(); });

    // Library
    $('#btn-lib-save').addEventListener('click', saveToLibrary);

    setupStageInteraction();
  }

  // ---------- Stage interaction: click ring to select, drag to rotate, shift-drag to resize ----------
  function setupStageInteraction() {
    const host = $('#stage');
    let drag = null;
    const toLocal = (e) => {
      const svg = host.querySelector('svg');
      const rect = svg.getBoundingClientRect();
      const s = 1000 / rect.width;
      const x = (e.clientX - rect.left) * s - 500;
      const tilt = Math.cos((state.design.tilt * Math.PI) / 180);
      const y = ((e.clientY - rect.top) * s - 500) / tilt;
      return { x, y, r: Math.hypot(x, y), a: (Math.atan2(x, -y) * 180) / Math.PI };
    };
    host.addEventListener('pointerdown', (e) => {
      const p = toLocal(e);
      let best = null, bestD = 40;
      state.design.layers.forEach((l) => {
        if (!l.visible) return;
        const dd = Math.abs(l.radius * 1000 - p.r);
        if (dd < bestD) { bestD = dd; best = l; }
      });
      if (!best) return;
      state.selectedId = best.id;
      renderLayerList(); renderEditor(); drawSelection();
      drag = { l: best, startA: p.a, startRot: best.rotation, startR: best.radius, startDist: p.r };
      host.setPointerCapture(e.pointerId);
    });
    host.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const p = toLocal(e);
      if (e.shiftKey) {
        drag.l.radius = Math.min(0.5, Math.max(0.01, drag.startR + (p.r - drag.startDist) / 1000));
      } else {
        let rot = drag.startRot + (p.a - drag.startA);
        rot = ((rot + 540) % 360) - 180;
        drag.l.rotation = Math.round(rot);
      }
      render();
    });
    const end = () => { if (drag) { drag = null; renderEditor(); renderLayerListMeta(); } };
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);
  }

  // ---------- Export ----------
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }
  const fileBase = () => 'magic-circle-' + state.design.seed.replace(/[^a-z0-9-]+/gi, '-').toLowerCase();

  function exportSvg() {
    const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + buildSvg(state.design, { forExport: true });
    download(new Blob([svg], { type: 'image/svg+xml' }), fileBase() + '.svg');
  }

  function exportPng(stencil) {
    const size = parseInt($('#png-size').value, 10);
    const opts = stencil
      ? { forExport: true, ink: '#000000', bg: '#ffffff', transparent: false }
      : { forExport: true };
    let svg = buildSvg(state.design, opts);
    if (stencil) {
      // Force every layer to black: strip own colors and glows.
      svg = svg.replace(/style="color:[^"]*"/g, 'style="color:#000000"').replace(/ filter="url\([^)]*\)"/g, '');
    }
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, size, size);
      URL.revokeObjectURL(url);
      c.toBlob((b) => download(b, fileBase() + (stencil ? '-stencil' : '') + '.png'), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast('PNG export failed'); };
    img.src = url;
  }

  function exportJson() {
    const data = JSON.stringify({ app: 'magic-circle-maker', version: 1, design: state.design }, null, 2);
    download(new Blob([data], { type: 'application/json' }), fileBase() + '.json');
  }

  function importJson(e) {
    const file = e.target.files[0];
    if (!file) return;
    file.text().then((txt) => {
      try {
        const parsed = JSON.parse(txt);
        loadDesign(parsed.design || parsed);
        toast('Design loaded');
      } catch (err) { toast('Could not read that file'); }
      e.target.value = '';
    });
  }

  // ---------- Persistence / share ----------
  // Designs can arrive from share links / files, and their values end up in
  // SVG markup, so copy only known keys with the expected type and format.
  const COLOR_RE = /^#[0-9a-f]{3,8}$/i;
  const ENUMS = { script: ['latin', 'runes'], order: ['earlier', 'later'] };
  function cleanValue(key, fallback, v) {
    if (v === undefined || v === null) return fallback;
    if (typeof fallback === 'number') { const n = Number(v); return Number.isFinite(n) ? n : fallback; }
    if (typeof fallback === 'boolean') return !!v;
    if (typeof fallback === 'string') {
      if (COLOR_RE.test(fallback)) return COLOR_RE.test(v) ? v : fallback;
      if (ENUMS[key]) return ENUMS[key].includes(v) ? v : fallback;
      return String(v).slice(0, 500);
    }
    return fallback;
  }
  function cleanObj(template, src, skip = []) {
    const out = { ...template };
    Object.keys(template).forEach((k) => { if (!skip.includes(k)) out[k] = cleanValue(k, template[k], src[k]); });
    return out;
  }
  function normalize(d) {
    d = d && typeof d === 'object' ? d : {};
    const out = cleanObj(baseDesign(), d, ['layers']);
    out.layers = (Array.isArray(d.layers) ? d.layers : [])
      .filter((l) => l && Object.prototype.hasOwnProperty.call(MC.TYPES, l.type))
      .slice(0, 64)
      .map((l) => cleanObj(MC.makeLayer(l.type), l, ['id', 'type']));
    return out;
  }

  function loadDesign(d) {
    state.design = normalize(d);
    state.selectedId = state.design.layers[0] && state.design.layers[0].id;
    state.t = 0;
    refreshAll();
  }

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state.design)); } catch (e) { /* storage unavailable */ }
  }

  function b64urlEncode(str) {
    return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    return decodeURIComponent(escape(atob(s)));
  }

  function shareLink() {
    const url = location.href.split('#')[0] + '#d=' + b64urlEncode(JSON.stringify(state.design));
    history.replaceState(null, '', url);
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => toast('Link copied to clipboard'), () => toast('Link is in the address bar'));
    else toast('Link is in the address bar');
  }

  // ---------- Library (named circles with notes, for your manuscript) ----------
  function readLib() {
    try { return JSON.parse(localStorage.getItem(LIB_KEY)) || []; } catch (e) { return []; }
  }
  function writeLib(lib) {
    try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); return true; } catch (e) { toast('Could not save (storage full or blocked)'); return false; }
  }

  function saveToLibrary() {
    const name = $('#lib-name').value.trim() || 'Untitled circle';
    const notes = $('#lib-notes').value.trim();
    const lib = readLib();
    const existing = lib.findIndex((e) => e.name === name);
    const entry = { name, notes, savedAt: new Date().toISOString(), design: JSON.parse(JSON.stringify(state.design)) };
    if (existing >= 0) lib[existing] = entry; else lib.unshift(entry);
    if (writeLib(lib)) { toast(existing >= 0 ? `Updated “${name}”` : `Saved “${name}”`); renderLibrary(); }
  }

  function renderLibrary() {
    const host = $('#library');
    const lib = readLib();
    if (!lib.length) { host.innerHTML = '<p class="muted">No saved circles yet. Name one above to keep it with notes.</p>'; return; }
    host.innerHTML = '';
    lib.forEach((entry, i) => {
      const card = document.createElement('div');
      card.className = 'lib-card';
      const thumb = document.createElement('div');
      thumb.className = 'lib-thumb';
      thumb.innerHTML = buildSvg(normalize(entry.design), { transparent: false });
      const info = document.createElement('div');
      info.className = 'lib-info';
      const title = document.createElement('strong');
      title.textContent = entry.name;
      const notes = document.createElement('p');
      notes.textContent = entry.notes || '';
      const actions = document.createElement('div');
      actions.className = 'lib-actions';
      const load = document.createElement('button');
      load.className = 'btn small'; load.textContent = 'Load';
      load.addEventListener('click', () => {
        loadDesign(entry.design);
        $('#lib-name').value = entry.name;
        $('#lib-notes').value = entry.notes || '';
      });
      const del = document.createElement('button');
      del.className = 'btn small ghost'; del.textContent = 'Delete';
      del.addEventListener('click', () => {
        if (del.dataset.armed) { lib.splice(i, 1); writeLib(lib); renderLibrary(); }
        else { del.dataset.armed = '1'; del.textContent = 'Confirm?'; setTimeout(() => { delete del.dataset.armed; del.textContent = 'Delete'; }, 2500); }
      });
      actions.append(load, del);
      info.append(title, notes, actions);
      card.append(thumb, info);
      host.appendChild(card);
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function refreshAll() {
    renderDesignPanel();
    renderLayerList();
    renderEditor();
    render();
    $('#transparent').checked = !!state.design.transparent;
  }

  // ---------- Boot ----------
  function boot() {
    setupStatic();
    let loaded = false;
    const m = location.hash.match(/#d=([\w-]+)/);
    if (m) {
      try { loadDesign(JSON.parse(b64urlDecode(m[1]))); loaded = true; } catch (e) { console.warn('Bad share link', e); }
    }
    if (!loaded) {
      try {
        const saved = JSON.parse(localStorage.getItem(STORE_KEY));
        if (saved && saved.layers) { loadDesign(saved); loaded = true; }
      } catch (e) { /* ignore */ }
    }
    if (!loaded) { state.design = baseDesign(); applyPreset(MC.PRESETS['Summoning circle'](), true); }
    renderLibrary();
    requestAnimationFrame(tick);
  }

  // Shared with js/anim-export.js
  MC.app = { state, buildSvg, download, fileBase, toast };

  document.addEventListener('DOMContentLoaded', boot);
})(window.MC);
