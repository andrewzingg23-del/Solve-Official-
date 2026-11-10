# MCPvault's connection pieces, audited against SOLVE Connect

Founder direction (2026-11-10): build the connector by first extracting what MCPvault already
developed, reuse what is proven, and implement only what is missing, with SOLVE's kernel enforcing
permissions. The first proof: authorize an outside AI client to one selected project, let it perform
one permitted act, disconnect it, and prove later access is refused.

Source read: `quarkvibe/MCPvault` at `995dda1` ("Pre-streamlining backup"). Read only; nothing was
run and no code was taken.

## What MCPvault has, and whether it can be reused

| Piece | Where | Finding | Verdict |
|---|---|---|---|
| OAuth 2 server | `server/oauth/oauth-server.ts` | **Accepts any password**: `getUser` skips verification ("For demo purposes, we'll assume valid"). Access and refresh tokens are stored in plaintext, and **raw tokens are written into the audit log** (`oauth_access_token_not_found`, `oauth_refresh_token_not_found`, `oauth_token_revoked`). PKCE exists only as columns (`server/db/schema.ts`), allows `plain`, and is never checked by the server. | **Do not reuse.** SOLVE already uses Supabase Auth's OAuth 2.1 server, which issues tokens with a verified `client_id`. |
| AI scope vocabulary | `AI_SCOPES` | Per-domain scopes (profile, documents, context, legal, finance, health, realtime, admin). A good map of what people will want to grant by area. | **Keep the idea**, as kernel scopes and type definitions, not as strings checked in app code. |
| Per-app permissions | `server/infrastructure/permission-manager.ts` | The model is right: per app, per area, read/write/delete, expiry, an audit log. The mechanism is unsafe. **Remote command execution**: `appId`, `folderPath` and `apiKey` are interpolated into bash scripts run over SSH. **`validateAppAccess` never checks the granted permissions**, only that the API key matches and the path exists, so any registered app reaches any folder. **Expiry is stored and never enforced.** | **Keep the model; the mechanism is the kernel's.** Grants by scope and capability, with expiry, revocation that cascades, and a hash-linked history. |
| CLI device and out-of-band login | `cli/src/commands/auth/device.ts`, `server/routes/auth-oob-complete.ts` | A real gap in SOLVE: signing in a terminal or a device without a browser. | **Worth porting later**, on Supabase Auth, after review. Not needed for the first proof. |
| Information classification | categories, extraction | Real domain research (identity, legal, financial, family). | **Already planned** as type definitions (`docs/plans/2026-11-10-two-brothers-plan.md`). |
| SDK | `sdks/javascript/mcpvault-sdk.ts` | An API wrapper. | Revisit when `/api/connect/v1` exists. |

The secrets committed to that repository (`.env`, `SECRETS_EXPORT.env`; see
`2026-11-09-mcpvault-reconciliation.md`) still need rotating at source.

## What SOLVE already had

SOLVE already runs an MCP connector (`app/mcp/route.ts`, `lib/bot/mcp-auth.ts`), with tokens issued
by Supabase Auth's OAuth 2.1 server to a registered client, and a consent screen (`/oauth/consent`).
It is how Claude reaches SOLVE in this very session. The gap, found while inspecting it:
`kernel.resolve_caller` ignored the token's `client_id`. **A connected app held the person's whole
authority, and a leaked connector token could call every `kernel_api` function as them**, not only
the connector's tools. Disconnecting was an app-layer record; the token kept working directly.

## What was built: Connect increment 1, in the kernel

`supabase/migrations/20261110070000_connections.sql`, proven by `tests/kernel/connections.test.ts`
(5/5 on real migrations):

- A token carrying a `client_id` resolves to that app's **connection agent**, never to the person.
- The agent starts with nothing and reaches only what the person grants it, thing by thing, through
  ordinary kernel grants.
- **The proof, as a test:**
  - an app that was never connected gets nothing;
  - once connected and given one thing, it reads it and adds a piece, and the record names the app as
    the actor, on the person's behalf;
  - it cannot read another thing, read the person's own scope, grant itself more, connect or
    disconnect apps, or list connections;
  - a different app holding a token for the same person is not this app.
- **Disconnecting** revokes every grant the agent holds, and the same token is refused from then on.
  Reconnecting starts fresh, with nothing.
- Only the person, in their own session, can connect or disconnect. The connection records can't be
  rewritten or erased.

## Status, honestly

- **Not applied to staging or production.** Applying it changes who every connector token is. The
  existing connector (`lib/bot/connector.ts`) reads the persona, memories and connections through the
  token as though it were the person, in 21 places, so connected assistants would lose those reads.
  Staging's `resolve_caller` was compared and matches the repository's exactly, so applying is
  mechanically safe once the connector is ready.
- **Next slice:**
  - Approving an assistant on `/oauth/consent` also calls `connect_app`, and disconnecting calls
    `disconnect_app`, so the existing connection record and the kernel connection are one concept
    with one enforcement.
  - The connector reads through grants the person gives the connection's agent.
  - Control gets "Connected apps": what each can reach, "let it into this thing", and Disconnect.
  - Then apply to staging and run the proof end to end with a real MCP client.
