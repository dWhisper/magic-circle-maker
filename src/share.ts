// Share links: the whole design, as JSON, base64url-encoded into the URL hash (#d=...).
// Anything decoded from a link is untrusted, so it always goes through normalize().
import { isDesignLike, normalize } from './design';
import type { Design } from './types';

function base64urlEncode(str: string): string {
  let bin = '';
  for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** The `#d=...` token for a design. */
export function encodeDesign(design: Design): string {
  return base64urlEncode(JSON.stringify(design));
}

/** Decode a share token into a safe design. Throws if the token isn't an encoded design. */
export function decodeDesign(token: string): Design {
  const parsed: unknown = JSON.parse(base64urlDecode(token));
  // Loading a link replaces (and auto-saves over) the current design,
  // so anything that isn't recognisably a design is rejected outright.
  if (!isDesignLike(parsed)) throw new Error('Not a magic circle design');
  return normalize(parsed);
}

/** The design in a URL hash, or null if there isn't a valid one. */
export function designFromHash(hash: string): Design | null {
  const token = hash.match(/^#d=([\w-]+)$/)?.[1];
  if (!token) return null;
  try {
    return decodeDesign(token);
  } catch {
    return null;
  }
}
