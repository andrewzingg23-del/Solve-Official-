# SOLVE integration base — thin owned core, open replaceable ports

Status: architecture contract, not implementation or deployment. This document is an integration acceptance target for the `feature/world-multimodel-agents` draft. Preserve existing SOLVE kernel, SOV ID/Passport, Worlds, Supabase, and Next.js. Do not merge until PR #48's persisted World reply failure is resolved and this branch passes CI.

## Goal

People should bring relevant context into SOLVE once, create a World, and use any compatible model, research engine, or specialized agent inside that World. Switching providers must not erase a task, change its identity or authority, silently change its approved context, or require starting over. SOLVE retains the canonical record, not the provider.

Do **not** build another generic LLM SDK, OAuth integration system, graph-memory engine, workflow scheduler, app connector catalog, AI browser, or tracing platform when a maintained integration already does the job.

## Five owned contracts — everything else plugs into them

**1. Identity / Authority.** Actor, SOV ID, World, membership, scopes, delegations, expiry, action grants, budget ceilings. Kernel is the authority; connector access does not grant kernel permissions. No provider independently decides whether an action is allowed.

**2. ContextPacket v1.** Owner, requester, destination capability, World/task, allowed scopes, source references with versions and timestamps, original evidence pointers, selected facts and confidence/verification, token limits, and a content hash. Required before data leaves SOLVE. Keep ephemeral context separate from lasting verified memories; imported chats must be reviewed, retain provenance, and not automatically enter a shared World. The current `solve.context.v1` is a pure prototype, not a permission check. Introduce an authenticated assembly service rather than using a caller-provided `approved` flag as authority.

**3. Task / Run v1.** Task ID, World ID, actor and owner, intent, executable capability, requested provider, approved context snapshot/hash, spend and time limits, status, attempt/lease, idempotency key, dependencies, retries, cancellation, and human approval state. Persist before dispatch. Provider selection must be stored with the task, not reconstructed from the current UI setting.

**4. Capability / Connection v1.** `id`, `version`, `kind` (inference, research, tool, agent, memory enrichment, simulation, execution), declared input/output schema, required scopes and side effects, supported modalities, timeouts, health/test status, costs/limits, auth ownership, and disable/revoke action. Only owner-approved, declared capabilities can receive authorized context or issue requests. "Configured" is not "tested" or "working."

**5. Result / Evidence v1.** Task/run ID, provider/model identity, timestamp, status, output/artifact locations, sources used, claims supported, tests/independent verification, usage/cost, causal trace IDs, and reviewer decisions. A provider response is not proof of a physical fact or successful deployment. Distinguish received citations from verified claims.

All five are SOLVE-owned, schema-versioned and exportable. External adapters never own the canonical source of truth.

## Integration boundaries: prefer established solutions

| Boundary | Adopt / evaluate | Where it belongs | Avoid |
| --- | --- | --- | --- |
| Model API | Vercel AI SDK provider registry (candidate), existing OpenRouter bridge | `InferenceProvider`; multi-model aliases, tools, structured outputs, streaming, metering | Hand-coded provider transport for every future model |
| Tools / app integrations | MCP 2026-07-28; Composio (managed user OAuth + tools), or Nango if own exact category sync needed | `ToolProvider` / `ContextSource`; authorization per member | Copying tokens into prompts or rebuilding 100 integrations |
| Remote agents | A2A 1.0; native Codex, Claude Code, Muse Code connectors when available | `ExecutionProvider`; async task handoff, status, cancellation, artifact refs | Pretend a chatbot is an executing agent |
| User-to-agent events | AG-UI adapter (when streaming/progress becomes necessary) | Existing Next.js World UI receives model tokens, tool states, approval requests | A separate dashboard for each provider |
| Context / memory | Current external Passport + kernel events; Postgres full text/pgvector; evaluate Mastra memory or Zep/Graphiti for relevance and temporal contradictions | Plug-in `MemoryEnricher` and `ContextRetriever`, never competing profile truth | Importing 2,000-character chat summaries as the whole truth; autosaving model guesses |
| Durable execution | Supabase Queues/pgmq first, with authenticated worker and idempotent side effects. Evaluate Inngest if checkpointed multi-day workflows outgrow native queue. | `WorkEngine` behind persistent Task/Run contract | HTTP requests waiting for an hour; relying on a queue visibility window as exactly-once external effects |
| Authorization | Existing kernel grants; consider OpenFGA only if relationship policy complexity exceeds it | `authorize(task, actor, capability, scope)` | Duplicating permission databases |
| Observability | OpenTelemetry trace IDs; optionally Langfuse evaluations/traces with sensitive content redaction | `Evaluation / Audit` | Calling outputs verified just because a provider returned 200 |

