// UI wiring, preview rendering, animation, persistence, image export, spellbook.
import { DESIGN_FIELDS, baseDesign, normalize } from './design';
import { COMMON_FIELDS, LAYER_TYPES, TYPES, TYPE_FIELDS, makeLayer, newLayerId, randomSalt, typeDefaults } from './layers';
import { PRESETS, THEMES, randomDesign } from './presets';
import { SVGNS, buildSvg } from './render';
import { fmt, randomSeed } from './rng';
import { state } from './state';
import type { Design, DesignTemplate, Field, Layer, LayerType } from './types';
import { designFromHash, encodeDesign } from './share';
import { $, download, fileBase, toast } from './ui';

const STORE_KEY = 'mcm.current.v1';
const LIB_KEY = 'mcm.library.v1';

// ---------- Design helpers ----------
function applyTemplate(result: DesignTemplate): void {
  const d = state.design ?? baseDesign();
  const theme = THEMES[result.theme];
  // Salt by position so a preset + seed always produces the same runes.
  d.layers = result.layers.map((l, i) => ({ ...l, salt: i }));
  if (theme) {
    d.ink = theme.ink;
    d.bg = theme.bg;
  }
  state.design = d;
  state.selectedId = d.layers[0]?.id ?? null;
  state.t = 0;
  refreshAll();
}

const selected = (): Layer | undefined => state.design.layers.find((l) => l.id === state.selectedId);

// ---------- Preview ----------
function render(): void {
  const host = $('#stage');
  host.innerHTML = buildSvg(state.design, { t: state.t, transparent: false });
  host.style.setProperty('--stage-bg', state.design.bg);
  drawSelection();
  persist();
}

function drawSelection(): void {
  const svg = $<SVGSVGElement>('#stage svg');
  svg.querySelector('.ui-sel')?.remove();
  const l = selected();
  if (!l || !l.visible) return;
  const ring = document.createElementNS(SVGNS, 'circle');
  ring.setAttribute('class', 'ui-sel');
  ring.setAttribute('r', String(Math.max(4, l.radius * 1000)));
  ring.setAttribute('fill', 'none');
  $('#world', svg).appendChild(ring);
}

function updateRotations(): void {
  const d = state.design;
  for (const l of d.layers) {
    if (!l.spin) continue;
    const el = document.querySelector(`#stage [data-layer="${l.id}"]`);
    el?.setAttribute('transform', `rotate(${fmt(l.rotation + l.spin * d.spinSpeed * state.t)})`);
  }
}

let last = performance.now();
function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (state.playing) {
    state.t += dt;
    updateRotations();
  }
  requestAnimationFrame(tick);
}

// ---------- Layer list ----------
function renderLayerList(): void {
  const list = $('#layer-list');
  list.innerHTML = '';
  state.design.layers.forEach((l, i) => {
    const li = document.createElement('li');
    li.className = 'layer-item' + (l.id === state.selectedId ? ' selected' : '') + (l.visible ? '' : ' hidden-layer');
    li.innerHTML = `
      <span class="grip" title="Drag to reorder" aria-hidden="true">⠿</span>
      <button class="vis" title="Toggle visibility" aria-label="Toggle visibility">${l.visible ? '◉' : '○'}</button>
      <span class="lname">${i + 1}. ${TYPES[l.type].label}</span>
      <span class="lmeta">${l.radius.toFixed(2)}</span>`;
    li.addEventListener('click', (e) => {
      if (layerDrag.suppressClick) return;
      if ((e.target as Element).closest('.vis')) {
        l.visible = !l.visible;
        refreshAll();
        return;
      }
      state.selectedId = l.id;
      renderLayerList();
      renderEditor();
      drawSelection();
    });
    li.addEventListener('pointerdown', (e) => startLayerDrag(e, li, i));
    list.appendChild(li);
  });
}

function renderLayerListMeta(): void {
  const items = document.querySelectorAll('#layer-list .lmeta');
  state.design.layers.forEach((l, i) => {
    const item = items[i];
    if (item) item.textContent = l.radius.toFixed(2);
  });
}

