# Review Coach — landing page

Marketing landing page for [Review Coach](https://github.com/RonanTalboom/review-coach), built from a Claude Design project (the "Industry" wireframe design system). Static HTML/CSS/JS — no build step.

## Structure

- `public/index.html` — the page
- `public/ds-base.js` — loads the design system's stylesheet + bundle at runtime
- `public/image-slot.js` — the `<image-slot>` custom element (drag-and-drop image placeholder; degrades to a static placeholder outside the Claude Design canvas)
- `public/_ds/industry-f631574a-b200-4ece-ad8f-089971408774/` — the "Industry" design system's tokens (`styles.css`) and component bundle (`_ds_bundle.js`)

## Develop

```sh
npx serve public
```

## Deploy

```sh
npx wrangler deploy
```

Deploys to Cloudflare Workers Static Assets.
