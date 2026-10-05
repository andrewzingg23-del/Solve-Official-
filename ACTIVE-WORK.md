# ACTIVE-WORK

One writer per architectural surface. Update this file when work starts, changes owner or finishes.

## Now (read first)

Updated 2026-10-05 by Claude. The founder overrides anything here.

**The priority: solve is built for the founder first** (`docs/plans/2026-10-05-founder-first.md`). The first user is the founder; the first project is building solve with its AI builders. Each slice should solve a problem the founder actually has. Name it in your stream entry.

**Blocking the founder's first real use**

| Blocker | Who | State |
|---|---|---|
| Three migrations on solve-staging, in order: `supabase/migrations/20261004040000_erasable_content.sql` (v5), `20261004040100_bot_presence.sql`, `20261004040200_world_live_collaboration.sql` | Founder: paste `scripts/staging/2026-10-05-founder-first.sql` (all three in one transaction, with a check at the end) into the solve-staging SQL editor. Claude's tool prompt timed out a fourth time on 2026-10-05. | Open |
| Sign-in by email link on the staging preview (Auth redirect URLs) | Founder | Never tried |
| Connecting the builders to the founder's bot (MCP over HTTP with OAuth) | Manus to research; founder approves | Not started |

**Branches.** Merged on 2026-10-05 (founder: "merge"): `codex/gateway-oidc-fallback`, `codex/world-live-collaboration` and `codex/need-to-route-network-state-spec` (without its canon section). Full suite 240/240, lint and build ok. Still open: the canon section and the Idea Graph.

**Unmerged work: merge or close.** The trunk is `claude/keen-cerf-tpd7io`. Work that isn't on it can't help the founder.