type LayerAction = 'add' | 'dup' | 'del' | 'up' | 'down' | 'reroll';

function layerAction(action: LayerAction): void {
  const layers = state.design.layers;
  const i = layers.findIndex((l) => l.id === state.selectedId);
  const current = layers[i];
  if (action === 'add') {
    const type = $<HTMLSelectElement>('#add-type').value as LayerType;
    const nl = makeLayer(type, { radius: current ? Math.max(0.05, current.radius - 0.05) : 0.4 });
    layers.splice(i < 0 ? layers.length : i + 1, 0, nl);
    state.selectedId = nl.id;
  } else if (!current) {
    return;
  } else if (action === 'dup') {
    const copy: Layer = { ...current, id: newLayerId(), salt: randomSalt() };
    layers.splice(i + 1, 0, copy);
    state.selectedId = copy.id;
  } else if (action === 'del') {
    layers.splice(i, 1);
    state.selectedId = (layers[i] ?? layers[i - 1])?.id ?? null;
  } else if (action === 'up' && i > 0) {
    moveLayer(i, i - 1);
  } else if (action === 'down' && i < layers.length - 1) {
    moveLayer(i, i + 1);
  } else if (action === 'reroll') {
    current.salt = randomSalt();
  }
  refreshAll();
}

function moveLayer(from: number, to: number): void {
  const layers = state.design.layers;
  const [moved] = layers.splice(from, 1);
  if (moved) layers.splice(to, 0, moved);
}

// ---------- Drag-and-drop reordering ----------
// Mouse/pen: drag anywhere on a row. Touch: drag the grip, so the panel can still scroll.
interface ActiveDrag {
  li: HTMLLIElement;
  from: number;
  to: number;
  startY: number;
  moved: boolean;
  pointerId: number;
}
const layerDrag: { active: ActiveDrag | null; suppressClick: boolean } = { active: null, suppressClick: false };

function startLayerDrag(e: PointerEvent, li: HTMLLIElement, from: number): void {
  const target = e.target as Element;
  if (e.button !== 0 || target.closest('.vis')) return;
  if (e.pointerType === 'touch' && !target.closest('.grip')) return;
  layerDrag.active = { li, from, to: from, startY: e.clientY, moved: false, pointerId: e.pointerId };
  li.setPointerCapture(e.pointerId);
  li.addEventListener('pointermove', moveLayerDrag);
  li.addEventListener('pointerup', endLayerDrag);
  li.addEventListener('pointercancel', endLayerDrag);
}

function moveLayerDrag(e: PointerEvent): void {
  const d = layerDrag.active;
  if (!d || e.pointerId !== d.pointerId) return;
  const dy = e.clientY - d.startY;
  if (!d.moved) {
    if (Math.abs(dy) < 5) return; // small jitter is still a click
    d.moved = true;
    d.li.classList.add('dragging');
    $('#layer-list').classList.add('is-dragging');
  }
  e.preventDefault();
  d.li.style.transform = `translateY(${dy}px)`;

  // Keep the dragged row visible when the panel scrolls.
  const panel = d.li.closest('.panel');
  if (panel) {
    const pr = panel.getBoundingClientRect();
    if (e.clientY < pr.top + 40) panel.scrollTop -= 10;
    else if (e.clientY > pr.bottom - 40) panel.scrollTop += 10;
  }

  // New index (with the dragged row removed) = how many other rows sit above the pointer.
  const others = [...document.querySelectorAll<HTMLElement>('#layer-list .layer-item')].filter((it) => it !== d.li);
  d.to = others.filter((it) => {
    const r = it.getBoundingClientRect();
    return e.clientY > r.top + r.height / 2;
  }).length;
  // Show a line above the row the drop will land before, or below the last row.
  const changed = d.to !== d.from;
  others.forEach((it, idx) => {
    it.classList.toggle('drop-above', changed && idx === d.to);
    it.classList.toggle('drop-below', changed && d.to === others.length && idx === others.length - 1);
  });
}

