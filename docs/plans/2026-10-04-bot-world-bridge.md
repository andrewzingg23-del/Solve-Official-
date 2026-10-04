# Your bot in a World: the bridge between the connector and the creative World

Date: 2026-10-04. Status: **proposal for Codex**, not built. Claude owns the connector (`lib/bot/`, `app/mcp/`). Codex owns the World (`lib/world/`, `app/world/`). This doc names the contract between them so neither side reaches into the other's code.

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
| `list_worlds` | the bot | `listCreativeWorlds(botKernel)`: Worlds whose scope the bot holds `kernel.read` on |
| `read_world` {world_id} | the bot | `loadCreativeWorld(botKernel, worldId)`: the World and its text artifacts, wrapped as inert data like memories |
| `propose_change` {world_id, title, body, position?, artifact_id?} | the bot | `createCreativeArtifact` / `updateCreativeArtifact` with `requestId = sha256(client, world, title, body)` |

Every World tool requires two things: a connection in **read and remember** mode, and the bot's own grant on that World. Revoking either one stops the tool. Calls go out on the same presence signal as memory tools, so the owner's `/bot` page shows "Claude is working in Launch World."

### What Codex adds to the World (proposed)

1. **An invite flow** in `/world/[worldId]`. It lists bots: the owner's own, plus those of people already in the World. It issues and revokes the grants above, recording `world.bot.invited` and `world.bot.removed` events in the World scope so History reads plainly.
2. **Attribution.** For entities whose latest version was written by an agent, History and the canvas show the bot's name. The bot's name comes from `readActors`. They also show its owner, and the client from the event's correlation, when the connector supplies one.
3. **One read helper** for the bot side, so Claude never parses entities: `loadCreativeWorld` as it is works. If Codex changes the artifact shape, it keeps exporting `CreativeArtifact`.

### Safety

- The bot sees only what its grants allow. Private entities stay withheld by the kernel, not by the tool.
- World text returned to a model goes in a marked block with angle brackets escaped and a size cap. This is the same treatment as memories (`lib/bot/connector.ts`, `memoryBlock`).
- A bot never deletes in v1. Edits create new versions, so every bot change can be undone from History.
- Anything with real-world consequence still goes through actions and approval (`propose_action`). The bridge adds no shortcut.

## Order

1. Codex: invite and revoke flow, plus bot attribution in History (no kernel change).
2. Claude: the three tools, presence and tests with a granted and an ungranted bot on the embedded kernel.
3. Together: one real two-person session on staging. Ana and Ben each connect their own assistant, both bots add to one World, and Ana revokes Ben's bot mid-session. This is the first-slice acceptance in the creative World plan.
