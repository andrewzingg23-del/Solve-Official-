# CODEX TASK 03 — BUILD THE SOV EXPERIENCE FOUNDATION

## Mission

Implement the first working version of the SOV universal experience system.

**The product vision and visual direction are already approved. Do not independently redesign the product or substitute a generic dashboard.**

SOV is the personal digital environment from which users control identity, AI, resources, connections, creations, and Worlds.

The interface is fully adaptable. Its underlying ownership and permissions remain stable.

## Approved visual references

Use the two recent SOV concept images:

1. **Atelier:** Refined architectural environment, warm cinematic lighting, carefully integrated UI and personalized Home.
2. **Backstage:** Underground musician's environment, dark violet lighting, expressive identity, studio surfaces and creative tools.

These demonstrate two different users' experiences of the same product.

Also create **SOV Standard**: a neutral, extremely polished, light/dark-compatible starting experience.

If reference images are attached, use them for visual fidelity. Do not assume their depicted content is functional.

## Engineering boundary

Use the existing project tooling if convenient, but build the new interface as an isolated experience.

Suggested development route: `/sov-preview`.

Do not import old product UI components merely to preserve their appearance.

Do not modify production routes, replace authentication, migrate databases, merge branches, or deploy.

Work in a separate development branch.

## Implement the following

### A. One experience blueprint

Create a typed, versioned experience configuration containing:

- Experience identifier and version.
- Skin tokens and optional visual assets.
- Layout selection and responsive regions.
- Registered surface definitions.
- Declared interactions.
- Required capabilities and their availability states.

Separate this configuration from user identity, World content, memory, and permissions.

### B. Three complete visual presets

**Standard:** Neutral, polished, restrained, accessible.

**Atelier:** Architectural, warm, immersive and editorial.

**Backstage:** Music-focused, expressive, energetic and studio-oriented.

Do not implement the second and third presets as merely different wallpapers.

Layouts, typography, navigation and presentation may differ, but essential controls remain available.

### C. Two working layouts

- **Simple:** Familiar personal Home with a clear primary focus.
- **Studio:** Creation-first environment with a larger workspace.

Users can independently switch skins and layouts.

The active choices must persist across page refreshes in the prototype.

### D. Shared data

Demonstrate all experiences using one common user and World data model.

Switching skins or layouts must not delete, duplicate, or change underlying content.

Include one real, editable example creation that persists locally.

Clearly label device-only storage. Do not imply cloud persistence, server-backed identity, or live collaboration when absent.

### E. Experience controls

Implement a **Make it yours** panel allowing the user to:

- Choose a skin.
- Choose a layout.
- Preview changes.
- Apply changes.
- Undo the last change.
- Reset to Standard without deleting creations.

The design must function with keyboard, touch and mouse.

Support reduced motion, responsive layouts and readable text contrast.

### F. Future AI personalization boundary

Define a clean interface by which a personal AI could propose changes to an experience blueprint.

Do not implement an LLM integration or conversation-history importer in this task.

AI-proposed changes must eventually pass validation, appear in a preview, require approval, and remain reversible.

AI must not be able to modify grants, permissions or secrets through the experience configuration.

### G. Visual quality

Match the polish of the approved reference images.

Avoid default component-library aesthetics, generic SaaS dashboards, empty placeholder cards and excessive decorative chrome.

Use appropriate, permitted visual assets. Do not embed copyrighted reference imagery without authorization.

The visual experience must be compelling at desktop and mobile sizes.

## Acceptance tests

Verify that:

1. Standard, Atelier and Backstage render distinctly.
2. Simple and Studio layouts work independently from skin selection.
3. Content persists when changing skins and layouts.
4. A locally created item remains after refreshing.
5. Reset changes presentation but preserves content.
6. Preview and undo behave correctly.
7. An unavailable integration cannot appear connected or active.
8. Keyboard, mobile and reduced-motion behavior are usable.
9. Existing application routes and tests remain unaffected.

## Completion evidence

Return:

- A concise implementation summary.
- Changed files.
- Tests and build results.
- Screenshots of all three skins, including mobile.
- The development branch and commit.
- Any genuine technical blocker.

Do not merge or deploy.

**Stop after this working experience foundation is verified.**

Do not begin identity, wallet, live AI, external integrations or full World orchestration yet.

The founder and Mission Control will review the result before authorizing the next engineering chunk.

## Guiding rule

**One trusted SOV. Unlimited possibilities for personal expression.**

The user owns their digital life. The experience is how they choose to live and work within it.