# SOLVE Connect + Overlay — findings and build plan

Founder directive 2026-11-10: a universal connection layer, a portable overlay, the kernel as the
only authority. This records what inspection found before any code, so the build resumes exactly here.

## What already exists (reuse, don't rebuild)

- **Supabase is already an OAuth 2.1 server.** Connected apps receive access tokens carrying a
  `client_id` claim (`lib/bot/mcp-auth.ts` reads it). `/oauth/consent` is the consent screen;
  `/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource` exist.
- **`/mcp` already serves connected AI clients** (Claude) over those tokens.
- **Agents and grants exist in the kernel:** `kernel_api.spawn_agent`, `issue_grant`,
  `revoke_grant`, `issue_lease`; `resolve_caller` already supports agents acting under a principal.

## The hole that Connect must close first

`kernel.resolve_caller` (latest in `20261102043153_seamless_guest_identity.sql`) treats every
`authenticated` token the same and **ignores `client_id`**. So a connected app holds the person's
*full* authority at the database, by any path (PostgREST included). That fails "every external
interaction must respect actual authority."

## Increment 1 — connections in the kernel (next migration)

- `kernel.connections`: person, `client_id`, an agent actor created for the connection, label,
  validated manifest, `revoked_at`, event.
- `resolve_caller`: a token with `client_id` resolves to that connection's **agent** (principal =
  the person); no active connection → refused. New `auth_method` value (`oauth_client`) — the
  `kernel.events.auth_method` check (`user_jwt | service_role | kernel`) must be widened.
- `kernel_api.connect_app` (called from the person's own session at consent: spawn agent, grant
  only the approved capabilities), `my_connections`, `disconnect_app` (revoke grants → the app's
  next call is refused regardless of token lifetime).
- **Breaking on staging:** the existing Claude MCP connection must re-consent once, because its
  token will now act as a connection. Production is untouched until approved.

## Increment 2 — the universal contract

`lib/connect/manifest.ts`: what an app is, capabilities (each mapped to a kernel capability + scope
kind, read/write), data in/out, actions, sync (webhook/poll), behaviour on expiry/revocation.
Validated; the consent screen renders it in plain words.

## Increment 3 — surfaces over one contract

`/api/connect/v1` (me, things list/create/read) taking the app's OAuth token, so the kernel narrows
it; a tiny JS SDK over it; MCP stays as the second surface on the same contract.

## Increment 4 — overlay

An embeddable SOLVE panel (iframe page + loader script) in the rebuilt design system, themed by the
person's look. Authenticated by the app's OAuth token via `postMessage`, **not cookies** (third-party
cookies are blocked in Safari, so cookie auth would silently fail on iPhone).

## Increment 5 — proof

Acceptance scenario with a real independent app on another origin: dynamic client registration →
PKCE authorize → persona approves on `/oauth/consent` → token → create and read a real record
through Connect → overlay renders → person disconnects in Control → the app's next call is refused.
Plus cross-user isolation and mobile/desktop. Needs DCR enabled on staging's Auth (verify first).

## Where to build

On `solve/from-zero` (the rebuilt design system the overlay must use), pending the founder's
cutover approval.
