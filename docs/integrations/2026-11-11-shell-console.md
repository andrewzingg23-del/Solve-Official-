> Historical source-PR contract. Current consolidated behavior, verification and gates: [staging AI integration](2026-11-11-staging-ai-integration.md).

# Approved SOLVE shell — one AI console (2026-11-11)

**Status:** code-only draft for preview; tests, build, and live model reply not yet independently verified.

This change stacks on PR #97, which supplies the server-only OpenAI Responses adapter. It ports the *behavior* of Claude's older console PR #94 (one continuous thread, screen-aware context, ⌘K) into the **approved** `app/ui/shell.tsx` rather than copying the old `app/product` shell or redesigning the navigation.

## What exists on this branch
- Existing approved AI pill becomes a button opening the same panel from Space, People, Apps, Control, and internal Space pages. There is still only one AI surface, and four destinations remain.
- The console remains mounted during client-side navigation and keeps current conversation state. It deliberately does **not** claim persistence across reload or devices.
- `/api/ai/turn` is an authenticated, preview-allowlisted route using the OpenAI provider adapter from PR #97. Users supply only text, bounded history, and a pathname hint. All model IDs, keys and instructions are server-owned. Requests use `store:false`.
- Current screen is named from a strict pathname grammar. If it names an actual Space, the server calls `loadCreativeWorld` using the user's Kernel session **before** including the Space's title/summary in context. Wrong-owner/unavailable Space returns 403, with no provider call.
- No model tools, database writes, code execution, invitations, payments, publication or OAuth grant modifications occur from conversation.
- When the preview is disabled, not allowed or missing a key, the UI gets an honest unavailable message. External AI connectivity via MCP is **separate**, reachable through Apps.
- The existing user-owned presentation system, four-destination shell and responsive styling are preserved.

## Preview-only cost safety
Until PR #98's durable AI meter can be applied and integrated, no paid internal model calls are permitted by default. An owner must explicitly set all of:
- `SOLVE_AI_INTERNAL_PREVIEW=1` in preview **only**
- `SOLVE_AI_PREVIEW_USER_IDS` = comma-separated Supabase Auth user IDs (not names/emails)
- `OPENAI_API_KEY` in preview **only**
- Optional `OPENAI_MODEL` (server chosen; model access must be verified)

The route additionally enforces a **process-local 8-turn/hour throttle**, not a distributed quota. Do not enable broad access without a durable, atomic per-user budget and abuse protections. The key and allowlist must never be committed or exposed in browser code.

## Manual acceptance
1. Against the exact head SHA, run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; record the actual output.
2. Verify the approved visual shell at 320/390/1440 px, light/dark, keyboard ⌘K/Ctrl+K, Escape, focus management, and mobile tab clearance.
3. Open from Space, send a request, navigate to People and back; confirm the same thread and correct page label.
4. Without preview flags, user receives 403 and **zero** provider calls; signed out/guest receives 401. Malformed path, oversized message or invalid history returns 422.
5. After allowlisting a staging account, add preview-only OpenAI key and prove a **real** reply. No claim from READY status alone.
6. Try navigating to another account's Space; even with a valid UUID, the server must reject before sending its details to the model.
7. Verify Apps retains the external connector path and no legacy shell file was merged.
8. Inspect network calls: only `/api/ai/turn` from browser; no provider key, model endpoint or unrestricted tool request.
9. After PR #98 is independently verified and applied **to staging**, integrate durable budgets, persistent consented conversation history if required, and appropriate kernel-gated capability calls as separate slices.

## Integration ownership
- Claude PR #94: previous console concept on retired `app/product` shell. Don't merge its UI wholesale.
- PR #97: headless OpenAI provider adapter (stacked base of this work).
- **This PR:** approved-shell console, read-only model conversation, screen context, preview policy.
- PR #98: separate durable-meter security hardening; not a runtime dependency of this preview-only route.

**Product contract:** One shell, one context and authorization model, multiple replaceable engines, no fabricated outcome.
