# Security invariants

What SOLVE guarantees, each with the test that fails if it breaks. Every test named here exists and
runs in `npm test`; the kernel tests also run in Chromium (`npm run test:browser`) and on a real
Postgres (`npm run test:postgres`). If a guarantee has no test, it is not listed.

## The record

| Guarantee | Test |
|---|---|
| History is append-only and hash-linked; an edited event or a ledger row that no longer matches is detected | `tests/kernel/kernel.test.ts` — tamper evidence, genesis |
| No one, not even the database owner, can update, delete or truncate history | `tests/kernel/kernel.test.ts` — access |
| Corrections are new events; the original stays | `tests/kernel/kernel.test.ts` — events |
| A retried write with the same key returns the original; a changed payload under that key is refused | `tests/kernel/kernel.test.ts` — events; `tests/kernel/money.test.ts` — idempotency |

## Identity and authority

| Guarantee | Test |
|---|---|
| API roles never touch kernel tables; anonymous callers reach exactly `read_page`, `read_space` and `file_public` | `tests/kernel/kernel.test.ts` — access |
| People act only as themselves; the service key is never a person or the kernel | `tests/kernel/kernel.test.ts` — identity |
| A grant never exceeds its issuer; revocation and expiry cascade to everything delegated from it | `tests/kernel/kernel.test.ts` — authority |
| Authority decides, never humanness; agents start with nothing and never exceed their owner | `tests/kernel/kernel.test.ts` — agents; `tests/kernel/actions.test.ts` — principals |
| Guests get stable, isolated identities, and their things stay private from other guests | `tests/kernel/guest.test.ts` |
| Governed actions: distinct parties for quorum, named multisig signers, timelocks, no self-expansion of authority | `tests/kernel/actions.test.ts` — governance |
| A worker cannot verify its own task | `tests/kernel/actions.test.ts` — tasks |

## Things, people and files

| Guarantee | Test |
|---|---|
| Private documents never reach members without private-read authority, through any path | `tests/kernel/actions.test.ts` — world graph; `tests/e2e/shared-privacy.test.ts` |
| An invitation works once, only with the raw token, and rechecks the owner's authority when accepted; looking at it neither joins nor grants | `tests/e2e/world-invitations.test.ts`; `tests/kernel/invitation-preview.test.ts` |
| A thing's photos follow the thing's own authority; removing someone removes their access | `tests/kernel/thing-files.test.ts` |
| Confirmation is authored by the other side, never by the owner; a dispute sits beside the claim; a guessed link reveals nothing | `tests/kernel/counterparty-confirmation.test.ts` |
| A sealed memory, once erased, is gone for good; only the owner erases | `tests/bot/erasure.test.ts` |

## What is public

| Guarantee | Test |
|---|---|
| A page shows only pieces its owner ticked and still wholly wrote; a friend's contribution or a private piece never appears; withdrawing takes it offline | `tests/kernel/public-page.test.ts` |
| A Space shows only its owner's name, card look and published pages; no one else can share or alter it | `tests/kernel/public-space.test.ts` |

## Connected apps

| Guarantee | Test |
|---|---|
| An app connected before SOLVE Connect can read, and cannot change anything | `tests/kernel/connections.test.ts` |
| An app whose session was revoked is refused at once | `tests/kernel/connections.test.ts` |
| An app connected the new way acts as its own agent with only what it was given; disconnecting revokes everything | `tests/kernel/connections.test.ts` |

## Value (dormant in the product, kept verified in the kernel)

| Guarantee | Test |
|---|---|
| Ledger balances per asset; the kernel cannot create money; value moves only with the sender's authority | `tests/kernel/kernel.test.ts` — ledger |
| An obligation settles once; settlements pay only a wallet the beneficiary linked | `tests/kernel/money.test.ts` |
| A payment pays only the published recipient, within its bounds, once | `tests/kernel/payments.test.ts` |

**Known gap, stated plainly:** an app connected before SOLVE Connect can still read everything its
person can. It closes when the connector moves onto per-app agents.
