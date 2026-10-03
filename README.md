# solve

App that connects humans and custom AI agent avatars to self-create environments that live on a secure blockchain coin.

Read first: [DIRECTIVES.md](DIRECTIVES.md) (founder orders), [VISION-CANON.md](VISION-CANON.md), [BUILD-BOOK.md](BUILD-BOOK.md), [docs/MONETARY-CONSTITUTION.md](docs/MONETARY-CONSTITUTION.md) (money spec). Current state: [BUILD_STATUS.md](BUILD_STATUS.md). Next: [docs/specs/2026-10-03-world-interface.md](docs/specs/2026-10-03-world-interface.md) with [docs/specs/2026-10-03-avatar-world-integration.md](docs/specs/2026-10-03-avatar-world-integration.md).

## What's here

| Path | Purpose |
| --- | --- |
| `supabase/migrations/` | The memory kernel (v1), money (v2), payments (v3), and authority, actions and the World Graph (v4): schema, gated interface, genesis |
| `lib/kernel/client.ts` | Typed client for `kernel_api` |
| `lib/kernel/server.ts` | The kernel as the signed-in user |
| `lib/chain/` | DEV-SOLVE on Solana: fixed-supply genesis, vaults, exactly-once releases, transfers, RPC gateway |
| `lib/money/settlement.ts` | Settlement worker: outbox between kernel and chain, with reconciliation |
| `lib/router/` | Payment router: venue quotes (spot, TWAP, executable, depth), route search that never forces SOLVE, atomic execution |
| `lib/money/payment.ts` | Payment worker: submit, reconcile, retry around failed venues |
| `tests/` | Kernel, money, payments, router, chain (LiteSVM) and end-to-end tests |
| `scripts/proof-of-life.ts` | Runs the monetary proof-of-life and prints each step |
| `scripts/send-bob.ts` | Sends Bob $10 on test assets and prints every route compared |
| `scripts/self-operation.ts` | Runs the self-operation loop (lost payment response → task → worker → verifier → reconciled → closed) and prints each step |
| `lib/ops/` | SOV operating SOV: monitor, task-limited worker, independent verifier, learning, change classes for build proposals |
| `lib/world/` | The World: graph model, Horizon interpreter, deixis, presentation commands, response planner |
| `lib/sandbox/` | Arcadia sandbox: the kernel in the browser (PGlite), snapshot boot and reset |
| `app/world/` | World shell: Cesium Earth, Horizon, lenses, context drawer, avatar onboarding |
| `app/` | Next.js 16 app: `/` is the World; `/money` runs the money system live; email sign-in is off for now |
| `proxy.ts` | Refreshes the auth session; sends signed-out visitors away from `/account` |

Stack: Next.js 16 (App Router), Tailwind CSS 4, Supabase (Auth + Postgres).

## The memory kernel

DIRECTIVES.md orders it first. It lives in Postgres and enforces its own rules, so no app code can bypass them.

- **Events with provenance.** Every write is an event: actor, the human an agent acts for, the grant that authorized it, the kernel clock.
- **Append-only.** UPDATE, DELETE and TRUNCATE fail on every kernel table, even for the owner. Corrections are new events.
- **Hash chain.** Each event commits to the one before it. `verify_chain()` detects any edit and cross-checks ledger rows against their postings.
- **Double-entry ledger.** Postings balance per asset; balances are sums of entries. Only an asset's issuer scope can hold accounts that create supply.
- **Evidence.** Proof attaches to events with a basis (`self_reported`, `witnessed`, `artifact`, `system_observed`, `externally_verified`). The kernel limits who may claim each.
- **Identity-gated writes.** API roles have no table access. `kernel_api` functions resolve the caller from the verified JWT and require an active grant. Revoking a grant voids everything delegated from it. AI agents start with no authority and can't exceed their owner's.

Interface (`kernel_api` schema):

| Function | Who | Does |
| --- | --- | --- |
| `register` | signed-in user | Issues the SOV ID (canonical actor) for this login. Idempotent. |
| `whoami`, `my_grants` | any actor | Who am I, what may I do |
| `create_agent` | human | An AI agent owned by the caller, with no authority yet |
| `create_service_actor` | system authority | An integration actor (e.g. a Whop sync) |
| `record_event` | grant for the event type on the scope | Any non-kernel event, optional evidence and correction link |
| `attach_evidence` | `kernel.evidence.attach` | Proof on an existing event |
| `issue_grant`, `revoke_grant` | `kernel.grant.issue` / issuer / grantee | Delegate or revoke authority |
| `claim_scope` | human or service | Own a new top-level scope such as `world:<id>` |
| `define_asset` | system authority | A unit of account and its issuer scope |
| `open_account`, `post_transaction` | `kernel.ledger.open` / `kernel.ledger.post` | Double-entry ledger |
| `read_events`, `read_evidence`, `account_balance` | `kernel.read` | Gated reads |
| `verify_chain` | service role | Integrity check over all history |

Server code acting as an agent or service passes `actAs` to `kernelClient` with the service-role key. The service key can never act as a human.

## Run it

```bash
npm install
cp .env.example .env.local   # Supabase URL and publishable key
npm run dev                  # http://localhost:3000
```

Without env vars the app runs and shows a setup notice.

## Set up the kernel store

The founder provisions a dedicated Supabase project (DIRECTIVES.md, directive 2). Never use the legacy game project.

1. Apply the migrations: `supabase link --project-ref <ref> && supabase db push`, or paste each file in `supabase/migrations/` into the SQL editor in order.
2. **Project Settings → Data API → Exposed schemas:** add `kernel_api`. Do not expose `kernel`.
3. **Authentication → URL Configuration:** Site URL `http://localhost:3000`; add `http://localhost:3000/**` and the production URL to Redirect URLs.
4. **Database → Backups:** turn on point-in-time recovery for this project.
5. Sign in once through the app, then make yourself root from the SQL editor:
   ```sql
   select kernel.grant_root(actor_id)
   from kernel.identity_links
   where provider = 'supabase_auth'
     and subject = (select id::text from auth.users where email = 'you@example.com');
   ```
6. Check integrity at any time with the service role: `select * from kernel_api.verify_chain();`

## Checks

```bash
npx tsx scripts/proof-of-life.ts   # the monetary causal chain, locally
npx tsx scripts/send-bob.ts        # Send Bob $10 through the payment router, locally
npx tsx scripts/self-operation.ts  # SOV reconciles its own lost payment responses, locally
npm test            # kernel, money, chain (LiteSVM), World and end-to-end tests; no network
npm run test:browser  # the kernel tests in Chromium, against the browser kernel
npm run typecheck
npm run lint
npm run build
```

The tests run the real migration in PGlite, a single-session Postgres. Concurrency (two writers racing for the chain lock or an account) still needs a test against real Postgres.
