# SOLVE approved visual language — 2026-11-06

## Authority and intent
The founder-approved reference (the onboarding and three personalized desktop Spaces image from this conversation) is the target for the shared product shell and first-run experience. **SOLVE** is the product. **SOV ID** is the personal identity layer, not the title of the application.

## Invariants
- Foundation: near-black graphite background, charcoal frosted panels, subtle silver hairline edges and inner light; no full-bleed illustration or gratuitous purple/gold gradients on these product surfaces.
- Brand: one white ring + spaced SOLVE wordmark, identical on onboarding, mobile header, desktop sidebar, and minimal screens.
- Interaction: white pill primary actions, subdued glass secondary actions, restrained cool-blue only for selection/active steps/AI focus; green only for *verified* success. Never imply integration, AI task, payment or project success from decorative colors.
- Composition: left navigation for signed-in desktop Spaces, coherent mobile bottom navigation, compact cards and progressive disclosure. Onboarding owns a focused horizontal header with numbered steps.
- Individuality: personal topics, copy, content order and subtle accent can vary; shared dimensions, legibility, navigation and privacy rules cannot.
- Privacy: Private Space, public SOV Profile, app selection and connector authorization are distinct. Do not render mock activity as live data.
- Accessibility: readable contrast, keyboard focus, touch targets >=44px, no sideways overflow at 375px, reduced-motion support, semantic sections and visible states.

## References
Source image is the approved 1536×864 visual shared by the founder. It shows business/operator, gamer/creator and household as *one system with different personal content*. It is a visual specification, not proof of completed integrations or activity. Existing routes and kernel boundaries remain authoritative.

## Release gates
1. Navigate /onboarding through AI → context → build → space.
2. Guest interview/import/blank saves and reloads correctly.
3. Signed-in preferences and project readback never create false data.
4. AI personalization remains opt-in and raw private imports stay outside model prompts.
5. Desktop, tablet and narrow mobile layouts share tokens, navigation and accessibility.
6. Build, unit tests and privacy tests pass before publishing.
