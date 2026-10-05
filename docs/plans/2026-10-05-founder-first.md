# Founder first: solve is built for the founder first

2026-10-05. The founder: *"the app should solve the problems im having here.. and it should be built for me first."*

The first user is the founder, and the first real project is building solve itself, with four AI builders (Claude, Codex, Manus, ChatGPT). This is the directive "Use Sovereign and grow it from real outcomes" in its plainest form. Sovereign's own builders use the governed World loop to build Sovereign, and the founder's friction picks the next slice.

## The problems, as they happened today

| # | Problem (evidence from 2026-10-05) | What solve already does | What's missing |
|---|---|---|---|
| 1 | "What is Manus doing?" Claude had to search GitHub, Vercel and Supabase to find out, and Manus's work was in a separate workspace nobody could see. | Presence shows which assistant is doing what with a bot (`lib/bot/presence.ts`). Every World change is on the record, with who made it. | Each builder connected as an assistant to the founder's World. Pieces showing which assistant added them, not only the bot. |
| 2 | Copying messages between AIs ("Paste this to Manus", then pasting Manus's reply back). | Assistants read and write the same World through the MCP connector (`read_world`, `add_to_world`). | Builders connected (see 1), and a handoff piece they read instead of a pasted prompt. |
| 3 | Work in six places: five Codex branches (about 3,700 lines) and a separate Manus site. Two route designs and two copies of collaboration code. Builders reading different canons. | One kernel record per World. | A view of the repo's state (branches, pull requests, builds) in the World. Until then, the "Now" block in `ACTIVE-WORK.md`. |
| 4 | Decisions buried in long replies: four spec conflicts, Codex's canon addition, which branches to merge, staging SQL. | Routes: options proposed and only the person takes one, on the record (`lib/bot/routes.ts`). | A decision proposed as routes (each option a route), and one "Waiting on you" list across the founder's Worlds. |
| 5 | Approvals that stall: staging migrations timed out three times waiting for a yes, and the founder pastes SQL by hand. | Kernel actions, approvals and grants (v4). | Approvals in the waiting list. For now, the founder approves the tool prompt or runs the SQL. |
| 6 | Trusting claims: "never report green until CI", and Claude stamped build-log entries ahead of the clock. | Saves with proof; the basis says whose word it rests on (`lib/bot/proof.ts`). | Build runs and merges as proof seen by solve (`system_observed`, through a GitHub connection), not a builder's word. |
| 7 | Vision drift: "make sure this meets vision", "make sure we are working in a way that benefits the vision". | `docs/specs/2026-10-05-spec-vision-check.md`. | Every piece of work tied to the ask it serves (routes do this), so drift shows. |
| 8 | Usage limits and restarts break the thread ("continue from where you left off"). | Everything a builder does in a World stays on the record. A new session reads it. | Builders working from the World, not from chat. |

## Slices, in order

| Slice | What the founder gets | Owner | Needs |
|---|---|---|---|
| 0. Staging works for the founder | Sign in on the staging preview, make a bot, connect Claude from claude.ai | Founder, with Claude | The two staging SQL files (v5 and presence) and a sign-in check on the preview URL |
| 1. "Build solve" World | One World with the goal, the open decisions proposed as routes, and a handoff piece for each builder. The founder's own Claude sets it up through the connector; no new code. | Founder's Claude | Slice 0 |
| 2. Waiting on you | One list on `/bot` across the founder's Worlds: decisions not yet taken and the next step of every route taken | Claude | Built on routes; no migration |
| 3. Who did it | Pieces, routes and saves show which assistant added them ("via Codex"), next to the bot | Claude | Connector records the client on World writes |
| 4. Builders connected | Codex, Manus and ChatGPT connected to the founder's bot through the MCP connector, each approved on the consent screen | Manus finds how each one connects; founder approves | Slice 0 |
| 5. The repo as a source | Branches, pull requests and build results shown in the World. A finished build or a merge saved as proof seen by solve | Codex or Claude, founder chooses | A GitHub connection (read-only to start) and a service actor for `system_observed` |

What this changes for each builder's lane:
- **Manus:** before the Whop and Discord research, find out how each of our builders (Claude Code, Codex, Manus, ChatGPT) can connect to solve's MCP endpoint (remote MCP over HTTP with OAuth), and walk the founder's path on staging once slice 0 is done.
- **Codex:** merge or close the open branches so the trunk is the one place the app lives (see "Now" in `ACTIVE-WORK.md`).

## What doesn't change

- The kernel's rules.
- The brand.
- No money.
- Staging before production.
- Nothing outward-facing without the founder.

Building for the founder first is also a pilot that is real by definition. It is labeled as the founder's own use: never presented as customer traction, and never padded with simulated activity.
