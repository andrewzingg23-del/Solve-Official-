# BUILD_STATUS

Updated 2026-10-03. Branch `claude/keen-cerf-tpd7io`.

## DONE

- **Memory kernel (directive 1), code and tests.** `supabase/migrations/20261003064603_memory_kernel.sql`: events with provenance, append-only tables, SHA-256 hash chain, double-entry ledger with issuer-scoped supply, evidence with basis rules, identity-gated writes, cascading grant revocation, AI agents bounded by their owner. 35 tests pass against the real migration in an in-memory Postgres.
- **App shell.** Next.js 16 + Supabase Auth email links, brand lock applied (abyssal base, cyan accent, Archivo). Sign-in registers the SOV ID; `/account` shows the SOV ID and its hash-linked history.
- **Monetary constitution, draft 1.** `docs/MONETARY-CONSTITUTION.md`: SOLVE as common settlement asset, State economies under shared physics, kernel vs. chain non-impersonation, crossing protocol, mapping onto kernel primitives.

- **Kernel installed on the store (directive 2).** Supabase project `Solve-Official-` (`dupgybzkkbddsbaykrae`), migration `20261003064603_memory_kernel`. On the live database: genesis event present, `verify_chain` ok, `anon` has no access, API roles reach only `kernel_api`, no security advisor warnings beyond the intended "RLS with no policies".
- **Live preview wired.** Vercel project `solve` builds this branch at `solve-git-claude-keen-cerf-tpd7io-sovigrn.vercel.app` with the store's URL and publishable key.

## DOING

- Nothing in flight.

## BLOCKED

- **Two Supabase dashboard settings (founder).** Data API → Exposed schemas: add `kernel_api`. Authentication → URL Configuration: add the preview URL to Redirect URLs. Then sign in once and grant root.
- **Directive 1 not moved to DONE.** It stays ACTIVE until sign-in → SOV ID → history runs end to end on the store. Only the founder edits directives.

## NEXT

1. Run sign-in → SOV ID → history end to end on the live preview, with a screenshot.
2. Concurrency test against real Postgres: parallel event writes and parallel postings on one account.
3. Kernel v1.1 from the constitution: asset layer and class, charter and settlement event types, anchor publisher.
4. Whop bridge Pack (directive 3) once the kernel runs on the store.

## Decisions waiting on the founder

- Unit name: SOV (BUILD-BOOK §11) or SOLVE (2026-10-03 message). The legacy game also has a virtual SOV.
- Settlement toll size and whether any share burns; anchor cadence; first reward policy.
