# RUN-PROGRESS — One Solve autonomous run

State on disk, not in my head. Re-read this + `docs/plans/MASTER-PROMPT.md` + the latest `BUILD-STREAM.md` entry after any reset, then continue from "Next action." Updated every slice.

**Run start:** 2026-10-31. **Trunk:** `main` (DECISIONS.md 2026-10-31). **Working branch:** `claude/passport-link`.

---

## WAITING ON ANDREW (blocks noted; I keep building everything else)

Nothing here is done by me — each needs your word or your hands (secrets, merges, irreversible actions).

### Blocks Milestone 1 now
1. **Merge passport PR #1** in `andrewzingg23-del/sovereign-passport` (fix/claim-lock-and-tier-rules): adds `list_projects`, which Step 1's project context needs. CI green, waiting on your merge.
2. **Vercel "solve" production env vars** (you paste the values; I never see them):
   - `OPENROUTER_API_KEY` — turns on Your AI chat.
   - `SUPABASE_SECRET_KEY` — lets /mcp act as your bot.
3. **`SUPABASE_ACCESS_TOKEN`** in your own shell, so the Step 2 migration commands can run (or run them yourself — I'll hand you the exact lines).
4. **Supabase Auth redirect URLs** must include `https://solve-sage.vercel.app/**`.

### Needs your OK before I touch (irreversible)
5. **Merge the Step 1 PR → #18** (passport-link → main) once you've seen it. Open; you merge.
6. **Production database migrations** (Step 2): staging first, then production, each after your "go." Never without you.
7. **Branch deletions** (Step 0 audit, `docs/qa/2026-10-31-branch-audit.md`): 22 safe-to-delete + 3 to review. None deleted yet.
8. **PR #15 (Members Only)**: rework or merge so its `app/product/shell.tsx` change doesn't collide with Steps 6 & 12. Your call on which.
9. **Archive legacy repos** `sovereign` + `sovereign-vision-fast` (reversible); decide the `sovereign-game` deployment and the SOV2.0/sov2.0 DBs (`docs/plans/legacy-harvest.md`).
10. **Point all previews at solve-staging** (today previews of main-based branches write to the **production** DB — Clarification #4). Recommend I propose the Vercel env change; you apply it.
11. **AGENTS.md trunk line**: change `claude/keen-cerf-tpd7io` → `main`. Proposed; your OK to edit.

### Recommended (not blocking)
12. **Supabase Pro** for the Solve-Official- project (no 7-day pausing, daily backups, PITR) — the free plan takes the live app dark after 7 idle days.

---

## Milestone 1 — "My AI knows me"
Steps 0, 1, 2, 3 (lean: context packer + project brief + energy cap), 7 (morning brief, scheduled job, push, installable PWA).

| Slice | Step | State | Note |
|---|---|---|---|
| Record decisions (a)–(d) | 0 | **done** | DECISIONS.md, 4 entries, 2026-10-31. |
| Branch audit | 0 | **done** | docs/qa/2026-10-31-branch-audit.md. Deletions await OK (#7). |
| Legacy harvest doc | 0 | **done** | docs/plans/legacy-harvest.md. Archiving awaits OK (#9). |
| Rework/merge PR #15 | 0 | **blocked** | Your call (#8). |
| Previews off production | 0 | **blocked** | Propose Vercel change; your OK (#10). |
| Passport link checks green | 1 | **done** | rm -rf .next → typecheck ✅, lint ✅ (0 errors, 8 known img warnings), test ✅ 461/461 incl. passport 5/5. |
| ~10-min passport cache | 1 | **done** | lib/passport/cache.ts + context.ts; tests 8/8. |
| Open Step 1 PR → main | 1 | **done** | PR #18 open (passport-link → main). You merge (#5). |
| Live DB + settings | 2 | **blocked — needs decision** | Prod schema is a broken partial-migration state (zero rows); staging paused. See `docs/plans/2026-10-31-db-state-findings.md`. Recommend clean rebuild (needs OK to override "never db reset"). |
| Context packer (lib/ai/context.ts, pure) | 3 | **merged** | PR #19 → main. |
| Chat system-prompt packing | 3 | **merged** | PR #20 → main. |
| Energy budget (lib/ai/energy.ts) | 3 | **merged** | PR #21 → main. |
| Installable PWA | 7 | **merged** | PR #22 → main. |
| Passport link + cache | 1 | **merged** | PR #18 → main (squashed). |
| Route wiring (packSystemPrompt into chat) | 3 | **done** | PR #25 open (soul + passport through the budget). Both halves on main. |
| Project brief + session synth + before/after numbers | 3 | **blocked** | Needs OpenRouter + passport embeddings (OPENAI_API_KEY). |
| Morning brief + cron + push | 7 | **blocked** | Needs live DB + OpenRouter + deploy for cron/push. |

## Milestone 2 — "My AI works for me"
Steps 4 (no dead buttons), 6 (kid-simple home), rest of 7, Step 11 first path (Google Calendar + Gmail). — not started.

## Milestone 3 — "My people are in it"
Steps 5 (multi-person passport), 8 (character card), Step 9 first game (sales-floor trainer), room policy engine (Personal + Team). — not started.

## Milestone 4 — "Build anything"
Steps 10 (Machines), rest of 3 (council), rest of 9, rest of 11, Kid + Teen policies, then 12. — not started.

---

## Decisions made this run
- (a) One Solve on main; (b) SOV ID is sovereign-passport; (c) legacy harvested then archived w/ OK; (d) Solve for everyone, one engine + room policies. All in DECISIONS.md 2026-10-31.

## Open proposals (my judgment, flagged for you)
- VISION canon: add a "become somebody" line? (legacy-harvest.md item 5.)
- AGENTS.md trunk line change (#11).

## Merged into main (2026-10-31)
- **#19** context packer · **#20** chat system-prompt packing · **#22** installable PWA · **#18** passport link + cache + Step 0 docs (squashed) · **#21** energy budget. All five Milestone-1 code/doc PRs are on main.

## Open PRs (await founder merge)
- **#25** claude/chat-route-wire → main — wire passport + soul through the budget in the chat route. Bot suite 135/135.
- **#23** public-entrance audit (doc). · **#24** Step 2 DB runbook (doc). · **#15** Members Only — **hold** (not during Milestone 1).

## Blocker needing your decision — the live database
Prod `Solve-Official-` schema is a **broken partial-migration state** (objects from #4/#5/#7 partly present, tables from #4/#9/#10/#14 missing), **zero rows**. A plain `supabase db push` would fail on #5. Staging is **paused**. Full forensics + options: `docs/plans/2026-10-31-db-state-findings.md`. **Recommended: clean rebuild** (safe at zero rows; needs your OK to override "never db reset"), rehearsed on a resumed staging first.

## Next action
Merge #25 (route wiring). Then the live path waits on you: (1) choose the DB path (clean rebuild recommended) + resume staging; (2) paste `OPENROUTER_API_KEY` + `SUPABASE_SECRET_KEY` in Vercel + add the Auth redirect URL. With those, I run staging → verify → your go → production, then prove the live app on your phone, and build Step 3 synth/brief + Step 7 morning brief (cron/push) against the live services.
