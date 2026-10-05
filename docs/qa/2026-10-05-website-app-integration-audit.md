# Website → Solve app integration audit

**Date:** 2026-10-05  
**Builder:** Manus  
**Branch:** `manus/website-integration-audit`  
**Base:** `claude/keen-cerf-tpd7io` at `cbaed683`

## Executive finding

The public website created in the Manus-managed Webdev project is **not integrated with the Solve application repository**. It is a separate static Vite site with its own checkpoint (`1208a9b`) and preview. It does not read or write Solve identities, Worlds, bots, kernel events, Supabase, staging, or Vercel.

This is why the founder could not see a Manus branch, PR, staging migration, or Vercel deployment from that work. The website checkpoint lives in the managed Webdev remote, not in `andrewzingg23-del/Solve-Official-`.

## Repository evidence

The connected GitHub repository has two different layers:

| Layer | Current location | Evidence |
|---|---|---|
| Founder canon | `main` | `main` currently has five documentation blobs and head `33f2a75`. |
| Real app | `claude/keen-cerf-tpd7io` | Next.js 16, Supabase, Cesium, kernel client, bot connector, Worlds, tests; head `cbaed683`. |
| Codex work | `codex/development-memory-v1`, `codex/world-live-collaboration`, and other branches | Existing unmerged work, with PRs #1 and #2 targeting the Claude app branch. |
| Manus website | Separate Webdev-managed project | Preview origin is managed outside the GitHub repository; no `manus/*` branch existed before this audit. |

The current application branch has the real entry point in `app/page.tsx`:

- signed-in people redirect to `/worlds`;
- signed-out visitors enter the existing `WorldShell` / Arcadia experience.

The current World layer is already real product code, not a landing-page placeholder:

- `app/world/shell.tsx` owns Earth, Horizon, lenses, onboarding, and the sandbox boot;
- `app/world/[worldId]/page.tsx` owns private World authoring, artifacts, routes, proof saves, and History;
- `lib/kernel/` and Supabase own identity-gated state and provenance.

## What the public site currently does

The site is a narrative and visual prototype. Its globe, Build Room cards, room status, proof card, and “Draft my room” form are intentionally local browser interactions. They do not represent live public activity or real World records.

The website therefore must not be presented as an authenticated product surface until its data and action boundaries are connected.

## Safe integration map

| Website surface | Real app destination | Integration rule |
|---|---|---|
| `Start a room` | `/worlds` or the existing World creation/onboarding path | Must use the real signed-in identity and real World creation. Never create a second room store in the website. |
| `See inside a room` | `/world/[worldId]` | Only show a real World when its access policy permits it. Public previews need an explicit public projection, not a direct private query. |
| Globe / World layer | Existing `Earth` and `WorldShell` | Reuse the existing scene and spatial model when bringing the experience into the app. Do not create a parallel globe data model. |
| Build Room examples | Public-safe projections of World/artifact records | Replace static room cards only after a public visibility contract exists. In Practice/demo mode, label data as simulated. |
| “Draft my room” | Existing intent/onboarding/World creation flow | Convert the sentence into a real proposal only after authentication, scope, idempotency, and approval behavior are defined. |
| Trust chain | Kernel event, grant, evidence, and History surfaces | Link to real provenance. Do not claim “verified” for a local UI state. |
| Bot/agent presence | Existing `/bot` and MCP connector | Use the bot identity and grants already owned by the app. Never create website-only bot identities. |

## What should not be done

1. Do not replace `app/page.tsx` with the marketing website. The current root route is the World entrance and is already part of the product’s signed-out and signed-in flow.
2. Do not duplicate Supabase tables, SOV IDs, Worlds, rooms, bot records, grants, or kernel events in the website project.
3. Do not point the website at private staging tables or expose service keys in browser code.
4. Do not label static room examples as live communities, verified outcomes, or public activity.
5. Do not run the pending staging SQL or change production/Vercel configuration as part of visual integration.

## Smallest safe next step

Add a dedicated public route in the real app, such as `/about` or `/start`, that reuses the existing `solve` layout and brand tokens, contains the product narrative, and links into the real `/worlds` flow. This can be a docs/UI-only PR with no migration. It should be additive and should not change the existing `/` World entrance.

After that route is reviewed, the next slice can add a read-only public projection for one explicitly public World or artifact. Only then should the marketing globe or room cards consume live data.

## Current blocker

The real staging golden-path walkthrough still requires a permitted test account and confirmation that the branch-specific Auth redirects work. This audit did not sign in, touch Supabase, run migrations, or publish anything.

## Checks

This is a documentation-only audit. No application files, database migrations, Vercel variables, or production services were changed. No runtime claim is made from this document.
