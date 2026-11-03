# Safe draft preview implementation plan

Goal: preview generated and manually revised website documents without loading remote or application resources.

Founder authorization: master directive §§12, 38 and XIV authorizes a small implementation, tests and browser inspection. Preserve existing versioned CreativeArtifact storage and script-free opaque-origin sandbox.

Approach: add a render-time document helper with a trusted leading CSP denying resources by default, allowing inline CSS and embedded data images. Apply it in DraftPreview, including reopened/manual revisions. Keep stored source unchanged. Regex removal alone cannot enforce browser resource loading; application-wide CSP would unnecessarily change unrelated surfaces.

- [x] Reproduce external image/CSS loading with the real DraftPreview component in Chromium; record failing regression.
- [x] Add lib/product/draft-preview.ts: buildDraftPreviewDocument(html: string): string, inject trusted CSP before any untrusted markup, retain defense-in-depth stripping.
- [x] Wire app/world/[worldId]/draft-preview.tsx to the helper; preserve sandbox and referrer policy.
- [x] Run scripts/verify-draft-preview.mts on malicious fixtures, inline styling, data images, revised source and desktop/mobile widths. Assert zero server requests from the frame.
- [x] Run focused tests, typecheck, lint and build. Record limitations and source reconciliation in the existing handoff convention. Commit and push an isolated review branch; no production promotion.

Review focus: requests before head, CSS imports/URLs, relative credential-bearing resources, later permissive CSP, and manual revisions must meet the same boundary. Navigation links remain sandbox-limited; this slice makes no claim to validate generated page content or implement the entire creation journey.