function endLayerDrag(e: PointerEvent): void {
  const d = layerDrag.active;
  if (!d || e.pointerId !== d.pointerId) return;
  layerDrag.active = null;
  d.li.removeEventListener('pointermove', moveLayerDrag);
  d.li.removeEventListener('pointerup', endLayerDrag);
  d.li.removeEventListener('pointercancel', endLayerDrag);
  $('#layer-list').classList.remove('is-dragging');
  if (!d.moved) return;
  // The click that follows this pointerup shouldn't count as a selection click.
  layerDrag.suppressClick = true;
  setTimeout(() => {
    layerDrag.suppressClick = false;
  }, 0);
  const moved = state.design.layers[d.from];
  if (e.type !== 'pointercancel') moveLayer(d.from, d.to);
  state.selectedId = moved?.id ?? state.selectedId;
  refreshAll();
}

// ---------- Field builder (shared by layer + design editors) ----------
/** Assign a field value. Field keys are typed to match their value kind, so this is safe. */
function setProp<T>(obj: T, key: keyof T, value: unknown): void {
  (obj as Record<keyof T, unknown>)[key] = value;
}

function fieldRow<T>(field: Field<T>, obj: T, onChange: (field: Field<T>) => void): HTMLLabelElement {
  const row = document.createElement('label');
  row.className = 'field field-' + field.type;
  const id = `f-${String(field.key)}-${Math.random().toString(36).slice(2, 7)}`;

  if (field.type === 'range') {
    const val = obj[field.key] as number;
    const decimals = (String(field.step).split('.')[1] ?? '').length;
    const show = (v: number | string): string => Number(v).toFixed(decimals) + (field.unit ?? '');
    row.innerHTML = `<span class="flabel">${field.label}<output>${show(val)}</output></span>
      <input id="${id}" type="range" min="${field.min}" max="${field.max}" step="${field.step}" value="${val}">`;
    const input = $<HTMLInputElement>('input', row);
    const out = $<HTMLOutputElement>('output', row);
    input.addEventListener('input', () => {
      setProp(obj, field.key, parseFloat(input.value));
      out.textContent = show(input.value);
      onChange(field);
    });
  } else if (field.type === 'check') {
    row.innerHTML = `<input id="${id}" type="checkbox" ${obj[field.key] ? 'checked' : ''}><span class="flabel">${field.label}</span>`;
    const input = $<HTMLInputElement>('input', row);
    input.addEventListener('change', () => {
      setProp(obj, field.key, input.checked);
      onChange(field);
    });
  } else if (field.type === 'color') {
    row.innerHTML = `<span class="flabel">${field.label}</span><input id="${id}" type="color">`;
    const input = $<HTMLInputElement>('input', row);
    input.value = obj[field.key] as string;
    input.addEventListener('input', () => {
      setProp(obj, field.key, input.value);
      onChange(field);
    });
  } else if (field.type === 'select') {
    const val = obj[field.key] as string;
    row.innerHTML = `<span class="flabel">${field.label}</span><select id="${id}">${field.options
      .map(([v, t]) => `<option value="${v}" ${v === val ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    const input = $<HTMLSelectElement>('select', row);
    input.addEventListener('change', () => {
      setProp(obj, field.key, input.value);
      onChange(field);
    });
  } else {
    const multiline = field.type === 'textarea';
    row.innerHTML = `<span class="flabel">${field.label}</span>` +
      (multiline ? `<textarea id="${id}" rows="2"></textarea>` : `<input id="${id}" type="text">`);
    const input = $<HTMLInputElement | HTMLTextAreaElement>(multiline ? 'textarea' : 'input', row);
    input.value = obj[field.key] as string;
    input.addEventListener('input', () => {
      setProp(obj, field.key, input.value);
      onChange(field);
    });
  }
  return row;
}

/** Switch a layer's type: reset type-specific settings, keeping the count when both types use one. */
function changeLayerType(l: Layer, type: LayerType): void {
  const keepCount = 'count' in TYPES[l.type].defaults && 'count' in TYPES[type].defaults;
  const count = l.count;
  Object.assign(l, typeDefaults(type), { type });
  if (keepCount) l.count = count;
}

function renderEditor(): void {
  const host = $('#layer-editor');
  host.innerHTML = '';
  const l = selected();
  if (!l) {
    host.innerHTML = '<p class="muted">No layer selected. Add one above.</p>';
    return;
  }

  const typeHolder = { type: l.type as string };
  const typeField: Field<typeof typeHolder> = {
    key: 'type', label: 'Type', type: 'select',
    options: LAYER_TYPES.map((k) => [k, TYPES[k].label] as const),
  };
  host.appendChild(fieldRow(typeField, typeHolder, () => {
    changeLayerType(l, typeHolder.type as LayerType);
    refreshAll();
  }));

  const grid = document.createElement('div');
  grid.className = 'field-grid';
  for (const fd of [...(TYPE_FIELDS[l.type] ?? []), ...COMMON_FIELDS]) {
    if (fd.type === 'color' && fd.showIf && !fd.showIf(l)) continue;
    grid.appendChild(fieldRow(fd, l, (field) => {
      render();
      renderLayerListMeta();
      if (field.key === 'ownColor') renderEditor();
    }));
  }
  host.appendChild(grid);

  if (l.type === 'runes' || l.type === 'sigil') {
    const b = document.createElement('button');
    b.className = 'btn small';
    b.textContent = '↻ Reroll this layer’s ' + (l.type === 'runes' ? 'glyphs' : 'sigil');
    b.addEventListener('click', () => layerAction('reroll'));
    host.appendChild(b);
  }
}

// ---------- Design panel ----------
function renderDesignPanel(): void {
  const d = state.design;
  $<HTMLInputElement>('#seed').value = d.seed;
  const host = $('#design-fields');
  host.innerHTML = '';
  for (const fd of DESIGN_FIELDS) host.appendChild(fieldRow(fd, d, () => render()));
}

function setupStatic(): void {
  // Presets
  const pre = $('#presets');
  for (const [name, make] of Object.entries(PRESETS)) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = name;
    b.addEventListener('click', () => applyTemplate(make()));
    pre.appendChild(b);
  }
  // Themes
  const th = $('#themes');
  for (const [name, t] of Object.entries(THEMES)) {
    const b = document.createElement('button');
    b.className = 'swatch';
    b.title = name;
    b.setAttribute('aria-label', name);
    b.style.background = `radial-gradient(circle at 50% 50%, ${t.ink} 0 28%, ${t.bg} 30%)`;
    b.addEventListener('click', () => {
      state.design.ink = t.ink;
      state.design.bg = t.bg;
      renderDesignPanel();
      render();
    });
    th.appendChild(b);
  }
  // Add-layer type select
  $('#add-type').innerHTML = LAYER_TYPES.map((k) => `<option value="${k}">${TYPES[k].label}</option>`).join('');

  // Toolbar
  $('#btn-random').addEventListener('click', () => {
    state.design.seed = randomSeed();
    applyTemplate(randomDesign(state.design.seed));
  });
  $('#btn-play').addEventListener('click', () => {
    state.playing = !state.playing;
    $('#btn-play').textContent = state.playing ? '❚❚ Pause' : '▶ Spin';
  });
  $('#btn-reset-spin').addEventListener('click', () => {
    state.t = 0;
    render();
  });
  $('#btn-share').addEventListener('click', shareLink);

  document.querySelectorAll<HTMLElement>('[data-layer-action]').forEach((b) =>
    b.addEventListener('click', () => layerAction(b.dataset.layerAction as LayerAction)));

  // Seed
  const seedInput = $<HTMLInputElement>('#seed');
  seedInput.addEventListener('change', () => {
    state.design.seed = seedInput.value.trim() || randomSeed();
    render();
  });
  $('#btn-reseed').addEventListener('click', () => {
    state.design.seed = randomSeed();
    seedInput.value = state.design.seed;
    render();
  });

  // Image export + design files
  $('#btn-svg').addEventListener('click', exportSvg);
  $('#btn-png').addEventListener('click', () => exportPng(false));
  $('#btn-stencil').addEventListener('click', () => exportPng(true));
  $('#btn-json').addEventListener('click', exportJson);
  $<HTMLInputElement>('#file-json').addEventListener('change', importJson);
  const transparent = $<HTMLInputElement>('#transparent');
  transparent.addEventListener('change', () => {
    state.design.transparent = transparent.checked;
    persist();
  });

  // Spellbook
  $('#btn-lib-save').addEventListener('click', saveToLibrary);

  setupStageInteraction();
}

