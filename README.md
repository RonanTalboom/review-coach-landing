# Review Coach — landing page

Marketing landing page for [Review Coach](https://github.com/RonanTalboom/review-coach), built from a Claude Design project (the "Industry" wireframe design system). Static HTML/CSS/JS — no build step.

## Structure

- `public/index.html` — the page
- `public/ds-base.js` — loads the design system's stylesheet + bundle at runtime
- `public/image-slot.js` — the `<image-slot>` custom element (drag-and-drop image placeholder; degrades to a static placeholder outside the Claude Design canvas)
- `public/_ds/industry-f631574a-b200-4ece-ad8f-089971408774/` — the "Industry" design system's tokens (`styles.css`) and component bundle (`_ds_bundle.js`)
- `public/motion.js` — the motion layer (see its header for the motion laws)
- `public/vendor/` — vendored, pinned libraries; no npm, no build step

## Motion

Four libraries, vendored into `public/vendor/` as plain scripts. No npm, no build step.

| Library | Version | Doing what |
|---|---|---|
| [GSAP](https://github.com/greensock/gsap) + ScrollTrigger | 3.13.0 | every reveal, the pinned pipeline strip, the plot sequence, the drafting cursor |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.4 | smooth virtual scroll, wired to `gsap.ticker` and `ScrollTrigger.update` |
| [Vanta](https://github.com/tengbao/vanta) NET + three.js | 0.5.24 / r134 | the steel wireframe lattice behind the hero |
| [Vanta](https://github.com/tengbao/vanta) TOPOLOGY + p5 | 0.5.24 / 1.9.4 | the contour field behind the closing sheet |
| [react-bits](https://github.com/DavidHDev/react-bits) | — | **not installed.** It ships React components (Tailwind + framer-motion) and this page has no build step, so its "Decrypted Text" and "Magnet" effects are re-derived by hand in `motion.js` |

### What it does

- **The plot** — on the first visit of a session the sheet set draws itself: crosses set, a rule swept, a counter run to 100. Any click or key skips it.
- **Drawn structure** — caption rules draw from their left edge, registration crosses scale onto their marks, the spec plate and the wireframe cells are *plotted* by an SVG stroke rather than painted by a border, and the sheet plots one row at a time.
- **The drafting cursor** — crosshair rules track the pointer with a live coordinate readout, and turn into a dimension call-out (`⌀ 323×185`) over any framed object.
- **Sheet 03** — the five real pipeline stages, pinned and read left to right. Stage text and module paths come from the app's own README.
- **The sheet index** — a numbered tab rail in the right margin, current sheet marked.

### Payload

Only the engine loads up front. Both background fields are fetched on approach and destroyed when their section leaves the viewport.

| | raw | gzip | when |
|---|---|---|---|
| gsap + ScrollTrigger + lenis | 129K | 48K | up front |
| three + vanta.net | 613K | 152K | when the hero is in view |
| p5 + vanta.topology | 1020K | 242K | only if you reach the last sheet |

A visitor who reads the hero and leaves downloads neither field; nobody downloads p5 until they scroll to the end.

### The three rules

1. **opacity and transform only** — the page is built on a 24px leading unit with `text-box: trim-both`; anything touching height or margin destroys that rhythm.
2. **`prefers-reduced-motion` is a hard stop** — Lenis never initialises, no field starts, no section pins, every reveal resolves to its final state, and the pipeline strip is a plain native horizontal scroll.
3. **one color** — everything drawn takes `--color-accent` / `--color-divider`.

Nothing under `public/_ds/` is edited; it is Claude Design output and gets clobbered on re-export.

## Verify

`scripts/verify.mjs` renders the page twice under CDP — motion on, and `prefers-reduced-motion` — and asserts two invariants that together cover the whole document:

- **LANDMARK** — `.plate`'s absolute document Y is identical in both modes.
- **DELTA** — the two documents differ by *exactly* the pin distance the motion layer asks for, and by nothing else.

```sh
python3 -m http.server 4321 --directory public &
node scripts/verify.mjs 1200          # desktop: the pinned strip adds 1200px
node scripts/verify.mjs 0 390 844     # phone: no pin, so no difference at all
```

It exists because a `min-height` pin measured against the fallback font face once inflated the hero by 196px and no screenshot showed it — the two documents disagreeing was the only signal.
