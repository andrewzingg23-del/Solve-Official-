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
