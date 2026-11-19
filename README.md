# Magic Circle Maker

Build layered magic circles (summoning seals, wards, transmutation arrays, arcane clocks) for stories, covers, chapter headers, and worldbuilding notes.

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Features

- **14 layer types:** ring, polygon, star polygon {n/k}, rune ring, text ring, dots, orbit circles, spokes, I Ching trigrams (Earlier/Later Heaven), moon phases, snowflake arms, spiral, sigil lines, yin-yang
- **Per-layer controls:** radius, line width, rotation, spin, glow, double line, dashed, own color
- **Seeded runes:** the seed fixes every glyph and sigil, so a design always comes back the same
- **Rune script for incantations:** set a Text ring's script to *Seeded rune alphabet* and each letter maps to a consistent glyph for that seed. Your spell text becomes a constructed script you can reuse across a book
- **Presets:** 9 starting points; **Randomize** builds a new balanced design
- **8 color themes** plus custom ink and background colors; global line weight, spin speed, ground tilt
- **On-canvas editing:** click a ring to select it, drag to rotate, Shift+drag to resize
- **Spellbook:** save named circles with notes (who casts it, which chapter) in this browser
- **Image export:** PNG (1024, 2048 or 4096 px, optional transparent background), SVG (vector, for print), and a black-on-white stencil PNG
- **Animation export:**
  - **GIF** (320–800 px), opaque or transparent
  - **Video:** MP4 (H.264), WebM (VP9), transparent WebM for video editors, or green-screen MP4; 720–2160 px at 30 or 60 fps
  - **Loop length:** *Seamless 12 s / 6 s* round each layer's spin speed so every layer finishes whole turns and the loop never jumps. *Exact* keeps your speeds but can need minutes to loop. Fixed 3/5/10 s loops keep your speeds and may jump.
  - The encoders ([gifenc](https://github.com/mattdesl/gifenc) 1.0.3 and [Mediabunny](https://mediabunny.dev) 1.65.2) load from jsDelivr on first use, so animated export needs an internet connection and a browser with WebCodecs (current Chrome, Edge, Safari or Firefox)
- **Design files:** save and open `.json`
- **Share link:** the whole design is encoded in the URL

## Files

| File | Purpose |
| --- | --- |
| `js/rng.js` | Seeded PRNG and procedural rune glyph generator |
| `js/layers.js` | Layer types, editor field schema, SVG renderers |
| `js/presets.js` | Presets, color themes, randomizer |
| `js/app.js` | UI, animation, canvas interaction, PNG/SVG export, spellbook, share links |
| `js/anim-export.js` | Seamless-loop calculation, GIF and video export |

Spellbook entries live in browser `localStorage`. Use **Save .json** to keep a durable copy alongside your manuscript.
