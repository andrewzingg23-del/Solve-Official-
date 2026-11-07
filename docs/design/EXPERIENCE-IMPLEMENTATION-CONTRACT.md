# SOLVE — Visual + Technical Experience Contract

**Version:** 2026-11-07 founder-approved direction; proposed under PR #68. **Scope:** every new or edited visible SOLVE feature, across desktop, mobile, SOV ID, personal Spaces, projects, communities, AI and integrations.

This file extends, **does not supersede**, `docs/design/approved-visual-language-20261106.md`, `docs/brand/BRAND.md`, `VISION-CANON.md`, and `SECURITY-INVARIANTS.md`. The founder approved Nov 7 visual concepts of a cinematic, calm, personalized Space with scenic architecture and dark glass UI; those concept images are a **visual intention**, not evidence of built features, verified identities, payment support, actual construction progress, hardware, or connected providers. No unapproved design reset.

## One rule for every implementation

**A feature is only complete when its visual state, actual behavior, authorization and durable result all agree.** Every assigned task and PR MUST specify both:

1. **Visual language:** where it appears, hierarchy, tokens, typography, responsive composition, personalization boundary, visible loading/empty/error/disabled/confirmed states, accessibility and visual acceptance.
2. **Technical mechanics:** actor, context, source of truth, API/kernel/provider operation, authority, privacy, persistence, real evidence, failure/retry/revoke/undo and executable acceptance.

Never ship an attractive control whose backend is imaginary. Never ship a functioning kernel capability with a confusing, disconnected, or privacy-ambiguous interface. No decorative “verified” badges, generated progress %, false active agents, pretend project completions or payment functionality.

## Shared design anatomy

**SOLVE product chrome:** near-black graphite `#080a11` and `#0d111b`, charcoal glass from `--solve-v-glass`, silver hairlines `--solve-v-line`, clear white type, cool-blue only for focused/actionable selection, green only after a confirmed result. Reuse `app/product/approved-language.css` and `SolveBrand`; don't introduce a separate logo, font, nav, color system or generic neon dashboard.

**Scenic personal environment:** an optional and bounded visual background in a private Space hero, inspired by warm mountain/architecture scenes in Nov 7 approved concepts. It supports an existing readable structure; the person can eventually replace it. The scenery **must not** imply that a pictured house, property, business, or progress figure belongs to the user. Never bury actual controls in scenery. Respect reduced motion and fallback without assets.

**SOV ID surfaces:** calm physical-object identity in the established card CSS, light/secondary options and owner-customized modes as capabilities become real. The public card can look different from a private Space but shares the canonical SOLVE master brand. `sov.` is an identity/card imprint, not a replacement product logo. The card and linked URL are pointers to publication, not proof of government identity or a payment credential.

**Expression:** strong default; controls can change mood, density, arrangement, imagery and personal content within accessibility and privacy boundaries. All visual personalization is local until the user commits; an AI-generated suggestion is a proposal, not a write. The person can undo a saved reversible change. Theme changes never change permission grants, publication state or project ownership.

**Touch and cognition:** at least 44px targets, readable contrast, no horizontal overflow at 375px, native focus indicators, honest disabled controls, distinct copy for draft vs saved, mobile bottom nav and desktop left rail for signed-in Space, no mandatory app installation for a published card, no unnecessary account creation for ordinary public reading.

## Each surface: visual and operational coupling

