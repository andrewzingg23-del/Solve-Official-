# Immersive creation studio handoff

Date: 2026-10-08. Branch: `codex/immersive-world-studio`.
Code checkpoint: `d7ac9230cc5c0ed9f6ed0bb290b1eac6b598a4bc`.
Preview: https://solve-l1jctbfmb-sovigrn.vercel.app/

## Try the app

1. Choose **New creation**: a living space, bicycle, everyday object, or blank scene.
2. Select an object and edit its dimensions, position, rotation or material. Orbit it or switch to Plan/Front. The projection works without WebGL.
3. Check **Materials** for quantities and editable planning rates. Complete a **Build path** step, then change the design: dependent completed steps require review.
4. Run a drop experiment, scrub the physics timeline and export source JSON, GLB, STL or an SVG concept plan. Reopen creations with the picker; recent Undo/Redo survives reload.
5. Open **SOV ID** or **Create SOV ID**. Customize a private identity draft and add modules. Each module stays out of the exported card until explicitly included.
6. Open **Map**, complete its local identity setup, zoom/frame and select places. This browser sandbox is not a public live friend network.

## Implemented

- Responsive creation workspace: one validated scene model behind Three.js, interactive projection, inspector, quantities, exports and physics.
- Private creations with distinct IDs, a reopening picker, recoverable storage failures and eight persisted Undo/Redo snapshots.
- World revisions through existing kernel authority: immutable snapshots, canonical actors, explicit parents and visible competing heads.
- Owned-assistant MCP tools `read_studios` and `save_studio`. The bot reads with its own actor; saving requires connection write mode and a World Add grant.
- Explicitly consented AI scene proposals. A person previews proposed geometry; exact-base checks prevent overwriting subsequent edits.
- Customizable private SOV ID modules, identity-first onboarding and a flat authorized map usable without WebGL.

## Verification

All gates passed on the code checkpoint above:

- [Build run 37831693148](https://github.com/andrewzingg23-del/Solve-Official-/actions/runs/37831693148): 406 tests passed, zero failed; TypeScript and production build passed. Lint passed with zero errors and eight warnings.
- [Studio browser run 37831693140](https://github.com/andrewzingg23-del/Solve-Official-/actions/runs/37831693140): desktop/phone editing, persistence/history, multiple creations, physics, all four exports, identity privacy, onboarding, no-WebGL studio and phone/desktop map zoom/frame passed.
- [Seven screenshots](https://github.com/andrewzingg23-del/Solve-Official-/actions/runs/37831693140/artifacts/11573209160), retained by CI for seven days.
- Deployed preview READY and directly inspected. Local source was Git-blob verified and checkpointed.

A real phone map overlap was fixed before the final browser run. The delivery commit changes documentation only and preserves the verified runtime tree.

## Final review resolutions

One fresh final reviewer produced five Important findings and two Minor findings. All were accepted and fixed:

| Finding | Resolution |
|---|---|
| Reload changed a shared draft's ancestry | Persist document and exact parents together. Unknown legacy ancestry requires reviewing a shared revision before saving. |
| New creation overwrote the only private draft | Distinct creation IDs, archived originals and a reopening picker. |
| AI overwrote intervening edits | Bind proposals to the exact base; reject application after any document change. |
| Accepted scenes exceeded kernel attributes | Whole-scene 10 KB UTF-8 budget and bounded numeric precision; verify the actual existing kernel constraint. |
| Saved/exported scenes might not reopen | Align validation, formatted exports and import limits; keep unreadable originals for recovery. |
| Proposal review lacked geometry | Preview the scene and object dimensions before Apply. |
| Failed identity storage exported old values | Retain attempted customization in memory and export the current draft. |

No Minor findings are deferred. The reviewer was not asked to re-review the fixes. Independent invariant and browser checks provide the recorded verification.

## Execution rulings and practical limits

- Current `main` is the base because it contains the approved canon and current app. Concurrent ARGUS and community AI changes are preserved.
- Append-only parented revisions preserve concurrent work because entity upsert lacks an atomic expected-version guard.
- Local runtime interruptions moved broad verification to GitHub Actions and the preview. Source recovery used Git blob verification; a later workspace documentation update stalled, so delivery records were completed through GitHub.
- A reviewable pull request is prepared under the founder's build request. Integration and production publication remain separate decisions; no branch/worktree is discarded.
- Geometry is an editable primitive concept. The isolated rigid-body drop does not validate joints, strength, deformation or structural approval.
- Material prices are editable assumptions. No live supplier quote, surveyed lot, permit approval, financing decision or construction-ready blueprint is claimed.
- Specialist CAD, engineering, deep avatar creation and real-world provider execution remain explicit adapters. See `docs/research/studio-adapters.md`.
- Live AI-provider round trips, authenticated multiuser browser collaboration and external agent sessions were not independently verified. Shared saving uses existing authorized accounts; the private guest draft is not a registered identity.
- Keyboard/direct-input fallback is included; full assistive-technology certification is not claimed.
- Founder canon/directives, applied migrations, production data and production deployment were not changed.

## Source

Use Node 22, `npm ci`, `npm run build` and `npm run start`. Standard gates are `npm test`, `npm run typecheck` and `npm run lint`. `npm run test:studio` starts the production app on port 3004; install the official Chromium build with `npx playwright-core@1.56.1 install chromium`.

The remote branch has correct repository ancestry. The recovered local checkout is a source checkpoint; do not force-push its snapshot history over the remote branch.
