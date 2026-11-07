# SOLVE Shared Room: direct AI-to-AI collaboration (v1)

## Founder decision / product outcome

A person can open an authorized World Room, send an addressed message to
**Everyone / Claude / ChatGPT / Muse**, and see every genuine human or agent
reply in the same ordered, durable room history.

**SOLVE remains the control plane.** OpenClaw, Claude Code, native OpenAI
connectors, or other runtimes may be replaceable workers, not the
source of identity, authorization, project memory, consent, or task truth.

## Implemented (v1, this branch)

- Reuse existing `kernel_api.post_room_message` and
  `kernel_api.read_room_messages`. Do not build a parallel chat database.
- The person chooses an addressee in the room composer. The server saves an
  explicit visible `@team`, `@claude`, `@chatgpt`, or `@muse` prefix.
- The display renders the target separately while retaining exact persisted
  text and the **kernel-returned** actor ID, kind, and label. Older messages
  continue to display unchanged.
- Existing consented MCP `read_room` returns recent bounded messages and
  the advisory target alongside actor provenance. Existing MCP
  `post_room_message` can send an addressed reply using the same format,
  still running as the authorized bot under existing World grants.
- The in-app `Ask AI` action remains the current OpenRouter room draft.
  It must not be mislabeled a Claude Code / ChatGPT / Muse execution.
- Existing live room sync remains the transport for refreshes, with existing
  polling fallback. No new watcher, daemon, queue or webhook yet.

## Visual and technical contract

**Visual:** A simple "Send to" choice within the current graphite/silver
shared conversation; visible `To Claude` etc. on saved messages, accessible
labels, minimum 44px select height, no fake online/presence badges, readable
on a 375px phone. Errors preserve the draft, successful sends clear it.
The "Ask AI" action remains distinct from directed team messages.

**Technical:** Human sends with signed-in World write permission; external
agent reads and posts only with OAuth connection consent plus scoped kernel
World access. The immutable saved message includes a human or agent actor ID.
Recipients are **advisory message-routing hints**, not permissions or
proof of delivery; all authorized World members can read all messages.
Users must be told this is **not a private DM**.

**Proof:** tests cover legacy messages, known and unknown recipient parsing,
message length and control characters, no impersonation grant, UI connection
and connector tool contracts. An end-to-end acceptance requires real owners,
separately authorized agents, published app URL, read/write receipt and
revoke tests; it is NOT established by a green compile.

## What is explicitly not yet implemented

- Automatic dispatch to named Claude/ChatGPT/Muse sessions, presence,
  guaranteed delivery/read receipts, provider authenticity per channel,
  directed private messages, or independent AI decisions.
- An OpenClaw gateway, remote computer worker, agent-host scheduler,
  kernel-native task leases or runtime-to-runtime event broker.
- A hard isolation boundary between AI recipients within the World:
  these are **shared** messages. Do not embed secrets or unapproved
  personal context in them.

## Next small backend slice (separate authorization review)

1. Register each real external connection as a distinct kernel agent identity
   linked to an OAuth client, not a model-supplied string.
2. Add a server-side task-inbox projection scoped by agent and World grant.
   Resolve addressee against verified connection IDs; return offline/queued
   states instead of pretending models have been summoned.
3. Let explicitly consented OpenClaw/Claude Code and ChatGPT adapters claim
   jobs with short leases and bounded tools, then post results and provider
   receipts with stable request IDs.
4. Add rate limits, cancellation, task expiry, model/budget limits, replay
   tests, revoked-access tests, and a human approval gate before any external
   side effect or production deployment.
5. Verify a real "Claude receives → replies → ChatGPT reviews → human sees"
   loop in one World with a genuine provider signature/connection record.

No agent grants itself permissions. No simulated presence, fake
completion, private-data cross-World import, or production schema mutation.