// ---------- Stage interaction: click a ring to select, drag to rotate, Shift+drag to resize ----------
function setupStageInteraction(): void {
  const host = $('#stage');
  let drag: { l: Layer; startA: number; startRot: number; startR: number; startDist: number } | null = null;
  const toLocal = (e: PointerEvent) => {
    const rect = $('svg', host).getBoundingClientRect();
    const s = 1000 / rect.width;
    const x = (e.clientX - rect.left) * s - 500;
    const tilt = Math.cos((state.design.tilt * Math.PI) / 180);
    const y = ((e.clientY - rect.top) * s - 500) / tilt;
    return { r: Math.hypot(x, y), a: (Math.atan2(x, -y) * 180) / Math.PI };
  };
  host.addEventListener('pointerdown', (e) => {
    const p = toLocal(e);
    let best: Layer | null = null;
    let bestD = 40;
    for (const l of state.design.layers) {
      if (!l.visible) continue;
      const dd = Math.abs(l.radius * 1000 - p.r);
      if (dd < bestD) {
        bestD = dd;
        best = l;
      }
    }
    if (!best) return;
    state.selectedId = best.id;
    renderLayerList();
    renderEditor();
    drawSelection();
    drag = { l: best, startA: p.a, startRot: best.rotation, startR: best.radius, startDist: p.r };
    host.setPointerCapture(e.pointerId);
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toLocal(e);
    if (e.shiftKey) {
      drag.l.radius = Math.min(0.5, Math.max(0.01, drag.startR + (p.r - drag.startDist) / 1000));
    } else {
      const rot = drag.startRot + (p.a - drag.startA);
      drag.l.rotation = Math.round(((rot + 540) % 360) - 180);
    }
    render();
  });
  const end = (): void => {
    if (!drag) return;
    drag = null;
    renderEditor();
    renderLayerListMeta();
  };
  host.addEventListener('pointerup', end);
  host.addEventListener('pointercancel', end);
}

