import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs so the build works under /magic-circle-maker/ on GitHub Pages.
  base: './',
  build: {
    target: 'es2022',
    // The Mediabunny video encoder (~730 kB) is its own lazily loaded chunk,
    // fetched only when someone exports a video, so it doesn't slow page load.
    chunkSizeWarningLimit: 800,
  },
});
