# SOLVE — two separate release gates (2026-11-11)

**Purpose:** make feedback fast *without* confusing automated tests with a real person's success. The two gates evaluate the **same exact commit**.

## Gate 1 — engineering correctness (GitHub Actions)

On a code-changing PR to the approved SOLVE branch, GitHub Actions runs `Test, typecheck, lint, build`: complete unit/kernel tests, typecheck, lint, production build, responsive product/browser checks, and AI-console browser checks when present. A failed step fails the entire gate. Screenshots are uploaded as test artifacts. Keep security/permission attack tests in the suite.

Vercel's `vercel.json` now sets `buildCommand: npm run build`. It builds each preview but **does not rerun the full kernel/unit test suite** already owned by GitHub. Vercel's build success is a deployment artifact, **not** a substitute for the GitHub gate.

The workflow covers PRs targeting `solve/space-presentation`, `codex/ai-staging-integration-20261111`, and `main`, with push verification on `solve/space-presentation` and `main`. Docs-only changes are ignored. Treat the merge SHA and the exact deployment SHA as distinct if they differ.

## Gate 2 — a real person completes an outcome (manual)

A real person, not a simulated provider or Playwright fixture, opens the **exact deployed staging preview** in a normal browser and attempts the intended task. Record the result on the PR with:
- Exact PR head SHA and Vercel preview URL (verify in Vercel's inspector that the SHA matches)
- Specific actions attempted (for example, sign in → AI → a real model reply, or create Space → add something → reopen)
- What succeeded, failed, or was confusing
- Screenshot or a link to observed evidence when safe (never paste secrets, customer data, auth state or tokens)

When the `Human outcome` workflow is installed on the **default GitHub branch**, the founder can use Actions → Human outcome → Run workflow, supply the PR number, exact commit SHA, preview URL, pass/fail and observations. It checks the PR still points at that SHA and a Vercel success commit status exists, then posts a separate `human-outcome/verified` status on the **exact SHA**. This is an explicit human attestation; it **does not** automate a live model response or replace evidence. It cannot verify the deployed URL's SHA by itself, so the human must cross-check it in Vercel. A new commit invalidates the old status.

If the manual workflow is not installed or hasn't run, the outcome is **unverified**, regardless of test count or READY status. Do not call it passed.

## Release enforcement — requires admin setup, not inferred from workflow files

The PR and workflow alone **do not enforce either gate for releases**. After reviewing this change:
1. In GitHub, require the stable `Test, typecheck, lint, build` check from GitHub Actions and `human-outcome/verified` commit status for the release branch via a branch ruleset/protection rule. Require PR review; disable bypass for normal contributors. Verify the actual named check exists before marking it required.
2. In Vercel Project → Settings → Build and Deployment → Deployment Checks, require the selected GitHub engineering and human outcome checks for **Production**. This prevents automatic production alias assignment until checks pass. Check plan/feature availability. If unavailable, disable automatic promotion and use a documented manual deployment approval instead.
3. Human testing happens on staging previews. Do not add production credentials, modify production migrations or automatically promote any deployment as part of this PR.
4. Run one deliberate test: push a change with passing CI but **no human attestation** and verify production release is blocked; then attest a real passed outcome and verify status resolves (do not promote production solely for testing).

**Until (1), (2), and the block test are actually performed, Gate 2 is recorded but not technically enforced on release.** Do not claim otherwise.

## Staging acceptance examples

For the current AI integration PR:
1. Open its exact SHA-matched staging preview as the allowlisted account.
2. Sign in (including existing-account handling); navigate across two shell destinations.
3. Open AI and ask a real, short question; observe actual provider/model label, response, no fabricated tool success, and visible error handling.
4. Reload; verify the console accurately describes session-only history.
5. A second signed-out or unauthorized session cannot access the AI turn endpoint.
6. Record each result and failures. If no real reply succeeds, Gate 2 fails, even if all simulated-provider browser checks pass.

For Living Home later: actual create → place authorized artwork → preview → save → refresh/second-device reopen → restore → collaboration boundary. Never fill screenshots with invented user activity.

## Ownership and collision rules

- This CI change should remain independent of PR #102's application logic.
- Do not merge legacy `main` UI changes into the approved `solve/space-presentation` shell.
- CI passing, deployment READY, and human outcome PASS are **three distinct recorded facts**; the two gates are engineering correctness and human outcome.
- Require staging first and explicit owner authorization for any production deployment or policy changes.
