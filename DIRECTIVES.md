# DIRECTIVES.md — founder orders for the builder

Repo: Solve-Official-. This is the canonical repo. Fresh build — nothing carries over from sovereign or sovereign-vision-fast (no code, no branches, no architecture). The vision (VISION-CANON.md) is the input, not bleed.

Standing order: at the start of every session, pull main and read this file.
Directives listed under ACTIVE are orders. Move a directive to DONE (with date)
once complete. Never edit or delete a directive — only the founder does that.

## ACTIVE

### 2026-10-03 — Build the memory kernel first
Before any Room, any feature: set up the system's memory correctly. The kernel:
- Every action is an event with provenance (who did what, when, authorized by whom).
- The ledger is double-entry (balances are derived from entries, never stored as source of truth).
- History is append-only (nothing edited, nothing deleted — corrections are new events).
- Evidence attaches to events (proof, not claims).
- Identity, authority, and permissions gate every write.
This is the stable master code. Build it clean enough to never revisit.

### 2026-10-03 — The kernel's store lives outside the repo
The repo holds the kernel's CODE. The memory itself (events, ledger, history, identities) is DATA — it lives in a dedicated secure database, separate from git. Encrypted at rest, access-controlled, backed up. Nothing in the repo reads or writes memory except through the kernel's gated interface. The founder provisions the store (dedicated Supabase project) — build the kernel against that interface, not against a local file.

### 2026-10-03 — Whop bridge Pack (after the kernel lands)
Build a Pack that connects a Whop seller's account via Whop OAuth (read their API docs first). It imports their community — members, roles, products — and generates invite links into a SOLVE World. Membership status syncs through Whop webhooks into capability grants (join on Whop = granted here, lapse there = revoked here). Every imported track record enters the kernel as a verifiable claim, not a fact. Do not start this until the memory kernel is done and tested.

## DONE

(none)
