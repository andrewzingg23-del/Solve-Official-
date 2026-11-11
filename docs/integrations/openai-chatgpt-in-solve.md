# ChatGPT in SOLVE — staged provider integration

This is the **server-side OpenAI API** pathway for SOLVE's existing conversational surface, alongside the current OpenRouter/Claude route. It is **not** a transfer of a user's ChatGPT account, Plus subscription, memory, or conversation history.

## Configuration (staging only)
- Add `OPENAI_API_KEY` to **staging or preview** environment only, never in browser code or repository.
- Optional `OPENAI_MODEL` overrides the default `gpt-6-astra` to a model available to the API project.
- OpenAI API usage is billed separately from a ChatGPT subscription.
- Existing `OPENROUTER_API_KEY` remains the default provider and is unchanged.

## Contract
- The existing `/api/bot/chat` accepts optional `provider: "openai" | "openrouter"`.
- If omitted, it preserves `openrouter` (backward compatible).
- OpenAI requires authenticated non-anonymous SOLVE account; invalid provider rejected.
- Both providers get the same bounded SOLVE person/project/passport context and session history.
- The OpenAI Responses request uses `store: false`; browser never receives provider API keys.
- No tools are granted by choosing OpenAI: conversation remains read-only, and real actions still use the kernel.
- UI adds a minimal accessible provider select **within** the approved Space AI card.
- Conversation remains **session-only** until a separate, consented persistence contract is proven.
- Separately, SOLVE already has an `/mcp` connector for ChatGPT/Claude to access authorized SOLVE tools *from outside* the SOLVE shell; its OAuth flow needs separate verification.

## Acceptance (do not merge or deploy to production before verification)
1. Typecheck, lint, full tests, and production build in a trusted checkout/CI.
2. No-key staging route returns 503 without leaking sensitive config.
3. Unsigned OpenAI request returns 401, invalid provider returns 422.
4. Authenticated user chooses ChatGPT and gets a real API response with no key leakage.
5. Existing provider still replies as before.
6. Reload doesn't grant AI any write authority or import private ChatGPT memory.
7. Browser snapshot confirms the approved shell remains visually intact on mobile and desktop.
8. Rate-limit and cost review for multi-instance deployment before broad rollout.

**Scope:** Only provider adapter, tests, minimal chat route dispatch, provider choice in Space, and its styling. No migration, no production rollout.