// ---------- Image export ----------
function exportSvg(): void {
  const svg = '<?xml version="1.0" encoding="UTF-8"?>\n' + buildSvg(state.design, { t: state.t, forExport: true });
  download(new Blob([svg], { type: 'image/svg+xml' }), fileBase() + '.svg');
}

function exportPng(stencil: boolean): void {
  const size = parseInt($<HTMLSelectElement>('#png-size').value, 10);
  let svg = buildSvg(state.design, stencil
    ? { t: state.t, forExport: true, ink: '#000000', bg: '#ffffff', transparent: false }
    : { t: state.t, forExport: true });
  if (stencil) {
    // Force every layer to black: strip own colors and glows.
    svg = svg.replace(/style="color:[^"]*"/g, 'style="color:#000000"').replace(/ filter="url\([^)]*\)"/g, '');
  }
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d')?.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);
    c.toBlob((b) => {
      if (b) download(b, fileBase() + (stencil ? '-stencil' : '') + '.png');
      else toast('PNG export failed');
    }, 'image/png');
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('PNG export failed');
  };
  img.src = url;
}

// ---------- Design files ----------
function exportJson(): void {
  const data = JSON.stringify({ app: 'magic-circle-maker', version: 1, design: state.design }, null, 2);
  download(new Blob([data], { type: 'application/json' }), fileBase() + '.json');
}

async function importJson(e: Event): Promise<void> {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  try {
    const parsed: unknown = JSON.parse(await file.text());
    const design = typeof parsed === 'object' && parsed !== null && 'design' in parsed ? parsed.design : parsed;
    loadDesign(design);
    toast('Design loaded');
  } catch {
    toast('Could not read that file');
  }
  input.value = '';
}

// ---------- Persistence / share ----------
function loadDesign(d: unknown): void {
  state.design = normalize(d);
  state.selectedId = state.design.layers[0]?.id ?? null;
  state.t = 0;
  refreshAll();
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state.design));
  } catch {
    /* storage unavailable */
  }
}

