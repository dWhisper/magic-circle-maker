import type { GlyphSet, Script } from './glyphs';

export type { GlyphSet, Script } from './glyphs';

export type LayerType =
  | 'ring' | 'polygon' | 'star' | 'runes' | 'text' | 'dots' | 'orbits'
  | 'spokes' | 'trigrams' | 'phases' | 'arms' | 'spiral' | 'sigil' | 'yinyang' | 'emblem';
export type TrigramOrder = 'earlier' | 'later';

/** Settings every layer has, whatever its type. */
export interface CommonProps {
  visible: boolean;
  radius: number; // 0..0.5 of the canvas width
  width: number; // stroke width in px (at 1000px canvas)
  double: boolean;
  dashed: boolean;
  rotation: number; // degrees
  spin: number; // degrees per second
  ownColor: boolean;
  color: string;
  glow: number; // 0..1
}

/** Type-specific parameters. Every layer carries all of them; each type reads the ones it needs. */
export interface TypeParams {
  count: number;
  step: number;
  band: number;
  /** Rune ring: which glyphs to draw. */
  glyphs: GlyphSet;
  text: string;
  script: Script;
  fontSize: number;
  size: number;
  inner: number;
  order: TrigramOrder;
  turns: number;
  branches: number;
  shortArms: boolean;
  /** Emblem: a symbol name or a rune character. */
  icon: string;
}

export interface Layer extends CommonProps, TypeParams {
  id: string;
  /** Per-layer randomness salt, combined with the design seed for glyphs/sigils. */
  salt: number;
  type: LayerType;
}

export interface Design {
  seed: string;
  ink: string;
  bg: string;
  transparent: boolean;
  lineWeight: number;
  spinSpeed: number;
  tilt: number; // degrees
  layers: Layer[];
}

/** What a preset or the randomizer produces. */
export interface DesignTemplate {
  theme: string;
  layers: Layer[];
}

export interface RenderCtx {
  seed: string;
  /** Effective stroke width (layer width × design line weight). */
  w: number;
  bg: string;
}

export type Renderer = (layer: Layer, ctx: RenderCtx) => string;

// ---------- Editor field schema ----------

/** Keys of T whose values are assignable to V. */
export type KeysOfType<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];

interface FieldBase {
  label: string;
}
export interface RangeField<T> extends FieldBase {
  type: 'range';
  key: KeysOfType<T, number>;
  min: number;
  max: number;
  step: number;
  unit?: string;
}
export interface CheckField<T> extends FieldBase {
  type: 'check';
  key: KeysOfType<T, boolean>;
}
export interface ColorField<T> extends FieldBase {
  type: 'color';
  key: KeysOfType<T, string>;
  showIf?: (obj: T) => boolean;
}
export interface TextField<T> extends FieldBase {
  type: 'text' | 'textarea';
  key: KeysOfType<T, string>;
}
export interface SelectField<T> extends FieldBase {
  type: 'select';
  key: KeysOfType<T, string>;
  /** Plain options, or labelled groups of options (shown as <optgroup>s). */
  options: ReadonlyArray<SelectOption | SelectGroup>;
}
export type SelectOption = readonly [value: string, label: string];
export interface SelectGroup {
  label: string;
  options: ReadonlyArray<SelectOption>;
}

/** A visual grid of glyphs (runes or symbols), browsed one group at a time. */
export interface PickerField<T> extends FieldBase {
  type: 'picker';
  key: KeysOfType<T, string>;
  groups: ReadonlyArray<SelectGroup>;
}

export type Field<T> = RangeField<T> | CheckField<T> | ColorField<T> | TextField<T> | SelectField<T> | PickerField<T>;