These integrations are candidates, not mandatory dependencies. Use one product per problem where possible; keep each replaceable with a SOLVE-owned adapter and tests.

## Extensibility contract

An integration must support discovery, version check, explicit install/consent, tenant+user binding, capabilities, schema validation, bounded invocation, precise result/error, status and health, log/trace, disconnect/revoke, and export or mapping of retained artifacts. Unsupported capabilities remain unavailable in the UI, never simulated.

Model/task selection is by **capability and policy**, not only brand. One adapter can support multiple capabilities. A provider may have multiple models and agents. The same person may configure different defaults per individual profile, World and task, with a clear override precedence.

Require adapters to declare side effects (`read_only`, `writes_world`, `external_action`, `payment`, `executes_code`). Grants and human approval apply to actions, not to brand names. Treat external tool descriptions, web pages, imports, and retrieved text as untrusted data. Never let them self-authorize operations.

## Risks an integration platform does not solve for us

- Imported memories can conflict or become outdated. Keep a revisioned fact provenance graph; a newer, verified statement supersedes an older one without erasing history.
- A model switch can change output/cost or violate a user's expectations. Pin original model and context for retries; fallback must be explicitly permitted and recorded.
- Search results can contain false claims and prompt-injection attempts. Distinguish citations, retrieved content, and verification.
- Agent attempts may run twice after a worker crash. Every side-effecting tool must be idempotent or compensatable; queue delivery guarantees are not business-level exactly-once settlement.
- Remote connectors can disappear, change scopes, charge unexpectedly or have different data retention. Per-connector health, budgets, scope reviews, fallback, and a disable switch are required.
- A user may withdraw a memory or permission after it has already been transmitted. Stop future reads, revoke access, invalidate SOLVE caches and provide transparent downstream deletion limitations.
- Shared Worlds and children need separate privacy boundaries; the owner of an imported personal memory is not automatically the World owner.
- Plugin install is a supply-chain trust boundary. Version pin, review, rate-limit, and audit executable tools rather than installing arbitrary external code.
- Costs and latency increase as tools stack. Minimize default context, bound calls per turn and per task, and show the user only results and meaningful exceptions.

## Release sequence, smallest first

**Foundation repair:** Finish PR #48; prove one real Ask AI question → successful completion → saved kernel reply → refresh/readback. Remove temporary preview probe before merge.

**Thin adapters:** Replace bespoke model parsing with a typed provider interface (evaluate AI SDK), keep current OpenRouter bridge until parity passes; make a small capabilities roster with actual tested status. Validate PR #49 model selection and retry pinning before merging.

**Context ownership:** Fix import selection UI and partial-history limitation; integrate `ContextPacket v1` with external Passport reads and kernel authorization; source/version aware retrieval and export; profile / World / task boundaries.

**First durable agent:** Persist an approved development task in the kernel, queue it in Supabase, run one authorized code worker, record GitHub PR/tests and status. Make the Development Room display this truth. No simulated activity.

**Open integrations:** Add MCP tool client/server, one managed OAuth connector only when required; Perplexity research adapter with source results; optional second research provider. Add A2A/AG-UI compatibility only when a concrete agent or UI need emerges.

**Measure and adapt:** Capture redacted run traces, comparative evaluations, latency, error rates and spend; promote a new provider based on tests, not hype.

## Acceptance tests

1. A founder creates a World task, chooses Claude, and then deliberately changes to Muse/OpenAI. Same task, World history, approved context and evidence remain; the provider used for each run is visible.
2. Two members share a World; their private Passport memories are not included in shared inference, research or coding tasks without an explicit applicable grant.
3. Import a long, branched ChatGPT conversation; show what will be omitted and preserve the original or an accessible source pointer. An incorrect inferred memory can be corrected and must not reappear as verified after retrieval.
4. Kill a worker after an external side effect; replay or retry must not duplicate a PR, payment, message or settlement.
5. Disconnect an app or model; no new tool calls occur under its revoked grant. Other providers can finish the World task.
6. A first-time user reaches a productive World without configuring any advanced integrations. All new capabilities appear progressively on demand.

**Product rule:** One simple World conversation and task interface for people. An open, rigorously tested integration surface underneath.
