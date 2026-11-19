// Design files (.json): saving a design to disk and opening it again.
// Opened files are untrusted, so their design always goes through normalize().
import { isDesignLike, normalize } from './design';
import type { Design } from './types';

export const FILE_APP = 'magic-circle-maker';
export const FILE_VERSION = 1;
/** Real design files are a few kB; anything this big is the wrong file. */
export const MAX_FILE_BYTES = 1_000_000;

export interface DesignFile {
  app: typeof FILE_APP;
  version: number;
  design: Design;
}

/** The contents of a .json design file. */
export function designToFile(design: Design): string {
  const file: DesignFile = { app: FILE_APP, version: FILE_VERSION, design };
  return JSON.stringify(file, null, 2) + '\n';
}

export type ImportResult = { ok: true; design: Design } | { ok: false; error: string };

const fail = (error: string): ImportResult => ({ ok: false, error });
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Read a design file's text. Accepts files saved by this app, plus a bare design
 * object (the format used for share links and browser storage). Anything else is
 * rejected with a message for the user, so a wrong file never replaces their design.
 */
export function designFromFile(text: string): ImportResult {
  if (text.length > MAX_FILE_BYTES) return fail('That file is too large to be a design file.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ''));
  } catch {
    return fail('That file isn’t a design file (it isn’t valid JSON).');
  }
  if (!isRecord(parsed)) return fail('That file doesn’t contain a magic circle design.');

  let design: unknown = parsed;
  if ('app' in parsed || 'design' in parsed) {
    if ('app' in parsed && parsed.app !== FILE_APP) return fail('That file is from a different app.');
    design = parsed.design;
  }
  if (!isDesignLike(design)) return fail('That file doesn’t contain a magic circle design.');
  return { ok: true, design: normalize(design) };
}
