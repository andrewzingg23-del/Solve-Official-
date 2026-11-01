# Step 2 — live database runbook (2026-10-31)

Exact commands to activate the Solve databases safely, **staging first**. Written from the real migration set (14 files in `supabase/migrations/`). Follows the One Solve plan Clarification #5 to the letter.

**Hard rules (do not break):**
- **Never `supabase db reset`.** It drops data.
- **Never `db push` before repairing history** — the first three migrations already exist by hand; a push without repair re-runs them and fails.
- **Staging (taeikshnbcsjlgbattyp) fully green before production (dupgybzkkbddsbaykrae).** Production waits for your explicit "go."
- Secrets: **never pasted in chat.** You export `SUPABASE_ACCESS_TOKEN` in your own shell; Vercel keys you paste in the Vercel dashboard.

## The migration set
| # | File | State on prod/staging |
|---|---|---|
| 1 | `20261003064603_memory_kernel.sql` | exists (applied by hand) |
| 2 | `20261003072025_monetary_proof_of_life.sql` | exists (applied by hand) |
| 3 | `20261003080203_payment_router.sql` | exists (applied by hand) |
| 4–14 | `20261003110000_actions_and_world` … `20261009060000_person_profile` (11 files) | **to apply** |

The 11 to apply: `20261003110000_actions_and_world`, `20261004040000_erasable_content` (kernel v5 — the passport link + memories need this), `20261004040100_bot_presence`, `20261004040200_world_live_collaboration`, `20261005070000_idea_graph_relations`, `20261009010000_shared_idea_space`, `20261009020000_world_invites_and_revisions`, `20261009030000_room_reply_status`, `20261009040000_private_room_sources`, `20261009050000_room_boundary_guards`, `20261009060000_person_profile`.

## Prerequisite
```bash
# In YOUR shell (not chat). A personal access token from supabase.com/dashboard/account/tokens
export SUPABASE_ACCESS_TOKEN=sbp_********************************
# From the repo root:
cd /path/to/Solve-Official-
npx supabase --version   # or the installed supabase CLI
```

## A. Staging first (ref taeikshnbcsjlgbattyp)
```bash
# 1. Link to staging (there is no supabase/config.toml; link writes it).
supabase link --project-ref taeikshnbcsjlgbattyp

# 2. READ-ONLY: confirm the first three migrations' objects exist exactly.
#    Inspect the kernel schema and kernel_api functions before changing anything.
supabase migration list                      # what the remote history table shows
#    Then a read-only object check (psql or the SQL editor):
#      select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
#        where n.nspname='kernel_api' order by 1;
#      select tablename from pg_tables where schemaname='kernel' order by 1;
#    Expect the memory_kernel + monetary + payment_router objects, and an EMPTY
#    history table (they were applied by hand).

# 3. Repair history for the 3 hand-applied migrations ONLY (after step 2 confirms them).
supabase migration repair --status applied 20261003064603 20261003072025 20261003080203

# 4. Dry-run the remaining 11 — show the list, STOP, send it to the founder.
supabase db push --dry-run
#    Expected: the 11 files above, in order. If the list differs, STOP and report.

# 5. Only after the founder OKs the dry-run list: push.
supabase db push

# 6. Verify.
npm run test:postgres        # the repo's real Postgres checks (needs a reachable DB)
supabase migration list      # history now shows all 14 applied
```

## B. Production (ref dupgybzkkbddsbaykrae) — only after staging is green AND the founder says go
Identical steps, swapping the ref:
```bash
supabase link --project-ref dupgybzkkbddsbaykrae
# read-only confirm the 3 exist → repair the SAME 3 → db push --dry-run → founder OK → db push → verify
```

## C. Vercel settings (founder pastes values; never in chat)
In the **"solve"** Vercel project → Settings → Environment Variables (Production):
- `OPENROUTER_API_KEY` — turns on Your AI chat.
- `SUPABASE_SECRET_KEY` — lets `/mcp` act as the person's bot.

Supabase → Authentication → URL Configuration → Redirect URLs: add `https://solve-sage.vercel.app/**`.

Previews currently point `NEXT_PUBLIC_SUPABASE_URL` at **production** — before real use, repoint preview to staging (separate change, founder OK).

## D. Recommended
- **Supabase Pro** for the Solve-Official- project: the free plan pauses after 7 idle days (the live app goes dark). Pro adds daily backups and point-in-time recovery.
- Before production push: a backup / PITR checkpoint.

## After this runs
The sealed passport link (kernel v5 `seal_key`/`unseal_keys`/`destroy_key`), memories, and the whole redesigned product work against a live kernel. Then: prove on the phone — email sign-in, save the AI, add a memory, Connect your passport, a chat that knows your ventures.
