# Connecting builders to solve’s bot

**Read date:** 2026-10-05  
**Status:** Research and setup contract; no external connection was attempted in this slice.

## What solve exposes

The current app exposes one remote MCP endpoint:

```text
https://<current-staging-preview>/mcp
```

The server uses Streamable HTTP and OAuth discovery. Clients should be able to discover:

- Protected resource metadata: `/.well-known/oauth-protected-resource/mcp`
- Authorization-server metadata: `/.well-known/oauth-authorization-server`
- MCP endpoint: `/mcp`

The client does not receive a generic app session. The connector accepts a token issued to an OAuth client and resolves it to the signed-in person’s bot. The consent screen supports read-only or read-and-add access. The server-side connector keeps the person and bot authority separate, and the app records the client identity on bot-created memories.

**Important staging dependency:** the staging deployment must have the OAuth server enabled and `SUPABASE_SECRET_KEY` configured before a connected assistant can write as the bot. Without that service key, the connector can authenticate and read but cannot perform bot-side writes.

## Compatibility summary

| Builder | Official remote MCP support | Expected solve mode | Current conclusion |
|---|---|---|---|
| Claude Code | Yes: remote HTTP is recommended; OAuth is supported through `/mcp` or `claude mcp login` | Read or read-and-add after browser consent | Supported by the protocol and current endpoint; verify on staging |
| Codex CLI / App | Yes: Streamable HTTP, OAuth, CIMD and DCR are supported | Read or read-and-add after `codex mcp login` | Supported by the protocol and current endpoint; verify on staging |
| ChatGPT | Custom MCP apps are supported in Developer Mode; availability and write support are plan/workspace dependent | Usually read initially; writes require app/workspace approval and may be restricted | Possible for the founder’s eligible workspace; do not assume availability on every plan |
| Meta Muse | Official Muse page documents app Connectors, but not a user-configurable custom MCP-server flow | No verified direct setup path | Do not promise direct Muse connection yet; use Meta’s official MCP servers where applicable, or wait for documented custom MCP support |

## Claude Code

### Official facts

Anthropic’s Claude Code documentation states that HTTP servers are the recommended transport for remote MCP servers. The command form is:

```bash
claude mcp add --transport http solve https://<current-staging-preview>/mcp
```

For an OAuth-protected server, authenticate from inside Claude Code:

```text
/mcp
```

Then select `solve` and follow the browser sign-in/consent flow. Claude Code also documents:

```bash
claude mcp login solve
```

for starting OAuth login directly.

Claude Code stores OAuth credentials securely and can refresh them. If a stored token is rejected, use `/mcp` and choose re-authenticate. If a server is configured with a rejected static `Authorization` header, Claude Code reports a connection failure rather than falling back to OAuth; for solve, omit a static bearer header and use OAuth discovery.

### Recommended founder setup

1. Use the current staging preview URL, not production.
2. Add the server with the HTTP transport command above.
3. Run `/mcp` and authenticate.
4. In the solve consent screen, choose **read-only** first.
5. Ask Claude Code to call `whoami` and `get_context`.
6. Confirm the owner, bot name, and connected client shown by solve.
7. Only then reconnect or change the consent to **read-and-add**.
8. Add one low-risk memory and verify it appears in `/bot` with provenance.

### Security implications

Project-scoped `.mcp.json` configurations can be shared with a repository. Do not commit a private staging URL with credentials or tokens. A URL-only project config is safe to share, but the user must still approve the server in Claude Code. Keep solve’s default read-only behavior intact.

### Source

