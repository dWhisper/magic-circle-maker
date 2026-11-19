// Animated exports: GIF (gifenc) and video (Mediabunny / WebCodecs).
// Both encoders are separate bundle chunks, loaded only when an animated export is requested.
import { buildSvg, type SvgOptions } from './render';
import { state } from './state';
import type { Output } from 'mediabunny';
import { type LoopInfo, loopLength } from './loop';
import type { Design } from './types';
import { $, download, fileBase, toast } from './ui';

const loopChoice = (): string => $<HTMLSelectElement>('#loop-len').value;

function describeLoop(): void {
  const info = loopLength(state.design, loopChoice());
  const secs = (s: number): string => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${+s.toFixed(2)} s`);
  let text: string;
  if (info.still) text = 'Nothing spins yet. Give a layer some Spin to animate it.';
  else if (!info.seamless) text = `Loop: ${secs(info.seconds)} (may jump at the loop point)`;
  else {
    text = `Loop: ${secs(info.seconds)}, seamless` +
      (info.adjusted ? ', spin speeds rounded so every layer finishes a turn' : '') +
      (info.seconds > 20 ? '. Long loops make big GIFs; try a short seamless option.' : '');
  }
  $('#loop-info').textContent = text;
}

// ---------- Frame rasterizer ----------
interface Rasterizer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  draw(t: number): Promise<void>;
}

function makeRasterizer(size: number, svgOpts: Omit<SvgOptions, 't'>, design: Design, readPixels = false): Rasterizer {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: readPixels });
  if (!ctx) throw new Error('Canvas is not available in this browser.');
  return {
    canvas,
    ctx,
    async draw(t) {
      const svg = buildSvg(design, { ...svgOpts, forExport: true, t });
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
interface Job {
  cancelled: boolean;
}
let job: Job | null = null;

class Cancelled extends Error {}

function startJob(label: string): Job | null {
  if (job) return null;
  job = { cancelled: false };
  document.querySelectorAll<HTMLButtonElement>('.export-btn').forEach((b) => (b.disabled = true));
  $('#progress').hidden = false;
  setProgress(0, label);
  return job;
}

function setProgress(frac: number, label?: string): void {
  $('#progress-bar').style.width = (frac * 100).toFixed(1) + '%';
  if (label) $('#progress-label').textContent = label;
}

function endJob(): void {
  job = null;
  document.querySelectorAll<HTMLButtonElement>('.export-btn').forEach((b) => (b.disabled = false));
  $('#progress').hidden = true;
}

const yieldUI = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const errorMessage = (e: unknown, fallback: string): string => (e instanceof Error && e.message) || fallback;

function preflight(): LoopInfo | null {
  const info = loopLength(state.design, loopChoice());
  if (info.still) {
    toast('Nothing is spinning. Set Spin on a layer first.');
    return null;
  }
  return info;
}

// ---------- GIF ----------
async function exportGif(): Promise<void> {
  const info = preflight();
  if (!info) return;
  const j = startJob('Loading GIF encoder…');
  if (!j) return;
  try {
    const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
    type Palette = ReturnType<typeof quantize>;
    const size = parseInt($<HTMLSelectElement>('#gif-size').value, 10);
    const transparent = $<HTMLInputElement>('#gif-transparent').checked;
    const T = info.seconds;
    // GIF delays are in 1/100 s; longer loops get a lower frame rate to keep files sane.
    const delay = T <= 8 ? 40 : T <= 16 ? 60 : 100;
    const frames = Math.max(2, Math.round((T * 1000) / delay));
    const r = makeRasterizer(size, { transparent }, info.design, true);
    const gif = GIFEncoder();
    const format = transparent ? 'rgba4444' : 'rgb565';
    let palette: Palette | null = null;
    let transparentIndex = 0;

    for (let i = 0; i < frames; i++) {
      if (j.cancelled) throw new Cancelled();
      await r.draw((i / frames) * T);
      const { data } = r.ctx.getImageData(0, 0, size, size);
      if (!palette) {
        // Only rotation changes between frames, so one palette fits them all.
        palette = quantize(data, 256, { format, oneBitAlpha: transparent });
        if (transparent) transparentIndex = Math.max(0, palette.findIndex((p) => p[3] === 0));
      }
      gif.writeFrame(applyPalette(data, palette, format), size, size, {
        palette: i === 0 ? palette : undefined,
        delay,
        repeat: 0,
        transparent,
        transparentIndex,
        dispose: transparent ? 2 : -1,
      });
      setProgress((i + 1) / frames, `Rendering GIF frame ${i + 1} of ${frames}`);
      await yieldUI();
    }
    gif.finish();
    download(new Blob([gif.bytes()], { type: 'image/gif' }), fileBase() + (transparent ? '-transparent' : '') + '.gif');
    toast('GIF exported');
  } catch (e) {
    if (!(e instanceof Cancelled)) {
      console.error(e);
      toast(errorMessage(e, 'GIF export failed'));
    }
  } finally {
    endJob();
  }
}

// ---------- Video ----------
type VideoCodec = 'avc' | 'hevc' | 'vp9' | 'vp8' | 'av1';
interface VideoMode {
  container: 'mp4' | 'webm';
  codecs: VideoCodec[];
  ext: 'mp4' | 'webm';
  alpha?: boolean;
  bg?: string;
  suffix?: string;
}

const VIDEO_MODES: Record<string, VideoMode> = {
  mp4: { container: 'mp4', codecs: ['avc', 'hevc', 'vp9', 'av1'], ext: 'mp4' },
  webm: { container: 'webm', codecs: ['vp9', 'vp8', 'av1'], ext: 'webm' },
  webmAlpha: { container: 'webm', codecs: ['vp9', 'vp8'], ext: 'webm', alpha: true, suffix: '-transparent' },
  greenscreen: { container: 'mp4', codecs: ['avc', 'hevc', 'vp9', 'av1'], ext: 'mp4', bg: '#00ff00', suffix: '-greenscreen' },
};

async function exportVideo(): Promise<void> {
  const info = preflight();
  if (!info) return;
  if (typeof VideoEncoder === 'undefined') {
    toast('This browser cannot encode video. Try a current Chrome, Edge, Safari or Firefox.');
    return;
  }
  const j = startJob('Loading video encoder…');
  if (!j) return;
  let output: Output | null = null;
  try {
    const MB = await import('mediabunny');
    const mode = VIDEO_MODES[$<HTMLSelectElement>('#video-mode').value] ?? VIDEO_MODES.mp4!;
    const size = parseInt($<HTMLSelectElement>('#video-size').value, 10);
    const fps = parseInt($<HTMLSelectElement>('#video-fps').value, 10);
    const target = parseFloat($<HTMLSelectElement>('#video-length').value); // 0 = one loop
    const T = info.seconds;
    const loops = target ? Math.max(1, Math.round(target / T)) : 1;

    const codec = await MB.getFirstEncodableVideoCodec(mode.codecs, { width: size, height: size });
    if (!codec) throw new Error(`This browser can’t encode ${mode.ext.toUpperCase()} at ${size}px. Try a smaller size or another format.`);

    const r = makeRasterizer(size, { transparent: !!mode.alpha, bg: mode.bg }, info.design);
    const out = new MB.Output({
      format: mode.container === 'mp4' ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
      target: new MB.BufferTarget(),
    });
    output = out;
    const source = new MB.CanvasSource(r.canvas, {
      codec,
      quality: MB.QUALITY_HIGH,
      keyFrameInterval: 2,
      ...(mode.alpha ? { alpha: 'keep' as const } : {}),
    });
    out.addVideoTrack(source, { frameRate: fps });
    await out.start();

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
    await out.finalize();
    const buffer = out.target.buffer;
    if (!buffer) throw new Error('The video encoder produced no data.');
    download(new Blob([buffer], { type: mode.container === 'mp4' ? 'video/mp4' : 'video/webm' }), fileBase() + (mode.suffix ?? '') + '.' + mode.ext);
    toast(`Video exported (${codec.toUpperCase()})`);
  } catch (e) {
    if (output && output.state !== 'finalized') {
      await output.cancel().catch(() => undefined);
    }
    if (!(e instanceof Cancelled)) {
      console.error(e);
      toast(errorMessage(e, 'Video export failed'));
    }
  } finally {
    endJob();
  }
}

export function initAnimExport(): void {
  $('#btn-gif').addEventListener('click', () => void exportGif());
  $('#btn-video').addEventListener('click', () => void exportVideo());
  $('#btn-cancel-export').addEventListener('click', () => {
    if (job) job.cancelled = true;
  });
  $('#loop-len').addEventListener('change', describeLoop);
  // Keep the loop readout current as the design changes.
  let pending = false;
  const refresh = (): void => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      describeLoop();
    });
  };
  for (const evt of ['input', 'click', 'change']) document.addEventListener(evt, refresh);
  refresh();
}
