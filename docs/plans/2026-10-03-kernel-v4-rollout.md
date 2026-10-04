# Kernel v4 rollout: staging preflight and live runbook

Step 2 of the founder's path to one real agent task (2026-10-03). The live store has not been changed. Step 3 below runs only after the founder's explicit go-ahead.

## Isolated Supabase staging copy (2026-10-04)

The founder chose to pause `sov2.0` to free a project slot. `solve-staging` (`taeikshnbcsjlgbattyp`, us-west-1, Postgres 17.11, free plan) is a separate project in the same organization. It shares nothing with the live store. `sov2.0` is paused, not deleted, and can be restored from the dashboard or with the connector's `restore_project`.

**How the kernel got there.** This container cannot reach the store over HTTP, and the repository is private, so the connector could not fetch the files. Each migration was copied into a scratch table in chunks of about 12 KB, and each chunk's length and md5 were checked against the file at commit `fd09d67`. Each migration was then applied with `apply_migration`, as `postgres`. The apply step reassembles the chunks, compares their sha256 with the file's, and executes only on an exact match. The scratch schema `rehearsal_load` holds only that migration text, and no API role has privileges on it. Dropping it needs a confirmation the connector could not get without the founder present. Drop it with `drop schema rehearsal_load cascade;`.

**Results.** Every expectation held. Nothing differed in grants, history or retry behavior.

- **Before v4, staging equals live.** The function, column and constraint fingerprints match the "Live store" column below. Both hold 1 event and 1 actor. `verify_chain` passes. The ACL fingerprints of the `kernel` and `kernel_api` schemas, functions and relations also match live, read-only from both: `c841de22…` (schema), `792be3f8…` (function), `8a1cb0df…` (relation).
- **v4 applies cleanly** in one migration, as the non-superuser `postgres`. The post-v4 fingerprints equal the local Postgres 17 rehearsal exactly (75/64 functions, 36 tables, `b910f3ed…`, `513b75b2…`). `tests/staging/v4-rehearsal.test.ts` now asserts them, so any edit to v4 fails that test. The genesis event and its hash (`7ce0958d…`) are untouched.
- **Grants after v4.** No API role has `kernel` schema usage, table access or function execute. `anon` executes no `kernel_api` function. `authenticated` is denied exactly one, `verify_chain`. Every kernel table has RLS on.
- **Sign-in through the API roles.** Registering twice returns the same actor, and `whoami` is the human. All twelve refusals hold:

  | Check | Refused with |
  |---|---|
  | Anonymous session | `KA001` |
  | Unregistered user | `KA001` |
  | `anon` calling `kernel_api` | `42501` |
  | User reading the `kernel` schema | `42501` |
  | User writing the `kernel` schema | `42501` |
  | User calling kernel internals | `42501` |
  | User calling `verify_chain` | `42501` |
  | User acting as someone else | `KA002` |
  | Service without an actor | `KA003` |
  | Service acting as a human | `KA002` |
  | Service acting as the kernel | `KA002` |
  | Session role differing from the token role | `KA001` |

  A new AI companion holds only `kernel.read` on its owner's scope.
- **The answer service's kernel path** (`scripts/staging/service-path.sql`, run as `postgres`, switching to the API roles the way PostgREST does):
  - The asker's capability query is delivered to the organization's agent.
  - The agent, acting through the service key on its own grant, answers in reply, and the answer completes.
  - Replaying the same answer key returns the same action, so there are 2 answer actions, not 3.
  - The asker sees the answer on behalf of the agent's owner.
  - After the owner revokes the agent's grant, the agent's next answer is a recorded `rejected` action.
  - The chain verifies.

  The result is identical to Postgres 17.10 locally.
- **The PG17 trigger fix works on Supabase.** `kernel.grant_root`, run as the owner, rehearsed the founder's one-time bootstrap. Then the signed-in founder defined a test asset, opened two accounts and posted a balanced transaction. The transaction committed with the session role still `authenticated`, which is when the deferred balance trigger fires. The entries persisted and the chain verified (35 events).
- **Advisors.** The only finding is the expected INFO notice: RLS is enabled with no policies on all 36 kernel tables. That is deny-all by design, since the tables are reachable only through `kernel_api`.

**One bookkeeping difference for the live apply.** `apply_migration` records the time it runs as the migration's version: staging shows `20261004001423`…`20261004004912`. Live recorded the three applied migrations under the repository's file versions (`20261003064603`, `20261003072025`, `20261003080203`). Applied the same way, v4 would be recorded on live as `20261004…`, not `20261003110000`. See step 3.

**Staging state.** The project holds test actors, a market World and the posting described above, and it uses the organization's second active slot. Since the handoff (2026-10-04), Codex has pointed this branch's Vercel preview at it. One test actor (auth subject `00000000-0000-4000-8000-000000000001`, not a real user) holds the staging root grant from the bootstrap rehearsal. `kernel.grant_root` refuses a second active root, so revoke that grant before granting root to a real staging user.

## What was rehearsed earlier, and where

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
3. **Apply** the file through the Supabase connector as migration `actions_and_world`, in one transaction. Use one `apply_migration` call whose `do` block holds the whole file as a dollar-quoted literal. The block compares the literal's sha256 with the frozen hash and executes it only on an exact match. That is the staging method without a scratch table on the live store. Any transcription error fails the hash check and changes nothing. If the apply fails, the transaction rolls back and nothing changes.
4. **Record the version (founder's choice).** The connector records v4 under the time it ran. To keep the store's history aligned with the repository, as for the first three migrations, set that row's version to `20261003110000` (`update supabase_migrations.schema_migrations set version = '20261003110000' where name = 'actions_and_world';`). The connector asks for confirmation. The alternative is to leave the row as recorded and note the difference.
5. **Post-check.** `list_migrations` shows four; fingerprints equal the "Staging after v4" column; `verify_chain` passes; reload the Data API schema cache.
6. **Restore sign-in (founder, dashboard).** The redirect URLs and the exposed schema, as above.
7. **Restore sign-in (app).** Link `/login` from the World again; it still exists and sends magic links. Redeploy the preview.
8. **Smoke test.** The founder signs in once: the callback registers the account as a kernel actor, and the account page shows it. Root authority (`select kernel.grant_root('<actor id>');` from the SQL editor) is optional for the pilot and was rehearsed on staging.

**Rollback.** There is no automated down-migration. A failed apply changes nothing. If the post-checks fail after commit, the store holds only genesis and, at most, the founder's actor, so the options are a restore from the project's backups or a reverting migration. Both are founder decisions.

## Step 4: the pilot (after step 3)

The narrowest real use: the founder signs in, creates an AI companion, explicitly delegates one capability to it in one scope, and the companion completes one useful task through the live loop. The kernel records the decision, the evidence and the consequence, and they persist across reloads. The pilot names one friction point observed in real use. The founder picks the task; a candidate is in the status report.
