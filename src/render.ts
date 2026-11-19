// Design -> SVG markup. Shared by the preview, image export and animation export.
import { renderers } from './layers';
import { fmt } from './rng';
import type { Design } from './types';

export const SVGNS = 'http://www.w3.org/2000/svg';

export interface SvgOptions {
  /** Seconds of spin to apply to each layer's rotation. */
  t: number;
  /** Adds explicit width/height so the SVG has an intrinsic size. */
  forExport?: boolean;
  /** Overrides the design's ink colour. */
  ink?: string;
  /** Overrides the design's background colour. */
  bg?: string;
  /** Overrides the design's transparent-background setting. */
  transparent?: boolean;
}

export function buildSvg(design: Design, opts: SvgOptions): string {
  const ink = opts.ink ?? design.ink;
  const bg = opts.bg ?? design.bg;
  const transparent = opts.transparent ?? design.transparent;
  const tiltScale = Math.cos((design.tilt * Math.PI) / 180);
  let defs = '';
  let body = '';
  for (const l of design.layers) {
    if (!l.visible) continue;
    const color = l.ownColor ? l.color : ink;
    const w = l.width * design.lineWeight;
    let inner = '';
    try {
      inner = renderers[l.type](l, { seed: design.seed, w, bg });
    } catch (e) {
      console.error(`Failed to render ${l.type} layer`, e);
    }
    let filter = '';
    if (l.glow > 0) {
      const fid = 'glow-' + l.id;
      defs += `<filter id="${fid}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${fmt(2 + l.glow * 14)}" result="b"/>` +
        `<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`;
      filter = ` filter="url(#${fid})"`;
    }
    const dash = l.dashed ? ` stroke-dasharray="${fmt(w * 5)} ${fmt(w * 3.5)}"` : '';
    const rot = fmt(l.rotation + l.spin * design.spinSpeed * opts.t);
    body += `<g data-layer="${l.id}" transform="rotate(${rot})" style="color:${color}" fill="none" stroke="currentColor" stroke-width="${fmt(w)}"${dash}${filter}>${inner}</g>`;
  }
  const bgRect = transparent ? '' : `<rect x="-500" y="-500" width="1000" height="1000" fill="${bg}"/>`;
  return `<svg xmlns="${SVGNS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-500 -500 1000 1000"${opts.forExport ? ' width="1000" height="1000"' : ''}>` +
    `<defs>${defs}</defs>${bgRect}<g id="world" transform="scale(1 ${fmt(tiltScale)})">${body}</g></svg>`;
}