function shareLink(): void {
  const url = location.href.split('#')[0] + '#d=' + encodeDesign(state.design);
  history.replaceState(null, '', url);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => toast('Link copied to clipboard'), () => toast('Link is in the address bar'));
  } else {
    toast('Link is in the address bar');
  }
}

// ---------- Spellbook (named circles with notes, for your manuscript) ----------
interface LibraryEntry {
  name: string;
  notes: string;
  savedAt: string;
  design: Design;
}

function readLib(): LibraryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LIB_KEY) ?? '[]');
    return Array.isArray(parsed) ? (parsed as LibraryEntry[]) : [];
  } catch {
    return [];
  }
}

function writeLib(lib: LibraryEntry[]): boolean {
  try {
    localStorage.setItem(LIB_KEY, JSON.stringify(lib));
    return true;
  } catch {
    toast('Could not save (storage full or blocked)');
    return false;
  }
}

function saveToLibrary(): void {
  const name = $<HTMLInputElement>('#lib-name').value.trim() || 'Untitled circle';
  const notes = $<HTMLTextAreaElement>('#lib-notes').value.trim();
  const lib = readLib();
  const existing = lib.findIndex((e) => e.name === name);
  const entry: LibraryEntry = { name, notes, savedAt: new Date().toISOString(), design: structuredClone(state.design) };
  if (existing >= 0) lib[existing] = entry;
  else lib.unshift(entry);
  if (writeLib(lib)) {
    toast(existing >= 0 ? `Updated “${name}”` : `Saved “${name}”`);
    renderLibrary();
  }
}

function renderLibrary(): void {
  const host = $('#library');
  const lib = readLib();
  if (!lib.length) {
    host.innerHTML = '<p class="muted">No saved circles yet. Name one above to keep it with notes.</p>';
    return;
  }
  host.innerHTML = '';
  lib.forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'lib-card';
    const thumb = document.createElement('div');
    thumb.className = 'lib-thumb';
    thumb.innerHTML = buildSvg(normalize(entry.design), { t: 0, transparent: false });
    const info = document.createElement('div');
    info.className = 'lib-info';
    const title = document.createElement('strong');
    title.textContent = String(entry.name);
    const notes = document.createElement('p');
    notes.textContent = String(entry.notes ?? '');
    const actions = document.createElement('div');
    actions.className = 'lib-actions';
    const load = document.createElement('button');
    load.className = 'btn small';
    load.textContent = 'Load';
    load.addEventListener('click', () => {
      loadDesign(entry.design);
      $<HTMLInputElement>('#lib-name').value = String(entry.name);
      $<HTMLTextAreaElement>('#lib-notes').value = String(entry.notes ?? '');
    });
    const del = document.createElement('button');
    del.className = 'btn small ghost';
    del.textContent = 'Delete';
    del.addEventListener('click', () => {
      if (del.dataset.armed) {
        lib.splice(i, 1);
        writeLib(lib);
        renderLibrary();
      } else {
        del.dataset.armed = '1';
        del.textContent = 'Confirm?';
        setTimeout(() => {
          delete del.dataset.armed;
          del.textContent = 'Delete';
        }, 2500);
      }
    });
    actions.append(load, del);
    info.append(title, notes, actions);
    card.append(thumb, info);
    host.appendChild(card);
  });
}

function refreshAll(): void {
  renderDesignPanel();
  renderLayerList();
  renderEditor();
  render();
  $<HTMLInputElement>('#transparent').checked = state.design.transparent;
}

// ---------- Boot ----------
function loadInitialDesign(): boolean {
  if (location.hash) {
    const shared = designFromHash(location.hash);
    if (shared) {
      loadDesign(shared);
      return true;
    }
    console.warn('Ignoring an invalid share link');
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'layers' in saved) {
      loadDesign(saved);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

export function initApp(): void {
  setupStatic();
  if (!loadInitialDesign()) {
    state.design = baseDesign();
    const summoning = PRESETS['Summoning circle'];
    if (summoning) applyTemplate(summoning());
  }
  renderLibrary();
  requestAnimationFrame(tick);
}