- [Claude Code: Connect Claude Code to tools via MCP](https://code.claude.com/docs/en/mcp)

## Codex CLI and Codex App

### Official facts

OpenAI’s Codex documentation supports Streamable HTTP MCP servers with:

- Bearer token authentication
- OAuth authentication
- Client ID Metadata Documents (CIMD)
- Dynamic Client Registration (DCR)

Codex configuration is stored in `~/.codex/config.toml`, or in a trusted project-scoped `.codex/config.toml`. The desktop app, Codex CLI, and IDE extension share this configuration.

A minimal remote server configuration is:

```toml
[mcp_servers.solve]
url = "https://<current-staging-preview>/mcp"
auth = "oauth"
```

The documented CLI flow is:

```bash
codex mcp add solve --url https://<current-staging-preview>/mcp
codex mcp login solve
```

Codex displays or uses a loopback OAuth callback during login. If the authorization server requires a pre-registered client, Codex can accept an OAuth client ID and displays the exact callback URL to register. Solve should prefer normal discovery/DCR if staging metadata supports it; otherwise the callback and client registration must be configured in the Auth provider rather than guessed.

Codex supports per-server controls such as `enabled_tools`, `disabled_tools`, and `default_tools_approval_mode`. The founder should start with read-only tools enabled and use prompt/approval mode for any write-capable tool.

### Recommended founder setup

1. Add solve as a Streamable HTTP server using the CLI or Codex App MCP settings.
2. Run `codex mcp login solve`.
3. Complete solve’s email/OAuth consent flow.
4. Start with read-only consent.
5. Ask Codex to list or call `whoami` and `get_context`.
6. Verify `/bot` shows the Codex client as connected.
7. Grant read-and-add only for a test World or a low-risk bot memory.
8. Verify the event history identifies the bot, owner, client, and World scope.

### Source

- [OpenAI Codex: Model Context Protocol](https://developers.openai.com/codex/mcp)

## ChatGPT Developer Mode

### Official facts

OpenAI’s current ChatGPT documentation says custom MCP apps are configured through Developer Mode and that full MCP support, including modify/write actions, is rolling out in beta to Business, Enterprise, and Edu plans. The exact UI and permissions may change.

The documented setup is:

1. An eligible workspace admin enables Developer Mode.
2. Open Apps settings and choose **Create**.
3. Provide the remote MCP endpoint and required metadata.
4. Choose the authentication mechanism.
5. Use **Scan Tools**.
6. Complete OAuth if requested.
7. Create the app, then enable/use it in ChatGPT.

For OAuth, OpenAI specifically calls out refresh-token support. The authorization server discovery metadata should advertise `offline_access` (or the provider’s equivalent) when refresh access is required. Without refresh-token support, the connection may expire and require reauthorization.

### Recommended founder setup

1. Confirm the founder’s ChatGPT workspace has Developer Mode/custom MCP connectors available.
2. Add `https://<current-staging-preview>/mcp` as a custom app endpoint.
3. Choose OAuth and complete tool scanning.
4. Keep the app read-only at first if the UI allows tool-level selection.
5. Verify the returned tools and call `whoami`.
6. Complete a second explicit solve consent for read-and-add only if the workspace permits it.
7. Treat all write/modify actions as approval-gated; ChatGPT may add its own confirmation or block especially risky operations.

### Important limitation

This is a workspace/product capability, not something solve can enable. If the founder’s ChatGPT account does not expose Developer Mode or custom MCP apps, do not work around it with copied bearer tokens. Use Claude Code or Codex for the first verified builder connection.

### Security implications

OpenAI warns that custom MCP servers and connected tools can increase prompt-injection risk. Solve should continue to expose bounded tools, mark read-only operations clearly, and require its own authorization even when ChatGPT has approved the app.

### Sources

- [OpenAI Help: Developer mode and MCP apps in ChatGPT](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt)
- [OpenAI: Building MCP servers for API integrations](https://developers.openai.com/api/docs/mcp)

## Meta Muse

### What is documented

Meta’s official Muse page documents that Muse can connect to apps and services through built-in Connectors, use email/calendar/Instagram and other apps, build tools, and ask permission before certain actions. The page does not document a user-facing flow for adding an arbitrary custom remote MCP server.

Meta separately documents official remote MCP servers for:

- Meta Ads
- Meta Social Technologies developer tools
- WhatsApp Business Tools

Meta says those servers are validated for Claude Desktop, Claude Code, ChatGPT Web, Codex App, Codex CLI, Cursor App, and Cursor CLI. Muse is not listed in the supported-client list for those MCP servers.

### Current conclusion

Do not claim that Meta Muse can connect directly to solve’s `/mcp` endpoint. The verified path is:

- Keep solve’s MCP server provider-neutral.
- Support Claude Code, Codex, and eligible ChatGPT workspaces first.
- Treat Muse as an unverified client until Meta publishes custom MCP-client or custom-connector documentation.
- If the founder can see a custom connector control inside Muse, test it manually with the staging URL, but record the result as Practice until authenticated activity is verified in solve’s event history.

### Sources

- [Meta AI: Muse](https://ai.meta.com/muse/)
- [Meta for Developers: Connect AI Agents to Meta with MCP](https://developers.facebook.com/documentation/mcp)

## solve-side acceptance contract

The builder connection is not complete merely because a client shows a tool list. A connection is verified only when all of the following are true on staging:

1. The client discovers the remote MCP endpoint through HTTPS.
2. OAuth completes without a manually copied access token.
3. The solve consent page identifies the person’s bot and selected access mode.
4. `whoami` returns the expected person/bot relationship.
5. `get_context` returns only owner-approved context.
6. A read-only client cannot call `remember` or other write-capable tools.
7. A read-and-add client can add exactly one low-risk memory or World piece.
8. `/bot` shows the client identity and latest activity.
9. Revoking the connection prevents the next tool call.
10. The kernel history preserves person, bot, client, scope, and event provenance.

Until these are observed in a real staging browser/client session, the builder connection is **implemented but unverified**.
