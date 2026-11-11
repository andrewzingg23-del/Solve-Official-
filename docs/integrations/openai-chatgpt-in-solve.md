# SOLVE — ChatGPT adapter and AI integration decisions (2026-11-11)

**Status:** Draft / research-backed integration proposal. No production merge, API key deployment, or E2E claim.

## Architectural decision

There is ONE intelligent interaction surface inside SOLVE, not a ChatGPT window and a Claude window.

- Claude's draft PR #94 (`claude/console`) owns the cross-route UI, keyboard activation, visible screen context, and existing chat-route contract.
- This draft PR #95 owns ONLY an OpenAI Responses API provider adapter, tests, and this documentation. It must not alter `app/product/console.tsx`, `app/product/shell.tsx`, `app/api/bot/chat/route.ts`, `app/space/personal-space.tsx`, or any other screen.
- The integration owner wires the adapter into Claude's single conversation route *after* approving/reconciling PR #94 and its tests.
- SOLVE's kernel remains authoritative for identity, permissions, persisted work, and evidence. An AI reply is not an executed action.
- An API call to OpenAI is NOT the user's existing ChatGPT account or subscription, and does not import private ChatGPT memories or conversations.

## Developer tools worth using (not installing together by default)

| Candidate | Fit | Recommendation / trigger |
|---|---|---|
| Vercel AI SDK 6 (`ai`, `@ai-sdk/react`) | Unified TypeScript provider routing, UI streaming, structured tools, MCP | **Evaluate first** if Claude's console needs robust streaming and model interchange. Do not replace its UI. |
| AG-UI protocol | Event stream for agent messages, state deltas, lifecycle, approvals | Evaluate later if adding multi-agent progress and app/agent shared state becomes cumbersome. CopilotKit UI components are optional; no second chat surface. |
| OpenAI Responses API | ChatGPT-backed conversations, function tools, MCP, streaming | Present in the proposed OpenAI adapter; start with read-only chat, then scoped tool actions via SOLVE-owned executor. |
| Claude Agent SDK | Programmatic code editing/testing in isolated environment | Developer-only sidecar; not ordinary user's personal assistant. Requires separate execution authority and audit. |
| Composio or Nango | Per-user connected account OAuth and tool catalog | Pilot only after the scoped MCP/OAuth security migration is verified. Choose ONE for initial test. |
| Inngest | Durable execution, retries, human waits and traceable steps | Add only for a measured long-running-job failure; reuse existing kernel lifecycle where sufficient. |
| OpenAI Agents SDK | Orchestration, agent handoffs and approvals | Alternative to writing advanced agent loops, not a prerequisite to basic ChatGPT chat. Don't combine multiple orchestration runtimes without a clear reason. |

Authoritative references:
- https://ai-sdk.dev/docs/getting-started/navigating-the-library
- https://vercel.com/blog/ai-sdk-6
- https://docs.copilotkit.ai/agent-spec/backend/ag-ui
- https://developers.openai.com/api/docs/guides/tools
- https://developers.openai.com/api/docs/guides/function-calling
- https://developers.openai.com/api/docs/guides/agents/sdk
- https://github.com/anthropics/claude-agent-sdk-typescript
- https://docs.composio.dev/docs/authentication
- https://nango.dev/platform/auth/
- https://www.inngest.com/docs/durable-execution

## Contract of the one SOLVE console

Input from frontend to server (untrusted): user message, screen location hint, optional selected object hint, conversation ID, and preferred model **identifier drawn from a server allowlist**. The server resolves the authenticated SOLVE identity and confirms the authorized scope. Client-provided screen hints supply context but never grant access.

Response/event kinds (proposed, not implemented here): `message_delta`, `context_label`, `capability_available`, `proposed_action`, `needs_approval`, `action_started`, `action_verified`, `action_failed`, `run_paused`, `run_resumed`. Show only states grounded in executor or kernel records; never synthesize a success event from prose.

The same persistent, user-authorized SOLVE task/project memory should be available to each model without exporting every other source by default. When someone changes models, the conversation continuity is SOLVE's responsibility; model providers don't automatically share personal memory.

Actions pass through one owned kernel command/authorization gate, not directly from generated model text to database writes. External tools must be scoped per provider + person + object + operation; sensitive effects require approval. Event payloads must be safe against prompt-injection from connected pages, messages, and files.

**Privacy/security blocker:** Staging's legacy MCP clients were reported to retain broader read scope; prior audit required per-application containment and key rotation. Do not widen external access or promote production until the actual authorization and credential state has been verified.

## What the current PR #95 contains

- `lib/bot/openai.ts`: server-only OpenAI Responses API adapter; `store: false`; server-configured model (default `gpt-6.1-sol`); timeout, sanitized provider errors, user-visible text/usage extraction.
- `tests/bot/openai.test.ts`: unit tests for request structure, message/usage parsing, no-store, and failure behavior.
- This document.

It does **not** alter the console, chat endpoint, appearance, identity, kernel, or production configuration.

### Next steps for integration owner

1. Verify PR #94's source, no overlap and real preview; accept its shell approach only with verified tests and visual contract.
2. Run PR #95 unit tests, typecheck, lint and build in a trusted checkout. Check model-specific tool compatibility and non-empty text output for ordinary user turns.
3. Integrate a minimal server-side provider dispatch into the canonical console chat endpoint. Never put a provider key in the browser.
4. Configure `OPENAI_API_KEY` in a staging-only deployment. API usage is separately billed from ChatGPT subscriptions.
5. End-to-end test a signed-in user: open console -> see current screen label -> select ChatGPT -> get a genuine reply -> navigate -> keep conversation. Test no-key, denied user, wrong-account context, and errors.
6. Add kernel-gated actions only after the owner verifies real state write/readback and denial tests for other users.
7. Do not turn on high-volume proactive calls; only purposeful, grounded suggestions. The user owns the system and can interrupt.

**Product rule:** One shell. One context and authorization model. Multiple replaceable engines. Real outcomes, not simulated competence.
