# Claude Code — SOLVE high-leverage execution runbook

**Status:** manually triggered GitHub workflow prepared 2026-11-07, **NOT yet running**. The new private repositories contain boundary documents but no running services. This runbook is an implementation entrypoint, not new founder canon.

## Why this exists

Each Claude run should consume the latest verified state, perform **one bounded change**, prove the result, and leave the next worker a better starting point. No single Claude session or repository owns the complete SOLVE vision; the kernel remains authoritative. This is the safest bridge until genuine in-app agent task claims are independently deployed and tested.

## First two phases

**Phase A — Clear consumer/security dependency first:**
- Existing issue [#65](https://github.com/andrewzingg23-del/Solve-Official-/issues/65) and PRs [#64](https://github.com/andrewzingg23-del/Solve-Official-/pull/64), [#72](https://github.com/andrewzingg23-del/Solve-Official-/pull/72), [#70](https://github.com/andrewzingg23-del/Solve-Official-/pull/70), [#71](https://github.com/andrewzingg23-del/Solve-Official-/pull/71) form the critical path.
- Audit first: read exact current PR and Vercel/Actions status; review the in-flight true-anonymous public-identity RLS fixture without editing files already claimed by another worker; repair remaining independent harness/build issues in a scoped PR.
- Test true anon published-card read, hidden drafts, owner-only writes, revoked link, and real signed-out recipient. Do not promote production or apply remote schema as a side effect of this workflow.
- Product outcome is one actually usable published digital card, not an increasing count of PRs.

**Phase B — Build the reusable work engine:**
- Proposed [ADR-0001 / PR #74](https://github.com/andrewzingg23-del/Solve-Official-/pull/74) maps ecosystem boundaries; [PR #73](https://github.com/andrewzingg23-del/Solve-Official-/pull/73) is an addressed-message UI/MCP improvement, **not** an active multi-provider worker.
- The first extraction to `solve-kernel` is **typed contracts and contract tests**, not database/migration ownership. The first `solve-agents` execution is a disposable, bounded, authorized read→reply task with verifiable actor provenance, not an unrestricted OpenClaw gateway.
- `solve-design` publishes shared tokens/components only after actual consumer parity. It is a package, not a service.
- Cross-repo dependencies must use versioned schemas and tests; never make multiple running kernels.

## How to activate Claude GitHub Actions once

1. Install/authorize the official [Claude GitHub app](https://github.com/apps/claude) for the exact repository you want Claude to work in (least privilege).
2. On a trusted computer running Claude Code, generate an OAuth token via `claude setup-token` if eligible, or use an Anthropic API key through an explicitly configured alternative workflow.
3. In **GitHub repository Settings → Secrets and variables → Actions**, create a secret named `CLAUDE_CODE_OAUTH_TOKEN`. Never put the token in a chat, issue, source file, or PR.
4. Ensure the scoped workflow `.github/workflows/claude-scoped.yml` is reviewed and merged to `main`; this workflow is **manual-only**. Select an **open** issue tagged `claude-ready` with a narrow, non-overlapping owner/acceptance packet.
5. Actions → **Claude - Scoped SOLVE Engineering** → Run workflow → select `main`, issue number and `audit` first, then `implement` after reviewing the audit. Failure without a configured secret is expected and must never be circumvented.

This setup **does not** require storing the token in SOLVE or giving an LLM administrative production credentials. Claude Pro alone is not evidence that the GitHub workflow is authenticated; only a successful authorized run is.

## Claude's required issue packet

Every `claude-ready` issue must state:
- Human outcome, actual user and why this slice removes a dependency.
- Canon / current exact repo, base commit, active PRs, known CI and private data boundaries.
- Visual outcome, approved tokens, 375/390/1440px handling, accessible error/empty/loading states (for user-facing UI).
- Technical path: actor, permission, source of truth, command, state, receipt, idempotency, failure/revoke/undo.
- Exact owned files or module, external dependencies, disallowed edits, no direct main modification.
- Positive and negative checks plus build gate; what can be independently inspected.
- One next dependency and reusable test/contract derived from the result.

**Claim:** GitHub issue labels are human coordination, **not** a kernel lease or cryptographic authorization. Actual execution permissions remain those of the GitHub workflow/app token and the protected repositories. A manual issue task is not automatic service delivery.

## Shared iteration record

`OUTCOME / BASE / CHANGE / CODE LINK / TEST COMMANDS + RESULTS / VERIFIED USER RESULT / FAILED OR UNKNOWN / VISUAL REVIEW / REUSABLE LESSON / NEXT`

When work fails, leave a diagnostic and bounded next action instead of retrying forever. Do not spend more model budget merely to reiterate the plan.

## Safety and release

- No production migrations, external payment, unapproved OAuth grants, secret exposure, self-recruiting agents, arbitrary remote command execution, self-merge or permission expansion.
- Preserve World grants, kernel actor provenance, append-only history, task idempotency and explicit founder approvals.
- Run a separate deterministic CI gate and independent review; the action's own completion is not test evidence.
- If current `AGENTS.md` historical trunk wording conflicts with newer `DECISIONS.md` and Control Room #67 indicating `main`, stop and resolve that specific conflict rather than silently reverting product history.

**Success criterion:** Claude leaves a reproducible implementation and a reusable verification guard, making the following run smaller and more accurate.
