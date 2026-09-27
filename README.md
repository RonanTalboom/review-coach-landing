# Review Coach — landing page

Marketing page for Review Coach, live at [review.consensuslabs.net](https://review.consensuslabs.net). Static HTML, CSS and JS, no build step, served by Workers Static Assets.

It uses the **Consensus Labs house style** from [consensuslabs.net](https://consensuslabs.net) (`~/Documents/Git/consensuslabs`): paper `#f7f1e3`, ink `#131210`, one green `#0e7a4e`, Archivo 900 titles over IBM Plex Mono labels, square corners, and 1px ink rules as the only structure. Sections are numbered `NN / Label` like the studio site.

## Structure

- `public/index.html` — the page and all of its CSS
- `public/site.js` — the motion layer (see its header for the rules)
- `public/favicon.svg`
- `public/vendor/` — vendored, pinned libraries; no npm
- `scripts/verify.mjs` — the layout oracle and click-through

`/github*` on the same host is **not** this Worker. It is routed to the `review-coach-github` Worker (the GitHub App), and routes run before the Custom Domain. Do not add pages under `public/github`.

## The first screen

Tagline, one short line, two buttons, and the **hero stage**: an illustrated app window with three question cards that are dealt, kept into the pending review, or dismissed. It runs two cycles, then holds on a dealt frame. With reduced motion or no JS it is a static, finished frame. Everything on the stage is illustration: fixture code, questions written for the page, no numbers. The stage uses different fixture cases from section 01, so the two never repeat.

Why this shape (from the book library, `/consult-books`): a clear, truthful tagline (Blue Ocean Strategy, ch. 2), buyer words over operational jargon (Blue Ocean Strategy, ch. 2), concrete images over abstract claims (The Sense of Style, ch. 3), and proof over boasts (The Laws of Connection, ch. 8).

## Copy is checked against the app

Every product claim comes from the app's code on its latest branch, not from its README (which was stale on the card cap):

| Claim | Source in `RonanTalboom/review-coach` |
|---|---|
| at most 3 cards per file, a hard ceiling per PR | `PER_FILE_CAP = 3` in `src-tauri/src/coach.rs`, `OVERALL_CAP` in `src-tauri/src/lib.rs` |
| four tags | `CardTag` in `src/types.ts` |
| three providers | `PRODUCT.md`, Operating Context |
| Send to GitHub via `gh` (default) or the App | `src/github.ts`, `src-tauri/src/send.rs` |
| warm-up and drill over the built-in library | `src-tauri/src/lesson.rs`, `src-tauri/src/lesson/library.rs` |
| the example cards | code from `fixtures/coaching_demo.rs`; the questions are written for the page and labelled as an illustration |

`PRODUCT.md` lists what must not be invented: no users, testimonials, benchmarks, pricing or download. The source repo and the GitHub App are both private, so the calls to action go to [consensuslabs.net/#contact](https://consensuslabs.net/#contact).

## Motion

| Library | Version | Doing what |
|---|---|---|
| [GSAP](https://gsap.com) + ScrollTrigger + SplitText | 3.13.0 | reveals, masked line rises, the pinned session track, counters, the curtain |
| [Lenis](https://github.com/darkroomengineering/lenis) | 1.3.4 | smooth scroll, driven by `gsap.ticker` |
| [Vanta](https://github.com/tengbao/vanta) NET + three.js | 0.5.24 / r134 | the network field behind the ink panel, fetched only when the panel approaches |

The react-bits effects the Astro site uses (RotatingText, DecryptedText, Magnet, SpotlightCard, FlowingMenu) ship as React components, so `site.js` re-derives them by hand.

**Rules:** opacity and transform only; `prefers-reduced-motion` is a hard stop (no Lenis, curtain, pin or Vanta); the curtain is `display:none` until JS arms it, and storage access is wrapped because it can throw.

## Verify

```sh
python3 -m http.server 4321 --directory public &
node scripts/verify.mjs            # desktop, 1440x1000
node scripts/verify.mjs 390 844    # phone
node scripts/verify.mjs 375 812    # narrow phone
node scripts/verify.mjs 1440 900   # laptops: also 1280 800 and 1024 768
```

It renders the page with motion on and with reduced motion, and checks:

- **LANDMARK** — `#session` sits at the same document Y in both.
- **DELTA** — the two documents differ by exactly the pin distance `site.js` publishes as `window.__rcPin`, and by nothing else.
- **OVERFLOW**, **SETTLED** (nothing left hidden after a full scroll), **CLICK**, **MENU** (phone) and **ERRORS**.
- **REACH** — when the session track is not pinned (reduced motion, phones) it can still be scrolled sideways.
- **FOLD** — above 900px (two-column hero) the whole stage, its green plate included, is on screen without scrolling.
- **STEADY** — `#session` does not move while the hero phrase rotates (sampled for about 9 seconds).

Each check has been seen to fail: an injected `margin-top: 80px` on the hero fails LANDMARK and DELTA; the old clipped track failed REACH at 1440; the old rotator failed STEADY at 375 (a 19px jump); a 1440×620 viewport fails FOLD.

## Deploy

```sh
npx wrangler deploy
```

This publishes to the public site. Afterwards, check that `curl -s https://review.consensuslabs.net/github` still returns the GitHub App page.
