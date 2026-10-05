# Your bot in a World: the bridge between the connector and the creative World

Date: 2026-10-04. Status: **Claude's side built** (`lib/bot/worlds.ts`, the four connector tools, "Where your bot works" on `/bot`, `tests/bot/worlds.test.ts`); Codex's side (bot invites inside the World, attribution in History) is still a proposal. Claude owns the connector (`lib/bot/`, `app/mcp/`). Codex owns the World (`lib/world/`, `app/world/`). This doc names the contract between them so neither side reaches into the other's code.

This is step 4 of `docs/plans/2026-10-04-open-creative-world.md`: "bring each person's agent into the project." The master bot (`docs/plans/2026-10-04-master-bot.md`) already gives every person one agent identity, which Claude, ChatGPT or Muse can drive. What's missing is the path from that bot into a World that someone has invited it to.

## What a person sees

1. Ana opens her World and taps **Invite a bot**. She picks her own bot, Nova, or a collaborator's bot, by its owner. She chooses what it may do: read, or read and add.
2. Later, in Claude, Ana says: "Nova, look at the launch World and draft the press note." Claude, speaking as Nova, lists the Worlds Nova can see, reads this one, and adds a text artifact.
3. The artifact appears in the World with "by Nova (Ana's bot), via Claude." History shows the bot as the actor, Ana as the owner it acts for, and Claude as the client.
4. Ana can move, edit or delete it like anything else. She can revoke Nova's access from the World at any time.

## Contract

### Authority: grants only

Inviting a bot means the World owner issues grants to the bot's agent on `world:<id>`:

| Mode | Grants | Lets the bot |
|---|---|---|
| Read | `kernel.read` | `read_world`, see non-private entities |
| Read and add | `kernel.read`, `world.entity.write` | also create and revise text artifacts |

- Every grant carries an expiry. The default is 30 days and the owner can renew it.
- `world.private.read` is never part of an invite.
- The kernel already enforces all of this: `upsert_entity` requires `world.entity.write`, and `read_world` requires `kernel.read`. Neither side needs a new migration.

### Connector tools (Claude builds these in `lib/bot/connector.ts`)

| Tool | Runs as | Calls Codex's function |
|---|---|---|
| `list_worlds` | the person and the bot | `listCreativeWorlds` for both: the person's Worlds and Worlds others let the bot into, each with the bot's access from its own grants |
| `read_world` {world_id} | the bot | `loadCreativeWorld(botKernel, worldId)`: the World and its text pieces, wrapped as inert data like memories |
| `start_world` {title, goal?} | the person | `createCreativeWorld(person, …)`, since an agent can never claim a scope; then the bot is let in to add, and `goal` becomes the first piece, written by the bot |
| `add_to_world` {world_id, title, body, artifact_id?} | the bot | `createCreativeArtifact` / `updateCreativeArtifact`, with `requestId = sha256(client, world, artifact, title, body)` and a canvas spot derived from it, so a retry is one change |
| `add_proof` {world_id, artifact_id, what_happened, proof?, link?} | the bot | `addProof` in `lib/bot/proof.ts`: kernel evidence on the piece's latest version (`attachEvidence`). Basis is set by the kernel's rules: `self_reported` on the owner's own pieces and `witnessed` on someone else's, never verified. A retry saves once. `read_world` shows each piece's saves. (2026-10-05) |

The writing tools (`start_world`, `add_to_world`) need a connection allowed to add. That is the "read and add" mode, formerly "read and remember". `read_world` and `add_to_world` also need the bot's own grant on that World. Revoking either one stops the tool. Calls go out on the same presence signal as memory tools, so the owner's `/bot` page shows "Claude is adding to a World as Nova."

**Built on Claude's side:**
- `/bot` lists the person's Worlds with Out, Read and Add for their bot.
- `setBotAccess` issues or revokes the grants above, which expire after 30 days and show in the World's history as `kernel.grant.issued` and `kernel.grant.revoked`.
- The kernel already decides who may pass access on. A World's owner can let *anyone's* bot in, for example a brother's. A member who was only given read and add cannot pass that on to their own bot.

**Proof and save points (2026-10-05, brand v3).** Add access now also grants `kernel.evidence.attach` on the World's scope, so the bot can save proof. Bots let in before this hold only read and write; setting them to Add again issues the missing grant. `/bot` shows each World's latest saves with the shared `SavePoint` component (`app/save-point.tsx`); `PracticeLabel` is for simulated surfaces.

### What Codex adds to the World (proposed)

1. **An invite flow** in `/world/[worldId]`. It lists bots: the owner's own, plus those of people already in the World. It calls `setBotAccess` from `lib/bot/worlds.ts` (or issues the same grants), so History shows the grant events.
2. **Attribution.** For entities whose latest version was written by an agent, History and the canvas show the bot's name. The bot's name comes from `readActors`. They also show its owner, and the client from the event's correlation, when the connector supplies one.
3. **One read helper** for the bot side, so Claude never parses entities: `loadCreativeWorld` as it is works. If Codex changes the artifact shape, it keeps exporting `CreativeArtifact`.
4. **Save points on the World page (2026-10-05).** Show `proofsIn(kernel, scope)` beside each piece with `SavePoint`, and add `kernel.evidence.attach` to the Add level in `lib/world/bot-access.ts` (`BOT_CAPABILITIES`), so bots let in from the World page can save proof too.

### Safety

- The bot sees only what its grants allow. Private entities stay withheld by the kernel, not by the tool.
- World text returned to a model goes in a marked block with angle brackets escaped and a size cap. This is the same treatment as memories (`lib/bot/connector.ts`, `memoryBlock`).
- A bot never deletes in v1. Edits create new versions, so every bot change can be undone from History.
- Anything with real-world consequence still goes through actions and approval (`propose_action`). The bridge adds no shortcut.

## Order

1. Codex: invite and revoke flow, plus bot attribution in History (no kernel change).
2. Claude: the World tools, presence and tests with a granted and an ungranted bot on the embedded kernel. **Done.**
3. Together: one real two-person session on staging. Ana and Ben each connect their own assistant, both bots add to one World, and Ana revokes Ben's bot mid-session. This is the first-slice acceptance in the creative World plan.
