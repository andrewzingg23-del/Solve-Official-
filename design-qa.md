# Approved SOV Home — visual reconstruction review

Engineering visual checks: passed for founder review.
Final design approval: PENDING FOUNDER REVIEW. This document does not approve the design on the founder's behalf.

## Comparison evidence
- Authority: docs/sov-reference/02_DESKTOP_HOME_REFERENCE.png (1672×546).
- Rendered production build: docs/sov-evidence/home-reference-viewport.jpg (1672×546, CSS viewport 1672×546).
- Direct side-by-side: docs/sov-evidence/home-side-by-side.jpg; approved reference left, rendered React implementation right.
- Normal desktop: home-desktop.jpg, 1440×900.
- Mobile: home-mobile.jpg, 390px viewport, full page.

## Iterations
1. Replaced the unrelated notebook/dashboard composition with the approved Home: full-bleed environment, dark rail, portrait greeting, glass AI bar, four illustrated spaces, Continue shelf and independent frosted panel.
2. Browser measurements found the right panel too tall and normal-flow toast/footer controls causing viewport overflow. Tightened vertical rhythm and anchored the controls inside the panel. Final matching viewport has no horizontal/vertical overflow.
3. Preserved the reference's framing while reducing background saturation, adding separate portrait/orb/space art, and correcting mobile dark-theme dialog contrast and failed-storage labels.

## Fidelity surfaces
- Typography: Arial/Helvetica fallbacks, editable HTML text. Greeting 32px, navigation 14px, primary space names 18px at the reference viewport. Exact source typeface is unavailable; rendering/weight remains slightly different.
- Layout: nav x46 width177; portrait x299/y41 width90; AI bar x411/y149 width622/height78; four spaces x283/y259 width870/height114; Continue x263/y383 width955; panel x1258/y16 width400/height515. Closely aligned to source composition.
- Color/material: dark translucent navigation, warm grey frosted AI bar and Continue shelf, light rose-grey customization glass, white cards/icons, blue selection treatment. Real backdrop blur, borders and shadows; no full-UI raster background.
- Imagery: independently generated environment, fictional portrait, transparent orb and individual space artwork. Scene, sunlight, portrait and artwork are deliberately recreated and not pixel-identical to source. Prompts/provenance under public/sov/*-assets.md and approved-environment.md.
- Copy: source titles/nav/sections preserved. 'Local example' replaces unsupported edit timestamps/progress. A small device-only / AI-unavailable disclosure and Apply/Undo/Reset controls are necessary truthful differences.

## Remaining visible discrepancies for founder review
- Recreated sunset is more saturated, with a somewhat different mountain/window/desk arrangement.
- Portrait, creative waves and card photography differ from source artwork.
- Font rendering, orb edge glow and some icon shapes differ slightly.
- Continue thumbnails use local artwork and honest example labels rather than the source's invented history.
- Mobile is an adaptation: two-column spaces, scrollable Continue list, bottom dark-glass navigation and modal customization.

No design-complete claim is made. No onboarding implementation, merge, push, migrations, live AI or production deployment.

## 03A refinement — 2026-11-04
The founder approved the overall direction and requested refinement, not redesign. Scoped material/scene refinements and a mobile scrollport clearance fix are verified. Updated normal-desktop and mobile proof is in docs/sov-evidence/refinement-03a. Five mobile sizes expose New above the dock; the architectural background retains interior details at 1440×900. Interaction source and card artwork are unchanged. New visual refinement remains available for founder review; no merge or deployment.
