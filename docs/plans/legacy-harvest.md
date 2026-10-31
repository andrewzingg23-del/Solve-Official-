# Legacy harvest — sovereign & sovereign-vision-fast (2026-10-31)

Step 0 of the One Solve run. DIRECTIVES.md stands: "Fresh build — nothing carries over from sovereign or sovereign-vision-fast." So nothing is copied wholesale. This records what is **worth reusing as design input** and where it lands in the plan. Archiving both repos waits for the founder's explicit OK (DECISIONS.md 2026-10-31).

Repos read:
- `andrewzingg23-del/sovereign` @ `codex/recovered-source` — the legacy multiplier trading game (live at sovereign-game-six.vercel.app).
- `andrewzingg23-del/sovereign-vision-fast` — near-copy of the game plus VISION-CANON.md / VISION-UNITED.md.

## Worth reusing

### 1. XP curve → Step 8 (AI character card)
`sovereign/lib/levels.ts`. The formula the plan names:
- **`xpForLevel(n) = 25·(n−1)·n`** → L2=50, L5=500, L10=2250, L15=5250. `levelForXp` inverts it by walking up.
- XP earned only from real play, scaled by stake (1 XP / 100 SOV, min 2, max 30, +50% on a win) so dust loops can't farm levels — the same "only from real records, can't be faked" rule Step 8 requires.
- Level titles (`LEVEL_TITLES`: Rookie → Sharp → Technician → … → Living Legend) and a level-band color ramp (`levelRing`).
- **Lands as:** the math and anti-farming shape for `lib/bot/rating.ts` (Step 8). Titles are replaced by the plan's own ladder (Rookie → Operator → Closer → Sovereign); the *structure* (title unlocked by level, server-enforced, visible on the card) is the reusable part. XP in Solve must come from kernel/passport records, not trades.

### 2. Market ladder → Step 9 (games) trading challenge
- `sovereign/lib/multiplier.ts`: `MULT_LADDER = [100, 250, 400, 550, 700, 850, 1000]` — the multiplier cap unlocked by tier.
- `sovereign/lib/ladder.ts`: a universal progression grammar (tier derived, never stored, from lifetime SOV wagered) driving card frames, rooms, garage items.
- `components/OrderBook.tsx`: a real-time L2 depth ladder.
- **Lands as:** the "trading challenge" starter kit in Step 9 — **virtual coins only**, Practice-labeled, server-authoritative moves (Clarification #12). Not a money feature; it never touches the monetary constitution's real rails.

### 3. MONETARY_POLICY.md + TERMS_DRAFT.md → Step 12 (legal pages) and money rules
- `sovereign/MONETARY_POLICY.md` (v1.0): "SOV is a **virtual in-game currency** … no cash value." Matches the master prompt's money rule and `docs/MONETARY-CONSTITUTION.md` Part XV gates.
- `sovereign/TERMS_DRAFT.md` (v1.0 DRAFT): "simulated trading game … virtual currency," flagged "Requires attorney review."
- **Lands as:** source text for Step 12's Terms / Privacy / AI-disclosure pages, updated for Solve and sent for a lawyer's pass. Keep the explicit "virtual, no cash value unless the founder decides in writing" line.

### 4. Mission Control / founder view → Founder Command view (Step 7)
- `sovereign/ECOSYSTEM_ROADMAP.md` north star: **"Don't make the aspiration 'get rich playing Sovereign.' Make it: 'Become somebody in Sovereign.'"** The founder-facing operating plan.
- (No file literally named "Mission Control" in the repo; the roadmap + founder-view framing is the idea.) The founder's live Mission Control dashboard is a claude.ai artifact on the sov2.0 record (context, not code).
- **Lands as:** the Founder Command view in Step 7 — what works, what's next, what the founder must decide, across both apps.

### 5. VISION.md / VISION-CANON.md / VISION-UNITED.md → compare with Solve's VISION-CANON.md
- `sovereign/VISION.md` and `sovereign-vision-fast/VISION-CANON.md` + `VISION-UNITED.md`: the "parallel economy / become somebody" narrative.
- **Lands as:** a comparison against Solve's own `VISION-CANON.md`. **Proposed, awaiting founder OK:** any canon additions. Canon changes only by the founder's hand (AGENTS.md / DIRECTIVES.md), so this is a proposal, not an edit. First read: Solve's canon already subsumes the economic-rails vision; the one phrase worth considering as a canon line is "become somebody," which maps to the character card and verified record. **Founder decision needed.**

## Not harvested
- Game-specific UI (trade skins, multiplier wheel, order book rendering), Stripe pro-checkout, and the legacy Supabase migrations — superseded by Solve's kernel and brand. Available in the repo if ever needed.

## Proposed next actions (await founder OK — all reversible or read-only)
1. **Archive** `sovereign` and `sovereign-vision-fast` (GitHub archive = read-only, reversible). — needs OK per repo.
2. **sovereign-game deployment** (sovereign-game-six.vercel.app): keep live / redirect to Solve / pause. — needs the founder's choice.
3. **SOV2.0 + sov2.0 databases** (paused legacy Supabase): keep paused / export then delete. — needs the founder's choice.
4. **VISION canon additions:** approve or decline the "become somebody" line (item 5). — needs the founder's word.