| Route / experience | Visual target | Technical source and authority | User acceptance |
| --- | --- | --- | --- |
| Public entry `/` on consumer feature branch | restrained card-first landing, clear single action and physical-object story | public copy + safe navigation only; no private user data or fake card activation | unfamiliar guest understands value, can navigate to digital card; no blocked or inert CTA |
| Personal SOV editor `/card` / `/sov-id` | two-sided card, default/secondary/custom slots, explicit publish preview | actor-owned profile; server-controlled publication and persistent public ID | change appearance, reload, choose published fields; failure visible and non-owner denied |
| Public card `/id/[publicId]` | stand-alone mobile card, flip/expand, contact/save/connect/explore; SOLVE header + SOV card mark | public projection through server SELECT grants and RLS; private Home/AI/messages excluded | true signed-out visitor opens published identity, saves owner-approved vCard, stale/revoked card stops displaying |
| Private Space `/space` | scenic hero within graphite shell, existing real projects, understandable AI optionality, personalized interior | guest preferences explicitly device-local; signed-in choices persisted through existing account actions; actual Worlds through kernel | owner changes supported visual setting, sees preview, saves, reloads; no fabricated project numbers; failed save reported |
| Projects and World Rooms `/projects` / `/world/.../room` | editable working surface, tasks, people, decisions and supporting artifacts, compact readable states | durable World, membership, artifacts and messages through kernel-gated APIs | create/reopen project, invite authorized person, deny unauthorized mutation, trace change and undo if supported |
| Your AI `/bot` | identifiable optional assistant, context sources and pending approvals distinct | authenticated bot actor, scoped grants, replaceable providers, evidence | AI can suggest freely, but cannot claim real external completion or gain permissions by conversation |
| Communities `/communities` | invitation, people, rooms and participation with clear role labels | kernel-owned World membership, scoped grants, minors/household boundaries | owner invites; member sees only scope; revoke access stops read/write |
| Connected apps `/apps` or setup | optional catalog, clear disconnected/connecting/connected/failed states | authorized per-provider OAuth/API/MCP token grants and revocation | disconnected ≠ connected; no claimed action until provider confirmation |
| Physical card / payments (later) | premium manufactured card, NFC/QR share and recovery UI | stable server-bound URL; hardware validation; approved issuer/payment routes only if separately implemented | actual device tap and revocation verified; no bank, NFC-payment or certification claims until real |

Do not replace a route just to match imagery; first audit current functionality, file ownership, data models and pending PRs.

## Required two-sided work contract (paste into every code task and PR)

```text
HUMAN OUTCOME:
CURRENT EVIDENCE: URL, exact SHA, screenshots, real failure
VISUAL:
  Product surface and user's first 5 seconds:
  Approved design refs/tokens and visual hierarchy:
  Desktop / 390px / 375px; touch, keyboard and reduced motion:
  Loading / empty / preview / busy / success / failure / revoke states:
  Personalization and clear boundary with brand / privacy:
MECHANICS:
  Actor / identity / World scope / exact capability:
  Source of truth (kernel / publication projection / device-local only):
  Read, proposed change, authorization, commit, persistence and verification:
  Error / denied / retry / idempotency / recovery / revocation:
  Existing code reused; non-goals and prohibited shortcuts:
PROOF:
  Positive path + unauthorized/empty/error/reload case:
  Browser or real-device observations and exact checks:
  Diff/commit/PR links and independent review:
LEARNING:
  Reusable UI pattern + regression guard + next dependency:
```

An agent must fill **both halves** before coding. If the UI is pictured but not yet operable, label it **concept**; if an API is implemented but not visitor-tested, label it **unverified**. Brand or feature acceptance is not derived from a green build alone.

## Implementation sequencing

1. **P0:** secure, functional public SOV card; get true-anon read/revocation tests and visitor device proof. Work with Claude #65, Muse #66 and PRs #64/#70, avoid duplicate migration or component edits.
2. **P1:** make private `/space` visually consistent with approved Nov 7 scenes using the existing appearance and account state; preserve existing UI handlers. Restrained scenic hero is a presentation layer, never project evidence.
3. **P2:** create/reopen one kernel-backed project from a person's Space; shared invite, clear grants and successful repeat readback on mobile and desktop.
4. **P3:** authorized AI appearance/action suggestions, traceable receipts and undo; finally replaceable provider adapters with actual test responses.

Claude builds mechanics with tests; Muse reviews genuine first-contact experience and visual QA; ChatGPT audits integration, route truth and non-overlapping PRs. Respect existing claims and only one owner for SQL/permission or the same UI file.

## Gate checklist for review

- [ ] First-use value is intelligible with no SOLVE vocabulary and AI optional.
- [ ] Approved look and stable master brand, with meaningful owner freedom.
- [ ] Each visible control has a supported effect or an explicit unavailable state.
- [ ] Personalization preview/commit are distinguishable; real data survives reload.
- [ ] Relevant security/ownership tests include forbidden and revoked cases.
- [ ] Loading, no data, offline/provider failure, denied, retry and success are truthful.
- [ ] 375/390px and 1440px evidence; keyboard/focus/contrast/reduced-motion.
- [ ] Code checks, preview, independent QA and **unverified** items are stated separately.
- [ ] No production promotion, schema mutation, money or hardware claims without approval and evidence.

**One rule to remember:** the exterior is how a human understands and controls the system. The interior is how the system proves that their choice became reality. They must be designed and verified together.
