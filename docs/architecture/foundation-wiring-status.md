# SOLVE foundation implementation — as-built status

This is a factual engineering ledger, not a claim that every integration is live. Production is not automatically promoted by draft branches.

## Core reused, not reimplemented

- Existing kernel actor/World scopes/grants remain canonical.
- The new World task form calls native `kernel_api.create_task` and `read_tasks`, **not** a separate task table or event-based shadow store.
- Task creation checks the actual `task.create` grant; World write permissions do not imply executor authority.
- Each task has an authenticated World-only context snapshot (World source IDs, versions, omitted source count, a digest of the chosen shared context), never a direct personal-memory export.
- `GET /api/capabilities` returns a typed catalog with `available`, `configured_unverified`, `needs_connection`, or `disabled`. Credentials are never returned.
- `GET/POST /api/worlds/[worldId]/tasks` stores and reads real kernel tasks. Creating a task does not dispatch a worker.
- World AI reply failures now expose sanitized stage/code diagnostics; prompts and provider bodies are excluded from logs.
- The single-idea World entry and collapsible World tools from minimal UI PR #50 have been incorporated into this draft, retaining model selection and the task board.
- ChatGPT import requires selecting conversation summaries. It does NOT claim to preserve complete transcript history.

## Durable queue — staging setup only

Staging Supabase `taeikshnbcsjlgbattyp` has `pgmq` extension v1.5.1 and a logged `solve_tasks` queue, created using:

```sql
create extension if not exists pgmq;
select pgmq.create('solve_tasks');
```

One test message was sent, read and archived successfully; the queue ended with zero active messages. The `pgmq` schema and queue are not granted to `anon`, `authenticated`, or `service_role` by default. No consumer is configured. Queue write/consume access should be granted narrowly to a dedicated trusted backend worker only when it exists. Do not expose `pgmq` directly to browser clients.

**Production** `dupgybzkkbddsbaykrae`: not modified. Queue rollout must be captured as a reviewed migration before production. The current staging setup is an exploratory schema change; this document is not a substitute for a proper migration.

## Missing authorizations and real execution work

As inspected on Nov 3, 2026:
- Existing Vercel project has preview+production OpenRouter and Anthropic keys. Presence does not prove live provider calls work.
- Direct OpenAI and Meta Muse API credentials were not configured.
- No app-runtime `GITHUB_TOKEN` was configured. Connected GitHub access inside the developer conversation is **not** automatically an OAuth grant for the deployed SOLVE app.
- No external coding worker is connected. The registered `github.coding.worker` is deliberately `disabled`.
- No hosted service-to-service callback to claim/complete/verify tasks has been created.
- Perplexity API is not yet connected; the catalog offers a `needs_connection` capability.
- The external Passport OAuth implementation exists, but the new portable context builder is not a live, grant-validated cross-provider memory service.

## Next execution slice

1. Fix/verify World reply save E2E using a signed-in account, including refreshed reply readback and safe diagnostic code.
2. Verify tests and Next build of integrated branch, then preview the minimal UI without updating production.
3. Configure a least-privilege GitHub App or token and one authorized coding worker with explicit task grants, cost limit, branch protection, and approval gate.
4. Implement worker dequeue/claim, per-task context authorization, approved GitHub code changes, PR creation, tests, and signed callback receipts. Enforce idempotency of external side effects and failure recovery.
5. Add user-directed connectors behind `CapabilityDescriptor`; only install services the user actually needs, and verify health before marking available.
6. Release through tested review, not an automatic draft PR merge.

## Security invariants

Never transmit private Passport memory to a World just because it is connected. External adapters have no authority to mint grants. Treat imported messages, repository content and tool descriptions as untrusted data. Do not execute any agent on the basis of an unreviewed task alone. A queue visibility timeout does not guarantee exactly-once external effects. Unlink/revoke must prevent future reads and actions.

A first working success is: user asks inside Building SOLVE to create a change; an authorized agent produces a real PR and preview; SOLVE reads GitHub build/test evidence; the user can approve or reject; all events remain accessible after refresh.
