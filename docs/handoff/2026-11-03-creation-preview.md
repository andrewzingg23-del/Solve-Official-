# Creation preview checkpoint — 2026-11-03

This is a source-backed continuation reference, not a replacement for founder canon. Read with DIRECTIVES.md, DECISIONS.md and BUILD-STREAM.md.

## Founder intent and reconciliation

The current founder master directive prioritizes “Enter → Describe → Create → Preview → Revise → Save → Reopen” and requires preserving human authority and existing kernel contracts. It explicitly defers speculative swarms, public feeds, paid activation and production release without authorization. This slice advances safe Preview using the existing CreativeArtifact/versioning path.

Older documents center community/security and monetary infrastructure. The current directive centers dependable personal creation; those older features remain preserved and gated, not extended in this change. AGENTS.md still names an older trunk, but DECISIONS.md's October 31 decision names main; remote main was checked at 95a32e3b1f215fa0fded29bf6e62a223b9f41af1.

## Verified repository facts

- GitHub PR #38 (`codex/app-usefulness`, 62bab77) is open against main.
- PR #39 (`claude/first-draft`, 2f6ae0d) is open against #38's branch and adds first-draft generation, recoverable failure handling and versioned artifacts. This change stacks directly on #39; merging it alone does not put the full flow on main.
- A separate local `codex/creation-reliability` checkout has uncommitted provider/action/validation tests and implementation. Those files were neither copied nor modified. Reconcile that work before combining branches.
- DraftPreview previously used raw `srcDoc` with an empty sandbox. Chromium reproduced five resource requests: CSS import, CSS background, absolute/relative images and an external tracker. Test traffic was intercepted locally, never sent to that external domain.
- This slice adds a trusted leading resource CSP at render time and retains the opaque-origin script-free sandbox. Inline CSS and embedded data images still work; remote resources are intentionally unavailable. Stored artifact source is unchanged. Manual revisions and reopened source pass through the same rendering boundary.

## Architectural invariants

No new domain model, no database or migration change, no grant change, no paid model activation. Regex filtering is defense-in-depth and must not be reused as a standalone sanitizer. Only the sandbox plus trusted leading CSP is the supported rendering path. Source text is never promoted to privileged application code.

## Verification

`scripts/verify-draft-preview.mts` renders the production React component in Chromium, with hostile input and desktop/phone viewports. It checks resource requests, styled content, embedded image loading, scripts, forms, top navigation and revised documents with resources before html. It first failed against the unchanged component and passed after the fix. This is a component browser fixture, not a deployed end-to-end creation session; expansion/hydration and live provider reliability are not claimed by this check.

Full local checks and exact commit: see the final BUILD-STREAM entry and branch history. The browser regression is an explicit manual command (not part of npm test): `node --import tsx scripts/verify-draft-preview.mts`; set CHROMIUM_PATH where needed.

## Open issues and next complete slice

Generation reliability remains unresolved: prior branch notes report 2/3 single-attempt successes, not fresh evidence from this session. No model call or model charge occurred in this slice. Reconcile the uncommitted reliability changes, then re-run the existing verify-draft-journey harness on an authorized staging preview: independent attempts, revisions, save/reopen and a second account's isolation. Paid activation still needs explicit authorization.

Founder Studio remains Observe/Prepare based on the existing PR #38 implementation and GitHub records. An open PR is verified historical/source state, not proof of a worker running now. No external worker was dispatched; no live presence is claimed. PRs #33/#34/#36/#37 remain parallel work, not dependencies of this preview slice.

This patch blocks subresource loading from supplied source, not all possible navigation within the frame. The existing sandbox prevents top navigation, forms and scripts; ordinary links can navigate their own sandboxed frame. Generated content is a draft, not a validated integration or engineering result. Cross-browser verification beyond local Chromium and deployed end-to-end verification remain outstanding. No production promotion is authorized by this checkpoint.
