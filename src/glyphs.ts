// Real rune alphabets and symbol sets, on top of the outlines in glyph-data.ts.
import { ICON_GROUPS, ICON_PATHS, RUNE_LABELS, RUNE_PATHS } from './glyph-data';

export type RuneAlphabet = 'elder' | 'younger' | 'futhorc' | 'medieval';
export type IconGroup = keyof typeof ICON_GROUPS;
/** What a rune ring draws: generated runes, a real rune alphabet, or a group of symbols. */
export type GlyphSet = 'seeded' | RuneAlphabet | IconGroup;
/** How a text ring writes its words. 'runes' is the generated per-design alphabet. */
export type Script = 'latin' | 'runes' | RuneAlphabet;

interface AlphabetDef {
  label: string;
  /** The runes in traditional order. */
  runes: string;
  /**
   * Latin letters (and a few digraphs) to runes. Longest match wins, so "th"
   * becomes thorn rather than t + h. Letters without a rune are dropped.
   */
  latin: Readonly<Record<string, string>>;
}

const map = (pairs: string): Record<string, string> =>
  Object.fromEntries(pairs.trim().split(/\s+/).map((p) => p.split('=') as [string, string]));

export const ALPHABETS: Readonly<Record<RuneAlphabet, AlphabetDef>> = {
  elder: {
    label: 'Elder Futhark',
    runes: 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ',
    latin: map(`th=ᚦ ng=ᛜ a=ᚨ b=ᛒ c=ᚲ d=ᛞ e=ᛖ f=ᚠ g=ᚷ h=ᚺ i=ᛁ j=ᛃ k=ᚲ l=ᛚ m=ᛗ n=ᚾ o=ᛟ p=ᛈ
      q=ᚲ r=ᚱ s=ᛊ t=ᛏ u=ᚢ v=ᚹ w=ᚹ x=ᚲᛊ y=ᛁ z=ᛉ þ=ᚦ`),
  },
  younger: {
    label: 'Younger Futhark',
    runes: 'ᚠᚢᚦᚬᚱᚴᚼᚾᛁᛅᛋᛏᛒᛘᛚᛦ',
    latin: map(`th=ᚦ a=ᛅ b=ᛒ c=ᚴ d=ᛏ e=ᛁ f=ᚠ g=ᚴ h=ᚼ i=ᛁ j=ᛁ k=ᚴ l=ᛚ m=ᛘ n=ᚾ o=ᚬ p=ᛒ q=ᚴ r=ᚱ
      s=ᛋ t=ᛏ u=ᚢ v=ᚢ w=ᚢ x=ᚴᛋ y=ᚢ z=ᛋ þ=ᚦ`),
  },
  futhorc: {
    label: 'Anglo-Saxon futhorc',
    runes: 'ᚠᚢᚦᚩᚱᚳᚷᚹᚻᚾᛁᛄᛇᛈᛉᛋᛏᛒᛖᛗᛚᛝᛟᛞᚪᚫᚣᛠ',
    latin: map(`th=ᚦ ng=ᛝ ea=ᛠ st=ᛥ ae=ᚫ oe=ᛟ a=ᚪ b=ᛒ c=ᚳ d=ᛞ e=ᛖ f=ᚠ g=ᚷ h=ᚻ i=ᛁ j=ᛄ k=ᛣ l=ᛚ
      m=ᛗ n=ᚾ o=ᚩ p=ᛈ q=ᛢ r=ᚱ s=ᛋ t=ᛏ u=ᚢ v=ᚠ w=ᚹ x=ᛉ y=ᚣ z=ᛋ þ=ᚦ æ=ᚫ`),
  },
  medieval: {
    label: 'Medieval runes',
    runes: 'ᛆᛒᛍᛑᚧᛂᚠᚵᚼᛁᚴᛚᛘᚿᚮᛔᛩᚱᛌᛐᚢᚡᚥᛪᛦᛎᚦᛅᚯ',
    latin: map(`th=ᚦ a=ᛆ b=ᛒ c=ᛍ d=ᛑ e=ᛂ f=ᚠ g=ᚵ h=ᚼ i=ᛁ j=ᛁ k=ᚴ l=ᛚ m=ᛘ n=ᚿ o=ᚮ p=ᛔ q=ᛩ r=ᚱ
      s=ᛌ t=ᛐ u=ᚢ v=ᚡ w=ᚥ x=ᛪ y=ᛦ z=ᛎ þ=ᚦ ð=ᚧ æ=ᛅ ø=ᚯ`),
  },
};

