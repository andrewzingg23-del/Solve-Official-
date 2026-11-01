# Public entrance audit: Members Only (PR #15) + venture doors (2026-10-31)

Founder ask (One Solve run): audit PR #15 and the venture landing templates; **preserve them as the foundation for a future reusable public project-entrance system connected to SOLVE Projects and Communities.** No duplicate auth, membership or AI infrastructure.

## What exists today (two public-entrance patterns)

### 1. Venture doors — data-driven, already reusable
- `app/ventures.ts` — `VENTURES` data (10 doors: Zest Solar, the insurance agency, Members Only, Zest AI, anthology, Zuber Pen, Solve, Sovereign Passport, …). Each is `{ slug, name, kicker, headline, thesis, tool?, proofs, goal?, cta, meta }`.
- `app/venture-template.tsx` — one `VenturePage` frame renders every door: hero, a working tool slot (`children`), proofs, goal, a single CTA, brand footer. On-brand (navy/cyan, Archivo), animated, phone-first.
- `app/<venture>/page.tsx` + `app/ventures/page.tsx` (index). Example working tool: `app/solar/` (3D roof, proposal).
- **This is already a reusable public project-entrance system in miniature** — add a row to `VENTURES`, drop in a tool, and a new door exists.

### 2. Members Only — bespoke premium gateway (PR #15, `feature/members-only-entry-20261026`)
- 4 files, +290 / -0: `app/members/page.tsx`, `app/members/members.module.css`, `app/product/shell.tsx`, `docs/MEMBERS-ONLY-FOUNDATION.md`.
- `app/product/shell.tsx` change is **one additive early-return** (`/members` → render children without the SOLVE workspace chrome), identical in shape to the existing `/studio`, `/map`, `/sov-id` guards. **Not a destructive collision.**
- The foundation doc is careful and correct on the exact rules the founder set: **reuses SOLVE identity (explicitly "do not introduce a second identity system")**; agency is a funding rail, not the brand; IG CTA (`@membersonly.os`) instead of a dead/insecure intake form; present vs future claims separated; SOV stays an internal primitive; no Meta Pixel before consent design; illustrative funnel labelled "not a forecast."

## Verdict
- **No duplication risk.** PR #15 deliberately rides SOLVE's existing account/World identity and does not add auth, membership or AI infra. It aligns with "do not create duplicate infrastructure."
- **Collision risk (plan's worry) is low.** The shell change is additive and conventional. The real note is that Step 6 (kid-simple home) and Step 12 (onboarding into Members Only) will touch the shell/home — whoever does those must preserve the `/members` early-return and wire the Members→onboarding bridge then.
- **Both are the foundation for one reusable public project-entrance system**, not two systems to keep apart.

## Preserve-and-converge plan (future, not Milestone 1)
A single **public entrance** concept: any SOLVE **Project or Community** can expose a public door.
1. Generalize `VENTURES` → a `PublicEntrance` descriptor sourced from a Project/Community (name, kicker, headline, thesis, proofs, goal, CTA, optional working tool/pack), rendered by `VenturePage`.
2. Offer two render tiers on the same data: **standard** (the venture frame) and **premium/editorial** (the Members Only treatment) — a style flag, not a second codebase.
3. The CTA bridges to SOLVE's existing login/profile and, when intake is ready, to a consented Community join (reuse `lib/community/` + `lib/world/collaboration.ts`) — never a new membership store.
4. Members Only becomes the first premium entrance built on this; the 10 venture doors become standard entrances. One system.

## Recommendation on PR #15 now
- **Keep it open; do not close it** — it's the design foundation and the editorial reference.
- **Do not merge it during Milestone 1.** It's a public-marketing surface (Milestone 2+, Step 12), and merging a minimal founding-page now adds an unfinished public feature ahead of the live-app work. Hold until the entrance consolidation so we ship one coherent system, not a bespoke page we rework later.
- When taken up: rebase on main, keep the additive shell guard, and build it through the generalized entrance above.

**No code changed by this audit. No auth/membership/AI infra added.**
