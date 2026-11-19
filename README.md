# Magic Circle Maker

Build layered magic circles (summoning seals, wards, transmutation arrays, arcane clocks) for stories, covers, chapter headers, and worldbuilding notes.

**Try it live: https://dwhisper.github.io/magic-circle-maker/**

## Development

Written in TypeScript (strict) and built with [Vite](https://vite.dev). Needs Node 20.19 or newer.

```sh
npm install
npm run dev        # dev server with hot reload at http://localhost:5173
npm run build      # type-check, then bundle into dist/
npm run preview    # serve the production build locally
npm run typecheck  # type-check only
npm test           # run the test suite once
npm run test:watch # rerun tests as files change
```

Every push to `main` runs the tests, builds the site and deploys it to GitHub Pages via `.github/workflows/deploy.yml`. A failing test or type error stops the deploy, and the live site stays on the last good version.

### Tests

[Vitest](https://vitest.dev) suites in `tests/`:

- `renderers.test.ts`: the geometry each layer type draws, seeded determinism of runes and sigils, escaping of incantation text, how layer settings reach the SVG, every slider at its limits, and a snapshot of every preset's exact output
- `loop.test.ts`: symmetry per layer type, exact and rounded seamless loops (including floating-point edge cases), and a check that every preset loops seamlessly with each loop option

If you change how something is drawn on purpose, update the preset snapshots with `npx vitest run -u` and review the diff.

## Features

- **14 layer types:** ring, polygon, star polygon {n/k}, rune ring, text ring, dots, orbit circles, spokes, I Ching trigrams (Earlier/Later Heaven), moon phases, snowflake arms, spiral, sigil lines, yin-yang
- **Per-layer controls:** radius, line width, rotation, spin, glow, double line, dashed, own color
- **Seeded runes:** the seed fixes every glyph and sigil, so a design always comes back the same
- **Rune script for incantations:** set a Text ring's script to *Seeded rune alphabet* and each letter maps to a consistent glyph for that seed. Your spell text becomes a constructed script you can reuse across a book
- **Presets:** 9 starting points; **Randomize** builds a new balanced design
- **8 color themes** plus custom ink and background colors; global line weight, spin speed, ground tilt
- **On-canvas editing:** click a ring to select it, drag to rotate, Shift+drag to resize
- **Drag-and-drop layer order:** drag rows in the layer list (on touch screens, drag the ⠿ grip); the ↑/↓ buttons still work too
- **Spellbook:** save named circles with notes (who casts it, which chapter) in this browser
- **Image export:** PNG (1024, 2048 or 4096 px, optional transparent background), SVG (vector, for print), and a black-on-white stencil PNG
- **Animation export:**
  - **GIF** (320–800 px), opaque or transparent
  - **Video:** MP4 (H.264), WebM (VP9), transparent WebM for video editors, or green-screen MP4; 720–2160 px at 30 or 60 fps
  - **Loop length:** *Seamless 12 s / 6 s* round each layer's spin speed so every layer finishes whole turns and the loop never jumps. *Exact* keeps your speeds but can need minutes to loop. Fixed 3/5/10 s loops keep your speeds and may jump.
  - The encoders ([gifenc](https://github.com/mattdesl/gifenc) and [Mediabunny](https://mediabunny.dev)) are bundled with the app and load only when you export an animation. Video needs a browser with WebCodecs (current Chrome, Edge, Safari or Firefox)
- **Design files:** save and open `.json`
- **Share link:** the whole design is encoded in the URL

## Files

| File | Purpose |
| --- | --- |
| `src/main.ts` | Entry point |
| `src/types.ts` | Shared types: layers, designs, editor fields |
| `src/rng.ts` | Seeded PRNG and procedural rune glyph generator |
| `src/layers.ts` | Layer types, defaults, editor field schema, SVG renderers |
| `src/presets.ts` | Presets, color themes, randomizer |
| `src/render.ts` | Design → SVG markup (preview and all exports) |
| `src/design.ts` | New designs; sanitizing designs from share links, files and storage |
| `src/app.ts` | UI, preview animation, canvas interaction, layer drag-and-drop, PNG/SVG export, spellbook, share links |
| `src/loop.ts` | Seamless-loop calculation |
| `src/anim-export.ts` | GIF and video export |
| `src/state.ts`, `src/ui.ts` | App state and small DOM helpers |
| `src/gifenc.d.ts` | Type declarations for gifenc (it ships none) |

Spellbook entries live in browser `localStorage`. Use **Save .json** to keep a durable copy alongside your manuscript.
