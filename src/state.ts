import type { Design } from './types';

export interface AppState {
  design: Design;
  selectedId: string | null;
  /** Whether the preview spins. */
  playing: boolean;
  /** Seconds of accumulated spin time shown in the preview. */
  t: number;
}

// `design` is assigned during boot, before anything reads it.
export const state: AppState = {
  design: undefined as unknown as Design,
  selectedId: null,
  playing: true,
  t: 0,
};