export const RUNE_ALPHABETS = Object.keys(ALPHABETS) as RuneAlphabet[];
export const ICON_GROUP_KEYS = Object.keys(ICON_GROUPS) as IconGroup[];
export const isRuneAlphabet = (v: string): v is RuneAlphabet => (RUNE_ALPHABETS as string[]).includes(v);
export const isIconGroup = (v: string): v is IconGroup => (ICON_GROUP_KEYS as string[]).includes(v);

/** Runic word separator (᛫), drawn between words and where the text loops round. */
export const RUNE_SEPARATOR = '᛫';

/** Every glyph set a rune ring can use, in menu order. */
export const GLYPH_SETS: readonly GlyphSet[] = ['seeded', ...RUNE_ALPHABETS, ...ICON_GROUP_KEYS];
export const SCRIPTS: readonly Script[] = ['latin', 'runes', ...RUNE_ALPHABETS];

export const glyphSetLabel = (set: GlyphSet): string =>
  set === 'seeded' ? 'Generated runes' : isRuneAlphabet(set) ? ALPHABETS[set].label : `Symbols: ${ICON_GROUPS[set].label}`;

export const scriptLabel = (script: Script): string =>
  script === 'latin' ? 'Latin letters' : script === 'runes' ? 'Generated rune alphabet' : ALPHABETS[script].label;

/** The glyphs in a set, in order: rune characters or symbol names. */
export function glyphSetItems(set: Exclude<GlyphSet, 'seeded'>): readonly string[] {
  return isRuneAlphabet(set) ? [...ALPHABETS[set].runes] : ICON_GROUPS[set].icons;
}

/** Whether a set has a meaningful order (an alphabet, the zodiac) to show in sequence. */
export const isOrderedSet = (set: GlyphSet): boolean => isRuneAlphabet(set) || set === 'zodiac';

/**
 * Write Latin text in a rune alphabet. Returns one entry per glyph, with null
 * between words. Accents are stripped first (é -> e); anything that still has
 * no rune (digits, most punctuation) is dropped.
 */
export function transliterate(text: string, alphabet: RuneAlphabet): Array<string | null> {
  const table = ALPHABETS[alphabet].latin;
  // Keep the letters the tables map directly (þ ð æ ø); strip accents from the rest.
  const plain = [...text.toLowerCase()]
    .map((ch) => (table[ch] ? ch : ch.normalize('NFD').replace(/\p{M}/gu, '')))
    .join('');
  const out: Array<string | null> = [];
  for (let i = 0; i < plain.length; ) {
    const two = plain.slice(i, i + 2);
    const one = plain.charAt(i);
    const hit = (two.length === 2 && table[two]) ? two : table[one] ? one : null;
    if (hit) {
      out.push(...table[hit]!);
      i += hit.length;
      continue;
    }
    // Anything else separates words; collapse runs so there's one gap between words.
    if (/[\s\p{P}]/u.test(one) && out.length && out[out.length - 1] !== null) out.push(null);
    i += 1;
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** A glyph's outline path (centred on 0,0, spanning -1000..1000), or undefined. */
export const glyphOutline = (key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(RUNE_PATHS, key) ? RUNE_PATHS[key]
    : Object.prototype.hasOwnProperty.call(ICON_PATHS, key) ? ICON_PATHS[key] : undefined;

/** Every glyph an emblem can show: all symbols, then each rune alphabet. */
export const EMBLEM_OPTIONS: ReadonlyArray<{ label: string; options: ReadonlyArray<readonly [string, string]> }> = [
  ...ICON_GROUP_KEYS.map((g) => ({
    label: ICON_GROUPS[g].label,
    options: ICON_GROUPS[g].icons.map((name) => [name, symbolLabel(name)] as const),
  })),
  ...RUNE_ALPHABETS.map((a) => ({
    label: ALPHABETS[a].label,
    options: [...ALPHABETS[a].runes].map((ch) => [ch, `${ch}  ${RUNE_LABELS[ch] ?? ''}`] as const),
  })),
];

export const EMBLEMS: ReadonlySet<string> = new Set(EMBLEM_OPTIONS.flatMap((g) => g.options.map(([v]) => v)));

function symbolLabel(name: string): string {
  const s = name.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
