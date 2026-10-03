# Kernel v4 rollout: staging preflight and live runbook

Step 2 of the founder's path to one real agent task (2026-10-03). The live store has not been changed. Step 3 below runs only after the founder's explicit go-ahead.

## What was rehearsed, and where

The rehearsal ran on a local Postgres **17.10** server set up the way the store is: migrations run as a non-superuser `postgres` role that owns the kernel, and the API roles (`anon`, `authenticated`, `service_role`) are reached through a non-inheriting `authenticator`, as the Data API connects. The role attributes were read from the live project first.

A Supabase staging branch was the first choice. Two `create_branch` calls timed out and no branch appeared, which suggests branching is not available on the current plan. This build container's network policy also blocks `*.supabase.co`, so nothing here can call the store's Auth or Data API over HTTP. All store reads below went through the Supabase connector's SQL, read-only.

Repeat it with:

```
SOV_PG_BIN=/path/to/postgres-17/bin npm run test:postgres -- tests/staging/v4-rehearsal.test.ts
```

## Results

**The staging copy is the live kernel.** The three applied migrations, rebuilt on Postgres 17, produce exactly the fingerprints read from the live store (function bodies and options, columns, constraints). The live store holds one auth account (not yet linked to a kernel actor), the kernel's service actor and the genesis event; the copy holds the same kernel state.

| Fingerprint | Live store (read 2026-10-03) | Staging copy before v4 | Staging after v4 |
|---|---|---|---|
| `kernel` functions | 36, `d3c6c3f1…` | 36, `d3c6c3f1…` | 75, `fdabdcf0…` |
| `kernel_api` functions | 37, `524e8470…` | 37, `524e8470…` | 64, `521177da…` |
| `kernel` columns | 21 tables, `8bff7f8a…` | 21 tables, `8bff7f8a…` | 36 tables, `b910f3ed…` |
| `kernel` constraints | `ca3e3bbf…` | `ca3e3bbf…` | `513b75b2…` |

**v4 applies cleanly.** One transaction, as `postgres`, in 0.11 s. The genesis event is untouched and `verify_chain` passes across the boundary.

**Sign-in holds through the API roles.** A signed-in user registers once and gets the same actor on every later sign-in. `whoami` returns a human. An anonymous session cannot register, and an unregistered user is refused until it registers.

**Permissions hold.**
- `anon` cannot call any `kernel_api` function.
- `authenticated` cannot read the `kernel` schema or verify the chain.
- The service key must name the actor it acts as, and can never act as a human.
- No API role holds a table grant in `kernel`.
- A new AI companion may only read its owner's own scope.

**The whole suite runs on Postgres 17.** `npm run test:postgres` runs every kernel, loop and agent test against the store's major version, with real concurrent connections, which PGlite's single connection cannot provide. The final counts are in `BUILD-STREAM.md`.

## Defects the rehearsal found, fixed before rollout

1. **Every ledger posting or entitlement by an API caller would have failed at commit on the store.** The kernel's two deferred constraint triggers (`ledger_entries_balanced`, `entitlements_attribution_conserved`) fire at commit, after the security-definer function that queued them has returned. Postgres 17 runs them as the session role, which has no access to `kernel`. Postgres 18, which the embedded test kernel runs, runs them as the role that queued them, which hid the defect. v4 now runs both trigger functions as their owner (`alter function … security definer`; search path already pinned; they only read and raise). Nothing on the live store has posted to the ledger yet, so no history was affected.
2. **Two settlement workers racing could fail one of them.** Under real concurrency, a worker that read a settlement before another recorded and landed it saw the on-chain marker with no signature in its stale copy and threw. It now re-reads the kernel when it finds the marker, and treats a concurrent confirmation as confirmed. The money still moved exactly once in every run; the defect was a spurious error.

Step 1 (the answer service) also fixed three defects found by its failure tests; see `BUILD-STREAM.md`.

## Not covered by the rehearsal

These need the store itself, and some need the founder's dashboard:

- **Auth email and redirect.** The magic link must land on the app. Add the preview host (`https://solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app/**`) under Authentication, URL Configuration, Redirect URLs, and set the Site URL. The built-in mailer allows only a few emails an hour.
- **Data API exposure.** `kernel_api` must be listed under Data API, Exposed schemas. Without it every kernel call from the app fails, including sign-in registration.
- **Real token claims.** The kernel reads `role`, `sub` and `is_anonymous` from Supabase's JWT. The rehearsal used that shape, but only a real sign-in proves it.
- **PostgREST schema cache.** After the migration, the Data API must reload its schema (`notify pgrst, 'reload schema'`) before the new functions are callable.

## Step 3: live runbook (needs the founder's go-ahead)

1. **Freeze.** Apply exactly `supabase/migrations/20261003110000_actions_and_world.sql`, sha256 `4fa084db787a99210adeed18bcf11a93f52f98e7d9427f5ff6c05969441157cc` (126,325 bytes). Any later edit means a new rehearsal.
2. **Pre-check, read-only.** Live fingerprints still equal the "Live store" column, `list_migrations` shows three, and the store holds one event and one actor.
3. **Apply** the file through the Supabase connector as migration `actions_and_world`, one transaction. If it fails, the transaction rolls back and nothing changes.
4. **Post-check.** `list_migrations` shows four; fingerprints equal the "Staging after v4" column; `verify_chain` passes; reload the Data API schema cache.
5. **Restore sign-in (founder, dashboard).** The redirect URLs and the exposed schema, as above.
6. **Restore sign-in (app).** Link `/login` from the World again; it still exists and sends magic links. Redeploy the preview.
7. **Smoke test.** The founder signs in once: the callback registers the account as a kernel actor, and the account page shows it.

**Rollback.** There is no automated down-migration. A failed apply changes nothing. If the post-checks fail after commit, the store holds only genesis and, at most, the founder's actor, so the options are a restore from the project's backups or a reverting migration. Both are founder decisions.

## Step 4: the pilot (after step 3)

The narrowest real use: the founder signs in, creates an AI companion, explicitly delegates one capability to it in one scope, and the companion completes one useful task through the live loop. The kernel records the decision, the evidence and the consequence, and they persist across reloads. The pilot names one friction point observed in real use. The founder picks the task; a candidate is in the status report.
