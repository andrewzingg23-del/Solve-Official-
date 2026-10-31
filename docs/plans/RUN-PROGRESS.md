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
5. **Merge the Step 1 PR** (passport-link → main) once you've seen it. I open it; you merge.
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
| ~10-min passport cache | 1 | **in progress** | Add per-person cache in lib/passport/context.ts (plan Step 1/2). Next. |
| Open Step 1 PR → main | 1 | **in progress** | Opening now; you merge (#5). |
| Live DB + settings | 2 | **blocked** | Needs #1–#4, #6. |
| AI engine first slice (context packer, project brief, session synth) | 3 | todo | Pure/tested; buildable without secrets using fixtures. |
| Morning brief + cron + push + PWA | 7 | todo | Brief logic buildable; push/cron need live deploy. |

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

## Next action
Add the ~10-min passport context cache (lib/passport/context.ts), re-run focused tests, then open the Step 1 PR into main and send the Milestone 1 message. Then build the Step 3 context packer (pure, fixture-tested — no secrets needed) while blocked items wait on Andrew.