| Branch | What | Merge check against trunk (2026-10-05) | Proposed |
|---|---|---|---|
| ~~`codex/world-live-collaboration`~~ merged | Live collaboration between people in a World: grants by role, private Realtime notices, migration `20261004040200` | Conflicts in status docs only | Merge. It supersedes the collaboration copy in `development-memory-v1`. |
| ~~`codex/need-to-route-network-state-spec`~~ merged, without the canon section | Goal-first World creation, resource map (the spec's Resource), bounded World context for bots, the need-to-route design. It also adds a "Project resource coordination" section to `VISION-CANON.md`. | Conflicts in `lib/bot/connector.ts` (Claude's) | Merge, with Claude resolving the connector conflicts. The canon section needs the founder's yes. |
| ~~`codex/gateway-oidc-fallback`~~ merged | AI Gateway auth through Vercel OIDC | Docs conflicts only | Merge |
| `codex/development-memory-v1` (draft pull request #2) | Idea Graph (eight relation kinds, an Ideas page, AI idea expansion), plus an older copy of collaboration | Conflicts in the World page | Founder decides whether the Idea Graph is in scope (the spec doesn't list it). Before any merge, rename its migration `20261004000000`, which sorts before files already on the trunk, and drop its collaboration copy. |
| `codex/development-memory-plan` (draft pull request #1) | The plan for #2 | Docs conflicts | Goes with #2 |
| Manus's website (separate Webdev project) | A static narrative site | Not in the repo | Only as an additive `/about` or `/start` route; never replaces `/` (pull request #3, merged) |

**One concept, one home.** Extend the existing one rather than build a second.

| Concept | Home | Note |
|---|---|---|
| Route (ask to steps) | `lib/bot/routes.ts` | Fields follow Codex's route cards (why it fits, what it takes, unknowns, done when). The first-run route cards in Codex's design should build on it. |
| Decision | A routes piece (each option a route; the person takes one) | Shown in "Waiting on you" on `/bot` (`lib/bot/waiting.ts`) |
| Collaboration and membership | `lib/world/collaboration.ts` from `codex/world-live-collaboration` | |
| Resource | Codex's resource map | The spec's Resource |
| Proof | `lib/bot/proof.ts` saves | The spec's evidence ladder |
| Outreach (finding businesses, drafts, approval, channels) | `lib/bot/outreach.ts` | Practice channel only; real channels go through the same approval (`docs/plans/2026-10-05-business-leverage-outreach.md`) |
| Anchor (the record's fingerprint on chain) | `lib/chain/anchor.ts` (Merkle and memo), `lib/bot/anchor.ts` (World anchors, inclusion proofs) | Devnet only; receipts carry proofs |
| Wallet link | `lib/chain/wallet-proof.ts` (signed proof), kernel `link_wallet` | Codex: please consider a migration so `link_wallet` requires a verified proof (today a direct API call can link an address without one) |
| Personal home (the vision's Command Center) | `app/command/` | Codex: please consider sending signed-in `/` to `/command` (a one-line change in `app/page.tsx`) |
| Community | Not built | Waits on the founder (vision check §3.1) |

| Owner | Task | Branch | Owned paths | Protected paths (do not edit without the owner) | Done when |
|---|---|---|---|---|---|
| Codex (founder-directed takeover) | Build the open-ended shared creative World on isolated Supabase staging; verify Auth, then ship one real-time co-creation slice for two people and their separately owned agents. Keep improvement evidence-led and production untouched. | claude/keen-cerf-tpd7io | app/world/, app/api/, lib/world/, new kernel client/domain code, tests/, new migrations only when required, build/status docs | Applied migrations (never edit), DIRECTIVES.md (founder only), docs/MONETARY-CONSTITUTION.md Parts I–III, production Supabase project | Two people on separate devices can create/edit shared World work; an authorized external agent contributes with its own identity and scoped permission; changes sync, persist, show provenance, and survive reload. One actual collaboration task completes on staging. No simulated result is presented as live use. |
| Claude (founder-directed, 2026-10-04) | Your master bot: a person's own Claude, ChatGPT or Meta Muse connects through one MCP connector and acts as their customizable, animated avatar. Persona, memory fed from outside sources, and only the authority the person grants. Plan: docs/plans/2026-10-04-master-bot.md (step 4 of Codex's plan). | claude/keen-cerf-tpd7io | app/mcp/, app/.well-known/, app/oauth/, app/bot/, lib/bot/, tests/bot/, docs/plans/2026-10-04-master-bot.md, docs/plans/2026-10-04-bot-world-bridge.md, docs/plans/2026-10-04-critical-mass.md, app/save-point.tsx (shared SavePoint and PracticeLabel), app/part-preview.tsx, app/route-card.tsx and app/route-actions.ts (routes), lib/bot/waiting.ts and app/bot/waiting.tsx (Waiting on you), app/command/ (Command Center), lib/bot/outreach.ts and app/outreach-card.tsx (Outreach Room), lib/chain/anchor.ts, lib/bot/anchor.ts and app/anchor-panel.tsx (anchoring the record on chain), lib/chain/wallet-proof.ts and app/command/wallet-* (wallets the person controls), app/parts/ (STL downloads), app/saved/ (public receipts), docs/brand/ (proposed brand direction; the founder decides), supabase/migrations/20261004040000_erasable_content.sql (kernel v5), supabase/migrations/20261004040100_bot_presence.sql. Shared-contract additions, additive only: `sealKey`, `unsealKeys`, `destroyKey` in lib/kernel/client.ts, exercised in tests/kernel/client.test.ts | Everything in Codex's owned paths, applied migrations (never edit), DIRECTIVES.md (founder only), docs/MONETARY-CONSTITUTION.md Parts I–III, production Supabase project | A signed-in person customizes their bot. They connect an assistant by URL and approve it on Sovereign's consent screen. The assistant reads the persona and adds a memory that persists with provenance (bot, person, client). Read-only cannot write, and revoking stops access. The bot animates from real activity only. Verified on staging. |
| Manus (integration audit started 2026-10-05) | Audit how the separate public website maps to the real app, then continue with the real-browser/open-web lane. No database, Vercel, production, or shared-branch changes. Handoff: docs/handoff/MANUS.md | manus/website-integration-audit, by pull request into claude/keen-cerf-tpd7io | docs/qa/, docs/research/ | Everything in Codex's and Claude's owned paths, applied migrations (never edit), DIRECTIVES.md (founder only), docs/MONETARY-CONSTITUTION.md Parts I–III, production Supabase project | Integration boundary and next smallest safe step are documented; later staging walkthroughs and bridge contracts remain separate slices. Nothing outward-facing without the founder's go-ahead. |

**Claude, first slice done (founder: "your pick"):** the agent screen and a richer code-drawn avatar. Paths: `app/bot/{creator,character,stage,contract}.tsx`, `app/bot/page.tsx` and `lib/bot/persona.ts`. Codex, please check with Claude before editing these files while this is open. Codex's portrait creator (`app/bot/portrait-creator.tsx`) and connector tools stay as they are; the portrait creator moves lower on `/bot`. Next after this: bot onboarding at sign-on, built on the World entrance's existing "Who should represent you" step (Codex's `app/world/onboarding.tsx`), agreed with Codex first.

**Brand (founder decisions, 2026-10-04 and 2026-10-05):** the construct, inverted; solve is the master brand. Everyone builds to `docs/brand/BRAND.md`. For Codex's surfaces this means:
- the World entrance and intro follow the new signature intro (an empty room and one seat, the world assembles around it, the wordmark lands on the floor line, hold to enter);
- calm screens with motion as assembly, no glitch, HUD or particle effects;
- copy never says "agents" or "AI-powered" as a headline.
- *Brand v3 (founder approved, 2026-10-05): "Everything here is real."* Real results are save points: the point lands only on a real, recorded result or a person's yes. Simulated activity is **Practice**, always labeled with the dashed "Practice · simulated" ring, never the point; Arcadia surfaces should say Practice. Never gamify money or voice: no confetti, streaks, points or XP. Brand surfaces open on the white floor (ice `#f2f7fb`); the product keeps its dark. Built on Claude's side (2026-10-05): the connector's `add_proof` saves proof on a World piece as kernel evidence (`lib/bot/proof.ts`), `/bot` shows the latest saves, and `app/save-point.tsx` exports `SavePoint` and `PracticeLabel`. For Codex: show `proofsIn` saves on World pieces, label Arcadia with `PracticeLabel`, (No change needed in `lib/world/bot-access.ts`: its Add goes through `setBotAccess`, which already issues `kernel.evidence.attach`.) Arcadia now shows a fixed Practice label (`app/arcadia/page.tsx`, Claude, 2026-10-05). **Claude touched `app/world/[worldId]/page.tsx` (2026-10-05), additive only:** part pieces render with `PartPreview` (outline, size, Download STL); each piece shows its latest saves with `SavePoint`; history names `kernel.evidence.attached` "Saved with proof"; and the accent dot on every card was removed, because the brand reserves the point for real saves. A second additive change on the same day: routes pieces render with `RouteCard` (take a route, mark the next step done), the page reads `takenRoutes`, and history names `kernel.task.*` events as route steps.

**Master spec (founder upload, 2026-10-05):** `docs/specs/SOVEREIGN-MASTER-BUILD-SPEC.md`, with the PDF as the original. Read it alongside `VISION-CANON.md`. Where the two differ, and for four conflicts with standing decisions (the name, brand palette, Whop versus Discord/Slack, the first pilot), see `docs/specs/2026-10-05-spec-vision-check.md`. The founder decides; until then, the standing decisions hold.

**Money is gated (2026-10-05, master spec §2):** `lib/flags.ts`. `/money` and its actions answer 404 unless `ENABLE_MONEY=true`. New money surfaces should check the same switches.

Shared contracts: DOMAIN-CONTRACTS.md, lib/kernel/client.ts (typed kernel_api), lib/kernel/local.ts (embedded kernel), lib/sandbox/pglite.ts (browser database boundary).

**User-requested capability growth — first slice shipped:** connected assistants can learn owner-approved business context into sealed bot memory; leave structured, non-executable capability proposals in Worlds; and create/revise safe, visible 1–32px pixel-grid artifacts under their scoped bot identity. A collaborator’s bot can contribute where the World owner granted Add. Plan: [docs/plans/2026-10-04-user-requested-capabilities.md](docs/plans/2026-10-04-user-requested-capabilities.md). Still open: real-time multi-person sync/presence, a general sandbox builder/activation flow, export and provider-backed/streaming image generation. Staging sign-in and external assistant use remain unverified.

Production kernel changes and live service credentials are out of scope for this work until separately approved.
