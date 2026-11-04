# SOV Experience Foundation Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or inline execution for the tightly coupled UI. The founder has approved the visual targets and implementation scope.

**Goal:** Isolated, beautiful /sov-preview with three skins, two layouts, reversible personalization and real device-only creation editing.
**Architecture:** A strict, versioned blueprint references registered surfaces/capabilities. Preferences and content are independent local records; AI proposals accept presentation fields only. Existing production shell bypasses only this new route. No server features or services.
**Tech Stack:** Existing Next/React/TypeScript, CSS scoped to .sov, node:test, browser verification.
**Spec:** docs/sov-experience-brief.md and founder-supplied Atelier/Backstage references.

## Global Constraints
No deployments, merges, migrations, auth replacement, LLM integration, or fabricated connected services. Separate development branch. Local storage clearly labeled. Preview/apply/undo/reset preserve content. Keyboard, mobile and reduced motion supported.

## Review Focus
Malformed or malicious presentation input cannot introduce authority or scripts. Storage failures must be visible without losing edits. Pending preview must not persist before Apply. Reset and undo must preserve creation text. Route isolation must not change existing route behavior.

## Tasks
- [ ] Model: tests first for strict blueprint validation, six combinations, independent content, capability truth, reversible reducer and untrusted AI proposals; implement lib/sov/experience.ts and tests/sov/experience.test.ts.
- [ ] Assets: generate original architecture and music-studio environments, no reference imagery embedded; save optimized assets and provenance under public/sov.
- [ ] UI: app/sov-preview/{page.tsx,experience.tsx,experience.css,icons.tsx}; independent local storage, editor, library/navigation, personalization panel preview/apply/undo/reset. Minimal preview-only shell and proxy bypasses.
- [ ] Verify: focused model tests, existing product route tests, typecheck/lint/build, desktop/mobile captures of all presets, interactions across six combinations, storage/errors/reload, keyboard and reduced motion. Review diff and commit without push.

## Founder correction — approved Home reference pack

The later explicit instruction supersedes the three concept directions: reconstruct `02_DESKTOP_HOME_REFERENCE.png` first, with four pictured theme and layout choices, then essential local interactions. Onboarding deferred. The implementation and screenshot review package are complete for founder review; visual approval is pending.
