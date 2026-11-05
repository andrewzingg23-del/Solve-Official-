# SOV Home — founder review package

Visual approval is pending. The reference is authoritative; this is a working reconstruction for review, not a declaration that the design is approved.

## Open locally

Project: `/Users/andrewz/Documents/ChatGPT/SOLVE/Solve-Official-`

The verified local build is left running at http://localhost:3103/sov-preview.

To restart:

```sh
cd /Users/andrewz/Documents/ChatGPT/SOLVE/Solve-Official-
npm ci
npm run build
npm run start -- --port 3103
```

Development without a production build: `npm run dev -- --port 3102`, then `/sov-preview`.

Port 3100 contains earlier prototype test data. Port 3103 is the final Home review origin; no data was deleted. Browser storage is origin-specific, device-only, and not backed up.

## Screenshots

- home-side-by-side.jpg: approved reference left, rendered implementation right, each 1672×546.
- home-reference-viewport.jpg: rendered Home at matching proportions.
- home-desktop.jpg: normal 1440×900 desktop.
- home-mobile.jpg: 390px mobile viewport, full-page capture.
- home-mobile-customization.jpg: mobile customization material/accessibility evidence.

Screenshots show the initial local examples before interaction tests. They are native browser captures, not a screenshot embedded into the product. All labels, controls, panels, cards and editor content are React/HTML/CSS. Only scenery, portrait, orb and individual artwork are raster assets.

## Validation

Full suite: 505 tests, 504 passed, 1 skipped, 0 failed. Full lint: 0 errors and 9 existing warnings outside the preview. Typecheck and local production build passed. Focused SOV + existing route-policy tests: 15/15 passed.

See INTERACTIONS.md and home-interaction-combinations.json for genuinely exercised behavior. No cross-browser or assistive-technology certification is claimed.

## Review differences

The individual scenery, avatar, orb, theme thumbnails and space illustrations were recreated; their details are not pixel-identical. Type rendering and some icons differ. The source's invented timestamps/progress and notification dot are replaced with honest local-example/unavailable states. Apply/Undo/Reset and a small device-only disclosure are present. Mobile intentionally adapts the composition.

No onboarding, live AI, auth replacement, migrations, push, merge or production deployment.
