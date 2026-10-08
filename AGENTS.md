<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# solve builder notes

- Start every session by pulling `main` and reading `DIRECTIVES.md`. Active directives are orders; only the founder edits them.
- Then read `BUILD-BOOK.md`, `VISION-CANON.md`, `docs/MONETARY-CONSTITUTION.md` and `BUILD_STATUS.md`, then the founder's master spec (`docs/specs/SOVEREIGN-MASTER-BUILD-SPEC.md`) and where it differs from the vision (`docs/specs/2026-10-05-spec-vision-check.md`).
- Three builders share this repo (Codex, Claude, Manus). Claim a row in `ACTIVE-WORK.md` before starting, stay in your owned paths, and push code from your own branch where you can: the build workflow cancels a running build when new code lands on the same branch. A builder joining starts at `docs/handoff/`.
- solve is built for the founder first (`docs/plans/2026-10-05-founder-first.md`): each slice should solve a problem the founder actually has. Say which one in the stream entry.
- The app lives on one trunk, `claude/keen-cerf-tpd7io`, until the founder names another. Start side branches from the latest trunk, and merge them back (or close them) once their slice is green. Work that isn't on the trunk can't help anyone.
- One concept, one home: before adding a concept, check "One concept, one home" in `ACTIVE-WORK.md` and the spec's ontology, and extend what exists.
- `VISION-CANON.md` and `DIRECTIVES.md` change only by the founder's hand or explicit word. Propose canon changes in a stream entry or pull request description; record the founder's decisions in `DECISIONS.md` with their words.
- Kernel memory is reached only through `kernel_api` (`supabase/migrations/`). Never grant API roles access to the `kernel` schema, and never edit an applied migration; add a new one.
- Follow the founder's product order: AI should use Sovereign's governed World loop to accomplish useful work and improve the system from real outcomes. Prefer a finished user outcome or the smallest high-value blocker over more features or simulations. Label simulated evidence honestly.
- Make continuous improvement evidence-led: observe real friction, propose the smallest reusable change, verify the affected behavior and safety boundary, then review/promote according to its change class. Agents never bypass identity, grants, evidence, review or deployment gates.
- Test in proportion to risk and change. Run focused tests for the slice; test authority, identity, provenance, conservation, idempotency, funding and consent whenever a touched boundary affects them. Run browser/end-to-end checks when those boundaries change, and the full suite before promotion or release. Don't rerun unaffected expensive suites or add duplicate tests to inflate counts.
- Before pushing code: run the checks relevant to the change and update `BUILD_STATUS.md` and `BUILD-STREAM.md`. The standard GitHub workflow is the baseline code gate; don't rerun browser suites locally unless relevant or needed for integration confidence.
- Keep `BUILD-STREAM.md` current: append a short timestamped entry when work starts, a coherent slice finishes, direction changes, or a blocker appears. Include the slice, affected paths, checks actually run and their outcomes, and the next step or blocker.
- Push each completed coherent slice with its stream update; do not hold updates until the full feature is finished. If code is intentionally uncommitted or checks are still running, say so explicitly in the stream and checkpoint before switching tasks.
- GitHub Actions in `.github/workflows/build.yml` runs tests, typecheck, lint, and build on code pushes; documentation-only changes skip the build workflow. Never report a green build until the relevant workflow succeeds.
- Never override the commit author on push: Vercel blocks production deploys when it can't map the commit author to a GitHub account (2026-10-07: guest-profile merge deploy blocked under "Doris <doris@solve>", fixed by re-authoring to `andrewzingg23-del <andrewzingg23-del@users.noreply.github.com>` and force-pushing). Commits on this repo keep their default author.
