// Minimal types for gifenc 1.0.3 (the package ships none). Covers only what this app uses.
declare module 'gifenc' {
  export type PaletteFormat = 'rgb565' | 'rgb444' | 'rgba4444';
  export type Color = [number, number, number] | [number, number, number, number];
  export type Palette = Color[];

  export interface QuantizeOptions {
    format?: PaletteFormat;
    oneBitAlpha?: boolean | number;
    clearAlpha?: boolean;
    clearAlphaThreshold?: number;
    clearAlphaColor?: number;
  }

  export interface WriteFrameOptions {
    palette?: Palette;
    /** Frame delay in milliseconds (stored in 1/100 s). */
    delay?: number;
    /** 0 = loop forever, -1 = play once. */
    repeat?: number;
    transparent?: boolean;
    transparentIndex?: number;
    /** GIF disposal method; -1 leaves it unspecified. */
    dispose?: number;
    colorDepth?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, opts?: WriteFrameOptions): void;
    finish(): void;
    /** A copy of the encoded file. */
    bytes(): Uint8Array<ArrayBuffer>;
    bytesView(): Uint8Array;
    reset(): void;
  }

  export function GIFEncoder(opts?: { initialCapacity?: number; auto?: boolean }): Encoder;
  export function quantize(rgba: Uint8Array | Uint8ClampedArray, maxColors: number, opts?: QuantizeOptions): Palette;
  export function applyPalette(rgba: Uint8Array | Uint8ClampedArray, palette: Palette, format?: PaletteFormat): Uint8Array;
}
