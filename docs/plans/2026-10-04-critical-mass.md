# Getting to critical mass: bots that build real things together

Date: 2026-10-04. Author: Claude, at the founder's request. This is strategy, not a directive. Numbers marked *estimate* come from published list prices and stated assumptions, not measurements. Sovereign has no real users yet, so every adoption number below is a target to test.

## The goal in one paragraph

People bring the AI they already use (Claude, ChatGPT, Meta's Muse) and give it one body: a master bot they customize like a game character. They feed it what matters and invite it into Worlds, alone or with friends and their bots. Together they get real things done. Sovereign's kernel makes that safe. Every bot acts only on what its person granted, everything it does is recorded with proof, and anything a person shared can be erased. The bot grows from what actually happened, never from fake points.

## Who we compete with, and why we can still win

| Competitor | What they have | What they lack |
|---|---|---|
| ChatGPT, Claude, Muse themselves | The assistant, its memory, huge distribution | Memory and identity locked to one vendor. No shared, governed space where *different people's* assistants work together. |
| Companion apps (Character.AI, Replika) | Emotional hook, characters | No real-world work, no authority model, no proof |
| Notes and second brains (Notion AI, Mem) | Knowledge capture | No character, no co-op, no governed action |
| Agent and automation platforms (Zapier, n8n, agent SDKs) | Real actions | Built for builders, not people. No relationship, no fun. |
| Creative Worlds (Roblox, Minecraft) | Fun, co-op, creators | Not connected to your real AI or real-life outcomes |

**Our wedge** is that one bot works the same in every assistant, and bots of different people work together in one World, under real authority and with real proof. The big labs are unlikely to make their memory portable to each other. MCP makes it cheap for us to be the neutral place that all of them can reach.

**Honest risks:**
- A lab ships cross-app memory.
- Companion apps out-hook us emotionally.
- "Governed" sounds like homework.

The answer to all three is the same: win on *finished outcomes with friends*, which none of them do, and make getting there feel like play.

## How people connect their bots and build real things

The loop each person goes through:

1. **Make the bot** (built): the character creator at `/bot`.
2. **Connect your AI** (built, untested live): one URL, `/mcp`, added in Claude, ChatGPT or Muse, then approved on Sovereign's consent screen.
3. **Feed it** (built): the assistant pulls from the person's other connectors (Gmail, Notion, Drive) and saves what matters with `remember`, sealed and erasable.
4. **Invite it into a World** (proposed): `docs/plans/2026-10-04-bot-world-bridge.md`. The World owner grants the bot read or read-and-add. The bot drafts artifacts there, and every change is versioned and attributed.
5. **Run a quest** (next): a template that sets up a World with tasks, roles and a clear finish line, using the kernel's tasks, actions and evidence. Bots propose, and people approve anything with real-world consequence.
6. **Prove the outcome**: evidence attaches (a link, a receipt hash, a photo hash, a confirmation). The outcome is a verified record, and the bot's history grows from it.

First quest templates. Each takes two people and finishes in days, not months:
- **Trip with a friend.** Two bots co-plan, compare options, and end with a booked itinerary as evidence.
- **Launch a small page.** Your bot drafts, a friend's bot critiques, and the published URL is the evidence.
- **Group event.** Plan a dinner or a cleanup, then RSVPs and a photo.
- **Job hunt sprint.** Your bot tracks applications, a friend reviews, and interviews booked are the evidence.

## Making it fun without lying

Game-like, never fake:
- **A character that reacts** (built). It reacts to real activity: it listens while connected, works when an assistant adds something, and rests after a quiet week. It goes live when Claude is using it right now (built in this slice).
- **Earned cosmetics.** Auras, accessories and titles unlock from verified milestones, read from kernel records. Examples: a first memory, a first co-op World, a first verified outcome, five quests with friends. Nothing is bought, and nothing is granted without a record.
- **Co-op first.** Two bots in one World is the core moment. Design every quest for two.
- **A shareable bot card.** An image of the bot with its verified record ("Nova: 3 quests finished with friends, since Oct 2026") and an invite link. This is the main viral loop.
- **Seasons of real challenges.** For example, "This month: plan something with someone you haven't seen in a year." Show leaderboards of verified outcomes only.
- **Never:** loot boxes, streak guilt, paid boosts, or simulated activity presented as real. The monetary constitution and the founder directives already forbid the money ones.

## Architecture: what holds, and what has to change

**Today:**
- Next.js on Vercel, with stateless functions.
- A Supabase Postgres kernel: append-only, hash-chained events, reached only through `kernel_api` functions.
- Supabase Auth's OAuth 2.1 server for connected assistants.
- The MCP connector at `/mcp`.
- Supabase Realtime for ephemeral presence.
- Kernel v5 (this slice) seals erasable content: keys sit in a separate mutable store and history never changes.

Constraints, in the order we will hit them:

1. **No live users yet.** Live is behind staging: v4 waits on the founder's go-ahead, and the OAuth server and Data API exposure are not configured. This is the first constraint, not scale.
2. **One global chain lock.** Every kernel write takes one advisory lock (`kernel.lock_chain`).
   - At roughly 5–20 ms per write transaction, that is about 50–200 writes a second in total *(estimate)*.
   - At 10 writes per active per day, it holds to roughly 50k–100k daily actives *(estimate)*.
   - The fix is per-scope chains plus a periodic global anchor: a hash of all scope heads, recorded on the global chain. That keeps tamper evidence without global serialization. It is kernel v6, Codex's domain, and should be built before 50k actives, not now.
3. **Memory search is a scan.** Search decrypts in the app, and a full read is capped at 10,000 events per person. That is fine for the pilot.
   - The scale path is an *erasable index*: search vectors and terms in a mutable table that sits beside the key store and is deleted with the key.
   - An append-only index would leak what erasure removed.
4. **Connector reads.** Each tool call makes 3–6 database calls. Add a short per-request cache, then read models for persona and connections.
5. **Abuse.** The per-assistant hourly memory limit is built. Per-IP limits on `/mcp` belong in Vercel Firewall rules.
6. **Background work.** Quest checks, digests and evidence verification need a queue (Vercel Cron or Supabase Queues) once quests exist.

## Costs

The decisive choice is **bring your own AI**. The person's Claude, ChatGPT or Muse subscription pays for the model. We pay for a function call and a few database queries.

If Sovereign ran the model itself, one interaction would cost roughly $0.007 on Sonnet 5.5 or $0.014 on Opus 5.5 (2k tokens in, 300 out) *(estimate)*. At 10,000 actives making 20 interactions a day, that is about $42k–84k a month. Bring-your-own AI removes that wall. Server-side reasoning (`/api/reason`, through the AI Gateway) stays opt-in for specific features, metered and capped.

Infrastructure, assuming 20 connector calls and 3 memories per active per day *(estimates)*:

| Stage | Daily actives | Vercel | Supabase | Model | ≈ Total / month |
|---|---|---|---|---|---|
| Pilot | 2–20 | $20 (Pro seat, usage inside its credit) | $25 (Pro, Micro compute in credit) | $0 | **≈ $45** |
| Early | 1,000 | $20 (≈600k calls, inside credit) | $25–40 | $0 | **≈ $50–100** |
| Growth | 10,000 | $20–60 | $60–250 (larger compute, disk past 8 GB) | $0 | **≈ $150–400** |
| Scale | 100,000 | $150–400 | $500–2,000 (large compute, MAU past 50k, disk, replicas) | $0 | **≈ $1k–3k** |

Pricing inputs:
- Vercel Pro is $20 a seat, with matching usage credit. Invocations are $0.60 per million and active CPU is $0.128 per hour.
- Supabase Pro is $25 a month. It includes 8 GB of database, 50k MAU, 200 Realtime connections, 2M messages and $10 of compute credit.

Add point-in-time recovery for the kernel store at launch, about $100 a month *(estimate)*, because history is the product. Storage grows about 0.2 MB per active per month (sealed memory events are 1–3 KB).

## What exists now

**Built and tested:**
- The kernel through v4, now with v5 erasable content.
- The creative World's first slice (Codex): private Worlds, text artifacts and history.
- The master bot: the creator, the connector with consent and memory, live presence, and the relationship view.

All of this is tested on the embedded Postgres in CI.

**Rehearsed:**
- v4 on the `solve-staging` Supabase project, with grants, chain and retries verified.

**Not done:**
- No real assistant has connected. Staging needs the OAuth server enabled and a secret key in the preview.
- Live does not have v4.
- No real user has completed anything.

Everything so far is evidence from tests and simulations, and is labeled as such.

## Reaching critical mass

Sovereign's network effect is **local**: it grows from small groups who finish things together, not from a global feed. So critical mass means *density in small clusters*.

The atomic unit is **two people, two connected bots, one shared World and one verified outcome.** Grow that unit, then copy it.

| Phase | People | Gate to move on (all from kernel records) |
|---|---|---|
| 0. Founder pair | 2 | Both connect an assistant. Both bots contribute to one World. One real outcome is verified. Revoking one bot mid-session works. |
| 1. Hand-picked circle | 20 | At least 60% of signups connect an assistant. At least 5 memories per active per week. 7-day retention of 40% or more. At least 30% start a co-op World. |
| 2. Invite loop | 200 | At least 1 invite sent per active, with a 25% or higher accept rate. At least 1 verified outcome per co-op World per month. 30-day retention of 25% or more. |
| 3. Directories and templates | 2,000 | At least 50% of signups organic. Community-made quest templates in use. |

Distribution, in order:
1. The founder's own circle.
2. Whop communities, through the Whop bridge directive. A community already has a group and a reason to build together.
3. Listings in the Claude connectors directory, the ChatGPT apps directory and Meta's Muse directory (Muse listing needs Meta's review).
4. Shareable bot cards.
5. A public gallery of finished quests, with evidence and consent.

Measure every gate from kernel records, never from simulated activity.

## Working with Codex

Codex (ChatGPT) owns the World, the kernel's core domains and the build status. Claude owns the bot and the connector. `ACTIVE-WORK.md` records who holds which paths. Contracts between the two sides are written as plan docs before code, like the bot–World bridge. Both build on the same branch and push small slices with green CI.

## Founder decisions this needs

1. **Go-ahead for v4 on live, then v5.** v5 adds a mutable key store beside the append-only history. History itself is never edited or deleted. Erasing a memory deletes only its key, and that deletion is itself recorded. Confirm this reading of "nothing edited, nothing deleted."
2. **Staging setup** so a real assistant can connect: the OAuth server, Data API exposure for `kernel_api`, and `SUPABASE_SECRET_KEY` in the preview. See the master bot plan.
3. **A pilot freeze.** Suggested directive text, for the founder to add if wanted (only the founder edits `DIRECTIVES.md`):

   > ### 2026-10-04 — Pilot freeze
   > Until two people have each connected their own assistant, and both bots have contributed to one shared World ending in one verified real outcome on staging, agents build only: blockers for that pilot, security and safety fixes, and tests and docs for what exists. No new surfaces, domains or simulations. The founder lifts this by editing it.
