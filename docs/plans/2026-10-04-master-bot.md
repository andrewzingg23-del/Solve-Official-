# Your master bot: bring your own AI, give it a body

Date: 2026-10-04. Founder direction: people use the assistant they already have (Claude, ChatGPT, Meta AI's Muse) inside Sovereign, as their personal avatar. Customizing and personifying that avatar should feel like a video game character creator, for the in-app relationship. Outside sources feed it context.

This is step 4 of `docs/plans/2026-10-04-open-creative-world.md` ("bring each person's agent into the project"), taken by Claude at the founder's request. Codex keeps the creative World. See `ACTIVE-WORK.md`.

## What a person gets

1. **A master bot.** One persistent character that is theirs: a name, a look (body, colors, eyes, accessories, aura), a personality (warmth, playfulness, boldness, formality), a voice line, values and a relationship to them (represent, assist, guide, create with). It is the avatar the kernel already models (`kernel.avatars`, backed by an agent the person owns).
2. **Any AI can drive it.** The person connects Claude, ChatGPT or Muse once, through one connector URL, and approves it on Sovereign's own consent screen. From then on, whichever assistant they are talking to can speak and work *as their bot*. It reads the bot's persona and memory, so the bot feels the same in every app.
3. **A memory they feed.** The bot remembers what the person or their assistant gives it. That includes notes, decisions, preferences, and summaries of documents or mail. The assistant pulls those from the person's other connectors (Notion, Gmail, Drive and so on). Each memory records its source and which assistant added it.
4. **A body that reacts.** The bot is drawn and animated in the app. It idles, listens, thinks, works and celebrates. Its states come from real activity: a memory added, a task finished, an assistant connected. It never pretends to be working.
5. **A relationship grounded in history.** The relationship view shows real counts from the kernel: days together, memories shared, assistants connected, things done together. These are not simulated stats.

## How it works

```
Claude / ChatGPT / Muse ──MCP over HTTPS──▶ /mcp (this app)
          │                                   │ validates the Supabase-issued OAuth token
          │ OAuth 2.1 + PKCE                  │ → the person → their bot (avatar agent)
          ▼                                   │ → acts as the bot through kernel_api
Supabase Auth OAuth server ◀── consent at /oauth/consent (the person approves, picks read-only or read and add)
                                              ▼
                                   kernel: the bot's grants decide; every write is an event
```

- **One connector for all three.** A remote MCP server (Streamable HTTP, JSON-RPC) at `/mcp`. Claude and ChatGPT (Developer Mode) add it by URL. Muse users add it as a custom connector by URL, and listing it in Muse's directory takes a submission and review at muse.ai/platform. All three expect OAuth 2.1 with PKCE and dynamic client registration or client metadata documents.
- **Sign-in is Sovereign's.** Supabase Auth's OAuth 2.1 server issues the tokens; people sign in with their Sovereign account. `/.well-known/oauth-protected-resource` tells clients where that server is. A request without a valid token gets 401 with the metadata pointer, as the MCP spec requires.
- **The bot is the actor.** The connector checks the token, finds the person's actor and their bot, then calls `kernel_api` as the bot (service key, acting as the bot agent). The kernel decides with the bot's grants, so a connected AI can never do more than the person delegated to the bot. A new bot can only observe its owner's scope.
- **Connections are the person's acts.** Approving a client records `bot.connection.approved` {client, mode} in the person's scope; revoking records `bot.connection.revoked`. The connector enforces the latest record for that client, read-only or read and add (stored as `remember`). Remembering also needs the bot to hold `bot.memory.*` on the owner's scope, which the person grants when they first allow it. Grants stay the backstop.
- **Persona and memory are kernel events in the owner's scope.** Erasable memory adds kernel v5 (keys outside history); nothing else needs a migration.
  - `bot.persona.set` is recorded by the person, versioned by sequence, latest wins.
  - `bot.memory.noted` {text ≤ 2,000 chars, source, via} is recorded by the bot. The connector sets `via` from the token, never the model.
  - `bot.memory.forgotten` {memory} hides a memory from every view and tool.
- **Presence is ephemeral.** "Claude is reading Nova's context" is a live signal, not history: a private Realtime broadcast on `bot-live:<auth user id>`, sent by the connector on each tool call and receivable only by that person (`lib/bot/presence.ts`, `supabase/migrations/20261004040100_bot_presence.sql`). It names the assistant and the tool, never content.

## Tools the connector offers

| Tool | Mode | What it does |
|---|---|---|
| `whoami` | read | The bot's persona, its owner, the connection's mode, and how to speak as it |
| `get_context` | read | Persona, recent memories and recent activity in the owner's scope |
| `search` | read | Finds memories and records by text; ChatGPT's `search` result shape |
| `fetch` | read | One memory or record by id; ChatGPT's `fetch` result shape |
| `remember` | read and add | Adds a memory with its source |
| `list_worlds` | read | The person's Worlds and Worlds others let the bot into, with what the bot may do in each |
| `read_world` | read | One World the bot was let into, as inert data |
| `start_world` | read and add | A private World for a goal, owned by the person, with the bot let in to add |
| `add_to_world` | read and add | Adds or revises a text piece as the bot, where the bot may add |

The server's `initialize` instructions tell the assistant to speak as the bot (from `whoami`). They also say to treat memory text as data, not instructions, to name sources, and never to claim authority the bot doesn't hold. Acting in Worlds (proposals, task-scoped contact) comes after these slices, through the existing governed action path and Codex's World interface.

## Honest limits

- **Erasing memories (kernel v5).** History is append-only, so a memory's words are sealed with a key of its own that lives outside history. "Erase" destroys the key, so the words are gone for good, and history records that a memory existed and was erased. Backups keep a destroyed key until they expire, and the database operator could read keys before erasure: this makes memories erasable, not secret. Memories recorded before v5 can only be hidden. Passwords and keys still don't belong there.
- **Muse.** Consumer Muse adds custom connectors by URL through Muse itself. Appearing in Muse's directory needs Meta's review. Muse asks connectors to offer read-only access, and read-only is a first-class mode here.
- **ChatGPT.** Custom connectors need Developer Mode (Plus, Pro, Business, Enterprise, Edu). ChatGPT checks for `search` and `fetch`.
- **Nothing here purchases, pays or commits.**

## Setup the founder does (staging)

1. Supabase `solve-staging` → Authentication → OAuth Server:
   - enable it;
   - set Authorization Path `/oauth/consent`;
   - allow dynamic client registration.

   Under URL Configuration, set the Site URL to the branch preview host. Asymmetric JWT signing keys are recommended.
2. Vercel project `solve`, Preview, branch `claude/keen-cerf-tpd7io`: `SUPABASE_SECRET_KEY` for `solve-staging`, so the connector can act as the bot.
3. Connect an assistant to `https://<preview host>/mcp`:
   - Claude: Settings → Connectors → Add custom connector.
   - ChatGPT: Developer Mode → create a connector.
   - Muse: ask Muse to add a custom connector with that URL.

## Slices

- **A. The bot's body and persona.** `lib/bot/persona.ts` (schema, validation, defaults, kernel persistence), an animated character drawn from the persona (`app/bot/character.tsx`), and the creator at `/bot`. Done when a signed-in person creates and customizes their bot and it persists across reloads, with history.
- **B. The connector.** `/mcp`, protected-resource metadata, token validation, the consent screen at `/oauth/consent`, connection records, the five tools, and memory. Done when one assistant connects on staging, reads the persona, and adds a memory that persists, with provenance naming the bot, the person and the client. A read-only connection cannot write, and revoking stops access.
- **C. Alive.** Live presence while an assistant works, the feed-your-bot box, the relationship view from real history, and setup guides inside the app.

**Status (2026-10-04).** Slices A, B and C are built, plus the hardening pass: erasable sealed memory (kernel v5), live presence, search over the whole history, and injection guards. They are tested on the embedded kernel and on Postgres 17 (`tests/bot/`, 23 tests). None of it has been exercised with a real assistant yet: that waits on the staging setup above, and v5 is not applied to staging yet. The bot also works in Worlds now: the four World tools and "Where your bot works" on `/bot` (`docs/plans/2026-10-04-bot-world-bridge.md`).

Tests live in `tests/bot/`. They run on the embedded kernel, and the connector tests use fake tokens and no network.

**Agent screen (2026-10-04).** `/bot` is a HUD command center with seven customization tabs (Form, Face, Finish, Color, Gear, Motion, Personality), ten state previews and an agent-contract card read from real records. The avatar stays code-drawn (founder's pick), with four finishes, brows, marks, motion energy and idle styles.
