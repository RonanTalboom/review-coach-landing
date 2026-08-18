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

Four libraries, vendored into `public/vendor/` as plain `<script>` tags:

| Library | Version | Doing what |
|---|---|---|
| [GSAP](https://github.com/greensock/gsap) + ScrollTrigger | 3.13.0 | scroll-triggered reveals in the system's own grammar — rules draw, registration crosses register, the spec sheet plots row by row |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.4 | smooth virtual scroll, wired to `gsap.ticker` and `ScrollTrigger.update` |
| [Vanta](https://github.com/tengbao/vanta) NET + three.js | 0.5.24 / r134 | a faint steel wireframe lattice behind the hero, masked to the upper right and destroyed the moment the hero leaves the viewport |
| [react-bits](https://github.com/DavidHDev/react-bits) | — | **not installed.** react-bits ships React components (Tailwind + framer-motion) and this page has no build step, so its "Decrypted Text" and "Magnet" effects are re-derived by hand in `motion.js` |

Three rules hold the motion layer to the design:

1. **opacity and transform only** — the page is built on a 24px leading unit with `text-box: trim-both`; anything touching height or margin destroys that rhythm.
2. **`prefers-reduced-motion` is a hard stop** — Lenis never initialises, Vanta never starts, every reveal resolves to its final state.
3. **one color** — everything drawn takes `--color-accent` / `--color-divider`.

Nothing under `public/_ds/` is edited; it is Claude Design output and gets clobbered on re-export.

## Develop

```sh
npx serve public
```

## Deploy

```sh
npx wrangler deploy
```

Deploys to Cloudflare Workers Static Assets.
