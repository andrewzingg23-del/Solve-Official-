# Branch audit — Solve-Official- (2026-10-31)

Step 0 of the One Solve run. 29 remote branches. Merge status is measured against `origin/main` (the trunk as of DECISIONS.md 2026-10-31). `+N` = commits on the branch not on main.

**Nothing is deleted without the founder's explicit OK.** This is the list and the recommendation only.

## Keep (active / parked — do not touch)

| Branch | Last commit | State | Why keep |
|---|---|---|---|
| `main` | 2026-10-10 | trunk | The One Solve trunk. |
| `claude/passport-link` | 2026-10-30 | +7, active | Step 1 working branch (passport link). PR into main pending. |
| `claude/travel-live` | 2026-10-30 | +1, parked | PR #17 (Travel on main). Parked until Step 7 / Explorer path. |
| `feature/members-only-entry-20261026` | 2026-10-26 | +4, PR #15 (draft) | Members Only gateway. Must be reworked/merged before Steps 6 & 12 so its shell change doesn't collide. Founder decision needed. |

## Recommend delete — merged into main (21 branches)

All fully merged; their work is on main. Safe to delete (recoverable by SHA).

`chatgpt/higgsfield-staging`, `codex/collaboration-rebuild`, `codex/core-vision-files-2026-10-08`, `codex/development-memory-plan`, `codex/development-memory-v1`, `codex/gateway-oidc-fallback`, `codex/immersive-world-studio`, `codex/need-to-route-network-state-spec`, `codex/release-activation`, `codex/shared-idea-space`, `codex/world-live-collaboration`, `doris/ai-community`, `doris/guest-profile`, `doris/landing-routes`, `doris/room-chat`, `manus/avatar-context`, `manus/avatar-robustness`, `manus/avatar-world-bootstrap`, `manus/start-route-clean`, `sweep/commit-author-note`, `sweep/push-checks-lint-note`.

Note: `doris/guest-profile` and `doris/ai-community` were marked "do NOT merge without parent sequencing" in ACTIVE-WORK.md but now read as merged into main — confirm their content actually landed before deleting.

## Recommend delete — superseded (unmerged but obsolete)

| Branch | Last commit | State | Why |
|---|---|---|---|
| `manus/start-route` | 2026-10-05 | +1 | Superseded by `manus/start-route-clean` (merged, #9). |

## Review before deciding (unmerged, may hold value)

| Branch | Last commit | State | Recommendation |
|---|---|---|---|
| `claude/keen-cerf-tpd7io` | 2026-10-10 | +6 | The OLD trunk (older design). Trunk line retired 2026-10-31. Confirm its 6 commits are superseded by main, then delete. Note: solve-staging previews currently build from here (Clarification #4). |
| `claude/travel-pack` | 2026-10-30 | +7 | Older Travel work (the closed PR #16 lineage, travel on the old trunk). Likely superseded by `claude/travel-live` (#17). Confirm, then delete. |
| `manus/website-integration-audit` | 2026-10-05 | +1 | A docs/audit branch. Check whether its findings were captured; delete if so. |

## Proposed action (awaiting founder OK)

1. Delete the 21 merged branches + `manus/start-route` (22 total) once `doris/guest-profile`/`doris/ai-community` content is confirmed on main.
2. Review the 3 "review" branches; delete `keen-cerf` and `travel-pack` after confirming they're superseded.
3. Keep `main`, `claude/passport-link`, `claude/travel-live`, `feature/members-only-entry-20261026`.
4. Separately decide PR #15 (Members Only): rework so its `app/product/shell.tsx` change doesn't collide with Steps 6 & 12.
