# SOLVE — Compounding Development Loop

**Operational status:** Proposed process; see [Control Room #67](https://github.com/andrewzingg23-del/Solve-Official-/issues/67). This is a **workflow**, not an autonomous runtime. No agent is launched just by reading this file.

## Objective

Reduce elapsed time from **human intent → real, independently verified user outcome**. Preserve the founder's full SOLVE vision: standalone SOV ID/card, personal expression, persistent creations, optional AI, collaboration, external services, scoped identity and authority. Do not trade truth or safety for output volume.

More AI agents are **not** the optimization target. Higher verified useful outcomes per unit of human attention and engineering time are.

## The five compounding assets

Only create one authoritative home for each asset. Link them; do not fork their meaning into parallel assistant memories.

| Asset | Source of truth | What compounds |
| --- | --- | --- |
| Vision, founder decisions, constraints | `DIRECTIVES.md`, `VISION-CANON.md`, `DECISIONS.md`, `SECURITY-INVARIANTS.md` | Avoid revisiting settled decisions; preserve safety |
| Existing implementations | Git commits, current `main`, PR diffs, real deployment hashes | Reuse working capabilities rather than rebuild |
| Observations and progress | `BUILD-STREAM.md`, checks, deployment evidence, issue/PR comments | Know what is proven, broken, unknown and blocked |
| Reusable implementation patterns | Approved existing modules/tests + reviewed code | Every solved defect becomes reusable functionality or a regression guard |
| Work ownership and next decision | `ACTIVE-WORK.md`, scoped GitHub issues, [#67](https://github.com/andrewzingg23-del/Solve-Official-/issues/67) | Minimize duplication and human coordination |

**Existing governance conflict:** `DECISIONS.md` dated 2026-10-31 names `main` as canonical; `AGENTS.md` still names an old trunk. Do not silently change canonical instructions. Use the founder's later explicit decision for new independent branches and escalate before changing governance documents.

## Single fast cycle

1. **Observe.** Inspect actual remote SHA, open PRs, owned issues, tests, deployed preview, prior lessons and relevant user experience. If unavailable, label it unknown.
2. **Select.** Choose one measurable user result and identify the *single highest-leverage constraint*. Prefer removing one shared blocker to creating another disconnected feature.
3. **Claim.** Post `CLAIM | agent | issue | branch | owned paths | user outcome | required proof` in the issue. Update `ACTIVE-WORK.md` on the working branch when required. If scopes overlap, reassign or serialize; never race edits.
4. **Build.** Make the smallest complete vertical slice through real UI, authorization, persistence and failure behavior. Reuse existing kernel and providers.
5. **Verify.** Run tests proportional to risk, lint/typecheck/build where relevant; check real browser/device where needed. `READY` preview proves a build state, not end-to-end user satisfaction.
6. **Review.** Have a different agent challenge assumptions, privacy boundaries, regressions, product friction, and independent utility. Distinguish reviewer reasoning from executed tests.
7. **Capture.** Leave behind linked commit/PR, recorded test output, the failure mode and a regression test or a reusable code pattern. Append meaningful evidence to `BUILD-STREAM.md`; don't add another unreviewed principle to canon.
8. **Handoff.** Record one next action and precise blocker. Release ownership when done; allow another agent to pick up without recreating context.

### States (do not skip)

`unclaimed → claimed → implemented → tests run → preview verified → reviewed → release authorized → user outcome confirmed`

A failed check moves the task back to a diagnosed blocker; it is not silently retried. Every claim of completion must say which state is proven and which remains unknown.

## Agent lanes

**Claude — implementation:** system architecture, test repairs, shared objects, integration correctness and backend/frontend code in a claimed scope. It may open PRs, not silently move to production.

**Muse — experience:** card and Space usability, physical-card spec, first-tap UX, actual browser/device acceptance and actionable UI/interaction patches on disjoint paths.

**ChatGPT — independent systems reviewer:** reconcile evidence, audit dependencies, identify the next constraint, fix disjoint nonproduction defects when authorized, update Control Room #67 and summarize decisions.

No agent has global authority. Another model's words are not an execution receipt. The active platform may end sessions or limit credits; work resumes from GitHub evidence, not supposed uninterrupted memory.

## Small, durable work packet

Use a GitHub issue and the PR template. A task should fit in a bounded PR:

```text
USER OUTCOME: what a stranger can really do after the change
BASE: canonical branch, SHA, known working baseline
OWNER: agent and paths
CHANGE: minimum code, tests, or consumer correction
PROOF: tests, preview, real browser/device observations; distinguish simulated
LEARNING: failure mode, reusable invariant and linked regression guard
NEXT: one highest-leverage unowned action
```

**Never pass secrets, private customer data, family data, full conversations, or raw untrusted connector content to agents as shared learning.** Share only authorized, necessary project context.

## Time compression, not false speed

Optimize by removing idle handoffs and duplicate investigation, not by deleting checks.

- **Parallelize** independent work: engineering correctness, consumer QA, and independent review.
- **Serialize** database migrations, identity/authorization changes, overlapping files and release promotion.
- **Kill stale efforts** when they duplicate already merged code or no longer affect a real user outcome; capture the reason.
- **Reuse tests**: when a defect is fixed, add an appropriate regression test so the same work is not repeated.
- **Cost-aware runs**: test affected surfaces locally, run full suite at review/release gate, don't spam preview builds on each tiny commit.
- **Keep consumer and physical hardware on parallel paths** with explicit separate launch gates.

## Metrics to review at least weekly

Record baselines and trends in Control Room #67 or linked evidence, **not fabricated averages**:

| Measure | Meaning |
| --- | --- |
| Time-to-first-verified-outcome | Elapsed time between accepted user task and verified working result |
| Unblocked work ratio | Time spent moving a user outcome versus waiting on a human/tool |
| Rework / revert rate | Fixes or PRs that needed rework due to missed constraints |
| First-pass review acceptance | Fraction of bounded PRs passing required review without major defects |
| Founder interventions | How many times routine work required founder coordination |
| Repeat failure recurrence | Whether previously fixed classes of defect return |
| Useful user tasks completed | What real people actually accomplished with released SOLVE |

An unmeasured quantity is **unknown**, not zero or excellent.

## Current first bottleneck

Read [PR #64](https://github.com/andrewzingg23-del/Solve-Official-/pull/64), [Claude #65](https://github.com/andrewzingg23-del/Solve-Official-/issues/65), [Muse #66](https://github.com/andrewzingg23-del/Solve-Official-/issues/66), and [SOV Card #63](https://github.com/andrewzingg23-del/Solve-Official-/issues/63). The SOV public-ID Vercel preview moved from failed to READY; independent validation, current PR review and final release requirements still matter.

**Success condition:** a previously unfamiliar visitor can actually open a published SOV identity and save an approved contact, and the owner can revoke exposure. This is not declared done from a screenshot or a green build alone.

## Boundaries

No bypass of account credits, code review, human permission, production release controls, or security checks. No real-money, token, credential, domain, card-manufacturer purchase, or private user data operation without the appropriate authorization.

**The intelligence compounds only when each iteration leaves a real, reusable, verified improvement.**
