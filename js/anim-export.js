// Animated exports: GIF (gifenc) and video (Mediabunny / WebCodecs).
// Libraries load from the CDN only when an animated export is requested.
(function (MC) {
  const $ = (sel) => document.querySelector(sel);
  const LIBS = {
    gifenc: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js',
    mediabunny: 'https://cdn.jsdelivr.net/npm/mediabunny@1.65.2/dist/bundles/mediabunny.min.mjs',
  };
  const loaded = {};
  function lib(name) {
    if (!loaded[name]) {
      loaded[name] = import(LIBS[name]).catch((e) => {
        delete loaded[name];
        throw new Error('Could not load the encoder. Check your internet connection and try again.');
      });
    }
    return loaded[name];
  }

  // ---------- Seamless loop length ----------
  // Rotational symmetry (degrees) of a layer: after turning this far it looks identical.
  // 0 = looks the same at any angle (spin is invisible).
  function symmetry(l) {
    const n = Math.max(1, Math.round(l.count || 1));
    switch (l.type) {
      case 'ring': return l.dashed ? 360 : 0;
      case 'polygon': case 'star': case 'dots': case 'spokes': case 'orbits': case 'arms':
        return 360 / n;
      default: return 360;
    }
  }

  function spinningLayers(design) {
    return design.layers
      .filter((l) => l.visible && l.spin && design.spinSpeed)
      .map((l) => ({ l, speed: Math.abs(l.spin * design.spinSpeed), sym: symmetry(l) }))
      .filter((s) => s.sym > 0);
  }

  // Copy of the design with each spin nudged so it completes a whole number of
  // symmetry steps in exactly T seconds (at least one), making the loop seamless.
  function fitDesign(design, T, spins) {
    const fitted = new Map();
    spins.forEach(({ l, speed, sym }) => {
      const k = Math.max(1, Math.round((speed * T) / sym));
      fitted.set(l.id, (Math.sign(l.spin) * k * sym) / (T * design.spinSpeed));
    });
    return { ...design, layers: design.layers.map((l) => (fitted.has(l.id) ? { ...l, spin: fitted.get(l.id) } : l)) };
  }

  // Returns { seconds, seamless, design, adjusted, still }.
  //  auto  - shortest exact loop (up to 3 min) with true speeds; falls back to fit:12
  //  fit:N - loop of N seconds with speeds nudged to match
  //  N     - fixed N seconds, true speeds, may jump
  const MAX_EXACT = 180;
  function loopLength(design, choice) {
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

  function describeLoop() {
    const d = MC.app.state.design;
    const info = loopLength(d, $('#loop-len').value);
    const el = $('#loop-info');
    const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${+s.toFixed(2)} s`);
    if (info.still) el.textContent = 'Nothing spins yet. Give a layer some Spin to animate it.';
    else if (!info.seamless) el.textContent = `Loop: ${secs(info.seconds)} (may jump at the loop point)`;
    else el.textContent = `Loop: ${secs(info.seconds)}, seamless` +
      (info.adjusted ? ', spin speeds rounded so every layer finishes a turn' : '') +
      (info.seconds > 20 ? '. Long loops make big GIFs; try a short seamless option.' : '');
  }

  // ---------- Frame rasterizer ----------
  function makeRasterizer(size, svgOpts, design) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: !!svgOpts.readPixels });
    return {
      canvas, ctx,
      async draw(t) {
        const svg = MC.app.buildSvg(design, { ...svgOpts, forExport: true, t });
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        try {
          const img = new Image();
          img.src = url;
          await img.decode();
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, 0, 0, size, size);
        } finally {
          URL.revokeObjectURL(url);
        }
      },
    };
  }

  // ---------- Progress / busy state ----------
  let job = null;
  function startJob(label) {
    if (job) return null;
    job = { cancelled: false };
    document.querySelectorAll('.export-btn').forEach((b) => (b.disabled = true));
    $('#progress').hidden = false;
    setProgress(0, label);
    return job;
  }
  function setProgress(frac, label) {
    $('#progress-bar').style.width = (frac * 100).toFixed(1) + '%';
    if (label) $('#progress-label').textContent = label;
  }
  function endJob() {
    job = null;
    document.querySelectorAll('.export-btn').forEach((b) => (b.disabled = false));
    $('#progress').hidden = true;
  }
  const yieldUI = () => new Promise((r) => setTimeout(r, 0));
  class Cancelled extends Error {}

  function preflight() {
    const d = MC.app.state.design;
    const info = loopLength(d, $('#loop-len').value);
    if (info.still) {
      MC.app.toast('Nothing is spinning. Set Spin on a layer first.');
      return null;
    }
    return info;
  }

  // ---------- GIF ----------
  async function exportGif() {
    const info = preflight();
    if (!info) return;
    const j = startJob('Loading GIF encoder…');
    if (!j) return;
    try {
      const { GIFEncoder, quantize, applyPalette } = await lib('gifenc');
      const size = parseInt($('#gif-size').value, 10);
      const transparent = $('#gif-transparent').checked;
      const T = info.seconds;
      // GIF delays are in 1/100 s; longer loops get a lower frame rate to keep files sane.
      const delay = T <= 8 ? 40 : T <= 16 ? 60 : 100;
      const frames = Math.max(2, Math.round((T * 1000) / delay));
      const r = makeRasterizer(size, { transparent, readPixels: true }, info.design);
      const gif = GIFEncoder();
      const format = transparent ? 'rgba4444' : 'rgb565';
      let palette = null, transparentIndex = 0;

      for (let i = 0; i < frames; i++) {
        if (j.cancelled) throw new Cancelled();
        await r.draw((i / frames) * T);
        const { data } = r.ctx.getImageData(0, 0, size, size);
        if (!palette) {
          // Only rotation changes between frames, so one palette fits them all.
          palette = quantize(data, 256, { format, oneBitAlpha: transparent });
          if (transparent) transparentIndex = Math.max(0, palette.findIndex((p) => p[3] === 0));
        }
        const index = applyPalette(data, palette, format);
        gif.writeFrame(index, size, size, {
          palette: i === 0 ? palette : undefined, delay, repeat: 0,
          transparent, transparentIndex, dispose: transparent ? 2 : -1,
        });
        setProgress((i + 1) / frames, `Rendering GIF frame ${i + 1} of ${frames}`);
        await yieldUI();
      }
      gif.finish();
      MC.app.download(new Blob([gif.bytes()], { type: 'image/gif' }), MC.app.fileBase() + (transparent ? '-transparent' : '') + '.gif');
      MC.app.toast('GIF exported');
    } catch (e) {
      if (!(e instanceof Cancelled)) { console.error(e); MC.app.toast(e.message || 'GIF export failed'); }
    } finally {
      endJob();
    }
  }

  // ---------- Video ----------
  const VIDEO_MODES = {
    mp4:        { container: 'mp4',  codecs: ['avc', 'hevc', 'vp9', 'av1'], ext: 'mp4' },
    webm:       { container: 'webm', codecs: ['vp9', 'vp8', 'av1'], ext: 'webm' },
    webmAlpha:  { container: 'webm', codecs: ['vp9', 'vp8'], ext: 'webm', alpha: true, suffix: '-transparent' },
    greenscreen:{ container: 'mp4',  codecs: ['avc', 'hevc', 'vp9', 'av1'], ext: 'mp4', bg: '#00ff00', suffix: '-greenscreen' },
  };

  async function exportVideo() {
    const info = preflight();
    if (!info) return;
    if (typeof VideoEncoder === 'undefined') {
      MC.app.toast('This browser cannot encode video. Try a current Chrome, Edge, Safari or Firefox.');
      return;
    }
    const j = startJob('Loading video encoder…');
    if (!j) return;
    let output = null;
    try {
      const MB = await lib('mediabunny');
      const mode = VIDEO_MODES[$('#video-mode').value];
      const size = parseInt($('#video-size').value, 10);
      const fps = parseInt($('#video-fps').value, 10);
      const target = parseFloat($('#video-length').value); // 0 = single loop
      const T = info.seconds;
      const loops = target ? Math.max(1, Math.round(target / T)) : 1;

      const codec = await MB.getFirstEncodableVideoCodec(mode.codecs, { width: size, height: size });
      if (!codec) throw new Error(`This browser can’t encode ${mode.ext.toUpperCase()} at ${size}px. Try a smaller size or another format.`);

      const r = makeRasterizer(size, { transparent: !!mode.alpha, bg: mode.bg }, info.design);
      output = new MB.Output({
        format: mode.container === 'mp4' ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
        target: new MB.BufferTarget(),
      });
      const source = new MB.CanvasSource(r.canvas, {
        codec,
        quality: MB.QUALITY_HIGH,
        keyFrameInterval: 2,
        ...(mode.alpha ? { alpha: 'keep' } : {}),
      });
      output.addVideoTrack(source, { frameRate: fps });
      await output.start();

      const perLoop = Math.max(2, Math.round(T * fps));
      const total = perLoop * loops;
      const dt = T / perLoop;
      for (let i = 0; i < total; i++) {
        if (j.cancelled) throw new Cancelled();
        await r.draw((i % perLoop) * dt);
        await source.add(i * dt, dt);
        if (i % 3 === 0 || i === total - 1) {
          setProgress((i + 1) / total, `Encoding frame ${i + 1} of ${total}`);
          await yieldUI();
        }
      }
      setProgress(1, 'Finishing file…');
      await output.finalize();
      const type = mode.container === 'mp4' ? 'video/mp4' : 'video/webm';
      MC.app.download(new Blob([output.target.buffer], { type }), MC.app.fileBase() + (mode.suffix || '') + '.' + mode.ext);
      MC.app.toast(`Video exported (${codec.toUpperCase()})`);
    } catch (e) {
      if (output && output.state !== 'finalized') { try { await output.cancel(); } catch (_) { /* ignore */ } }
      if (!(e instanceof Cancelled)) { console.error(e); MC.app.toast(e.message || 'Video export failed'); }
    } finally {
      endJob();
    }
  }

  function setup() {
    $('#btn-gif').addEventListener('click', exportGif);
    $('#btn-video').addEventListener('click', exportVideo);
    $('#btn-cancel-export').addEventListener('click', () => { if (job) job.cancelled = true; });
    $('#loop-len').addEventListener('change', describeLoop);
    // Keep the loop readout current as the design changes.
    let pending = false;
    const refresh = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; if (MC.app.state.design) describeLoop(); });
    };
    document.addEventListener('input', refresh);
    document.addEventListener('click', refresh);
    document.addEventListener('change', refresh);
    refresh();
  }

  MC.loopLength = loopLength;
  document.addEventListener('DOMContentLoaded', () => setTimeout(setup, 0));
})(window.MC);
