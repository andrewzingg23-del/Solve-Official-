> Historical source-PR contract. Current consolidated behavior, verification and gates: [staging AI integration](2026-11-11-staging-ai-integration.md).

# Built-in AI bridge for SOLVE's approved shell

**Scope:** headless provider adapter only, November 11, 2026. No new AI widget or redesign.

## Source of truth

The approved shell is `app/ui/shell.tsx` on `solve/space-presentation`: **Space / People / Apps / Control**, with Search, Add, AI, privacy, and ID always available. This new shell is NOT the legacy `app/product/shell.tsx` on `main`. Claude's console work in PR #94 is based on that legacy shell and must be explicitly adapted rather than merged into this branch wholesale.

The user's November 11 directive is to make AI available from anywhere inside the approved shell. That supersedes the earlier "an AI inside Solve not planned" entry in `docs/acceptance/STATUS.md` as a **new requested direction**, but this isolated commit does not modify historical acceptance records, decide its execution model, or claim implementation of the new UI.

## Existing reusable modules introduced here

- `lib/ai/openai.ts`: OpenAI Responses API adapter with server-supplied key and model, `store:false`, 60-second timeout, safe API error messages and response-text/usage parsing. Default GPT model is `gpt-6.1-sol`. This module must be invoked **only from server-side authenticated routes**, never with a browser-held key.
- `lib/ai/provider-choice.ts`: allowlisted current-provider/OpenAI choice contract. It is not an authorization mechanism.
- `tests/ai/openai.test.ts`, `tests/ai/provider-choice.test.ts`: isolated transport/validation tests, no live token charges.

No new dependencies, database tables, network privileges or production settings are required for this commit.

## To wire Claude's single AI console into the approved shell

1. Claude owns the *one* persistent conversation surface within `app/ui/shell.tsx`. Keep navigation exactly as approved and respect public/signed-out views.
2. Implement an authenticated, rate-limited, cost-metered server route. Resolve current location/selected Space from verified server-side permissions. Client pathname and focus are **context, not authority**.
3. Permit choice among configured model providers; actual model IDs, endpoints, keys and prices are server-owned.
4. Plug `completeOpenAIChat` into that one route, alongside a verified Claude/OpenRouter adapter. Return real results and honest unavailable states.
5. On model switch, clearly explain that approved conversation history is shared with the chosen provider; do not imply ChatGPT Plus session access, cross-provider hidden memory or access to ChatGPT's private conversation history.
6. Actions are kernel-approved commands with audit records. No model gets arbitrary write access just because a conversation succeeded.
7. E2E: signed-in user asks from Space, navigates to People without losing thread, switches provider, receives a real response, returns to a saved authorized object, and can inspect activity. Test guest denial, wrong-owner read, unconfigured provider, disconnect and model errors. Check approved design at mobile sizes.

### Blockers / release gates

- `OPENAI_API_KEY` must be provisioned as a **Preview/staging-only** server secret by the owner. OpenAI API billing is separate from a personal ChatGPT subscription.
- Staging's legacy MCP per-application scope and service-key configuration must be verified before granting models connected-data or write tools.
- Current tests and end-to-end acceptance were **not executed** as part of this GitHub file commit; CI and staging proof required.
- No production merge, database migration or public release is authorized by this patch.

Prior exploration: #94 (Claude's persistent console, legacy shell), #95 (adapter-only draft), #96 (legacy-console integration prototype, review-only).
