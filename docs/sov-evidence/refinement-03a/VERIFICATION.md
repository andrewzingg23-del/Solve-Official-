# SOV 03A — refinement verification

Approved composition, card artwork and existing interaction code preserved. Source changes are limited to scoped CSS, the preview page's viewport-fit metadata, and one original scenic WebP plus provenance.

## Mobile regression
Before: at 375×812 the main content extended to y900 while the fixed dock began at y735; Continue and New passed behind it.
After: an independent content scrollport ends at y723, 12px above the dock at y735. Dynamic viewport height and safe-area insets determine clearance; focused controls have scroll margins. The inherited archived-app page-entry transform is disabled on this scrollport.

Verified with keyboard focus/scrolling at 375×812, 390×844, 375×600, 320×568, and 375×480. Every size exposed the complete New action above the dock without horizontal overflow. Measurements: mobile-clearance.json. Actual device safe-area values are handled with env(); physical notched-device testing was not performed.

## Visual proof
- desktop-1440x900.jpg: final local production build, dimensions checked with Sharp.
- mobile-375x812-top.jpg and mobile-375x812-continue.jpg: initial and scrolled states.
- mobile-clearance-comparison.jpg: both genuine 375×812 captures together.
- mobile-375x600.jpg: shorter screen with unobstructed New.
- reference-side-by-side.jpg: reference left (panoramic aspect preserved), normal desktop right.

The new 1800×1125 scenic WebP is 235,860 bytes. It frames architecture for a normal desktop ratio, keeping ceiling, black mullions, vegetation, foreground desk/books/cup, oak floor, and a chair in view. Extra-wide screens retain the earlier panoramic crop. No full UI screenshot is embedded in the product.

Glass opacity, blur, edge highlights and shadows are refined without changing regions or card artwork. Browser comparison covered typography, spacing, color, image quality, and truthful capability labels. Recreated photography remains distinct from the reference artwork.

## Checks
- 15/15 affected SOV configuration and existing route-policy tests passed.
- Typecheck passed.
- ESLint for app/sov-preview passed without warnings/errors.
- Existing production build passed; no deployment performed.
- Short-screen Preview, Cancel, Apply, Undo, Reset, Escape/focus return, and New action passed in browser.
- viewport-fit=cover confirmed in rendered metadata.

No authentication, database, AI integration, World architecture, production routing, application interaction logic, or creation data changed. No merge or deployment.
