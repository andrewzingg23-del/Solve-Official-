# Immersive creation implementation plan

Spec: docs/superpowers/specs/2026-10-08-immersive-creation.md

## Global constraints

Extend existing kernel, Worlds, connector and guest profile. No founder canon/directive, applied migration or production database changes. Branch codex/immersive-world-studio from current main; retain concurrent ARGUS work. Focused invariant tests before behavior, then full suite/build and actual browser checks before promotion.

### Task 1: Editable scenes and governed revisions

Bounded metre-based scene schema, primitive templates, semantic edits, quantities, exact-design change detector and actual Rapier physics. Append studio documents with explicit parents through kernel_api. Immutable creation events provide snapshots and actor provenance. Validate privacy, replay, authors, branches, raw entity update resistance and revocation.

Six local model/physics/kernel tests passed before the workspace disconnected. The recovered source and additional regression cases must pass CI.

### Task 2: Studio, identity and map

Same data drives Three.js, inputs, keyboard/touch projection, exports, material/build surfaces. Persist drafts and Undo. Shared revisions retain explicit base parents and incoming revision review. Extend existing MCP tools; prompt/review in-app AI proposals. Customizable private SOV ID modules; identity-first three-step onboarding. Flat authorized map behind SceneController with Natural Earth outlines.

### Task 3: Verify and deliver

Full suite/typecheck/lint/build plus browser workflow: editing/history, material/plan staleness, physics, reload/export, profile privacy, onboarding and no-WebGL views. One fresh final reviewer. Fix important findings, record actual evidence, deliver preview and PR.

## Execution rulings

- Current main supersedes the legacy trunk: canon and current app changes are on main.
- Explicit parented creation records avoid upsert's missing atomic expected-version guard. Incoming updates never silently replace the client's base.
- After the local environment disconnected, recovery and validation continue through connected GitHub and Vercel. CI/browser evidence replaces unavailable local gates.
- Domain CAD, specialist engineering and real-world provider execution remain adapters; primitive concepts do not claim those capabilities.

## Review focus

Authority bypasses, forged provenance, branch loss, persistence failures, arbitrary generated code, stale calculations, responsive/accessible renderer fallback.

## Final review rulings

All five Important findings were accepted and addressed: ancestry is stored atomically with a draft; private creations have distinct IDs and a reopening picker; proposals require an unchanged exact base; validated scene bytes are bounded below kernel attributes limits; accepted source round trips with formatted exports. Both Minor findings were addressed with a geometry preview and an in-memory identity fallback on storage failure. Unknown legacy ancestry requires loading/reviewing a shared revision before saving.

Reviewer exclusions were accepted only as explicit scope/evidence limits: ARGUS and other-builder files are preserved; production credentials, live multiuser actions and assistive-technology operation are not inferred from local tests. Engineering/CAD/real-world execution remains an adapter. Desktop/mobile browser verification is a required independent gate, not declined.

## Completion evidence

Tasks 1–3 are complete for this slice. Code checkpoint `d7ac9230cc5c0ed9f6ed0bb290b1eac6b598a4bc`: Build run `37831693148` passed 406/406 tests, TypeScript, lint (zero errors, eight warnings) and production build. Studio browser run `37831693140` passed actual desktop/phone/no-WebGL editing, persistence/history, independent creations, four exports, physics, identity privacy, onboarding and phone/desktop map zoom/frame. Seven browser screenshots are attached to that run. READY preview: https://solve-l1jctbfmb-sovigrn.vercel.app/. All five Important and both Minor final review findings are addressed; none are deferred. Current main's ARGUS and community AI work is preserved. No production merge, deployment, schema or data changes.

The five Important and two Minor findings are resolved; no additional reviewer re-reviewed the fixes. The remote branch retains current main and correct ancestry. The local source checkpoint is preserved. A reviewable PR is prepared under the founder's build request; integration and production publication remain separate decisions. Workspace interruptions moved the final documentation update to GitHub. All review resolutions, execution rulings, exact evidence and practical limits: `docs/handoff/2026-10-08-immersive-studio.md`. The delivery commit changes documentation only.
