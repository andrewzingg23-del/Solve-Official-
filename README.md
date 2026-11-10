# SOLVE

Five products on one trustworthy foundation: the **SOLVE Card** (your identity), **MySpace** (your
public Space), **Bench** (what you make, alone or together), **Control** (who and what can reach
you, and your data), and **My AI** (your companion, reached today through the apps you connect).
Home is the doorway.

Direction: [docs/direction/2026-11-10-consolidated-direction.md](docs/direction/2026-11-10-consolidated-direction.md).
Decisions: [DECISIONS.md](DECISIONS.md). Security guarantees and their tests: [SECURITY-INVARIANTS.md](SECURITY-INVARIANTS.md).
What works, and how it was verified: [docs/acceptance/STATUS.md](docs/acceptance/STATUS.md).

## How it's built

| Path | What it is |
|---|---|
| `supabase/migrations/` | The kernel: an append-only, hash-linked record of identity, things, relationships, authority, actions and evidence. Reached only through `kernel_api`. Never edit an applied migration; add a new one. |
| `lib/kernel/` | The typed client for `kernel_api`, and an embedded copy of the kernel for tests |
| `lib/product/` | The rules the screens rely on: the card, colours, the six-part record, photos, public pages, paths to other tools |
| `lib/world/` | Things and the people in them |
| `lib/bot/` | The connector that lets an AI app reach your SOLVE (`/mcp`), and your AI's memory |
| `app/` | The app (Next.js 16): Home, ID, Space, Bench, Control, a thing's page, public pages (`/p`, `/s`), invitations, confirmations |
| `proxy.ts` | Gives every visitor a guest identity, and retires old addresses |

Stack: Next.js 16, Supabase (Auth, Postgres, Storage), CSS Modules. Previews run against the staging
database; production is separate and changes only with the founder's approval.

## Checks

```
npm test                 # unit and kernel tests
npm run typecheck && npm run lint
npm run test:product     # the app in a browser, with no database
npm run test:browser     # the kernel tests in Chromium
npm run test:acceptance  # real people's journeys, in browsers, against staging
```
