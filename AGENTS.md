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
- Before pushing code: run the checks relevant to the change and update `BUILD_STATUS.md` and `BUILD-STREAM.md`. Always include `npm run lint` — the workflow's lint gate fails pushes that skip it (2026-10-07: red on main at f0ae86a until lint-only fix 14b75a7). The standard GitHub workflow is the baseline code gate; don't rerun browser suites locally unless relevant or needed for integration confidence.
- Keep `BUILD-STREAM.md` current: append a short timestamped entry when work starts, a coherent slice finishes, direction changes, or a blocker appears. Include the slice, affected paths, checks actually run and their outcomes, and the next step or blocker.
- Push each completed coherent slice with its stream update; do not hold updates until the full feature is finished. If code is intentionally uncommitted or checks are still running, say so explicitly in the stream and checkpoint before switching tasks.
- GitHub Actions in `.github/workflows/build.yml` runs tests, typecheck, lint, and build on code pushes; documentation-only changes skip the build workflow. Never report a green build until the relevant workflow succeeds.
- Never override the commit author on push: Vercel blocks production deploys when it can't map the commit author to a GitHub account (2026-10-07: guest-profile merge deploy blocked under "Doris <doris@solve>", fixed by re-authoring to `andrewzingg23-del <andrewzingg23-del@users.noreply.github.com>` and force-pushing). Commits on this repo keep their default author.

## Mandatory visual AND technical experience contract (founder direction, 2026-11-07)

- Before editing **any user-visible surface**, read [docs/design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md](docs/design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md), [docs/design/approved-visual-language-20261106.md](docs/design/approved-visual-language-20261106.md), and the existing route. Approved screenshots are visual targets, **not** proof of operational identity, projects, agents or finances.
- Every issue, code PR and agent prompt for UI/UX must describe **both halves** of the same slice: (a) brand, hierarchy, responsive design, personalization, accessibility, visible empty/loading/error/success/revoked states; **and** (b) actor, exact capability, authority, source of truth, real data/operation, persistence, failure/retry/revoke, and reproducible acceptance. Complete the shared packet in the linked contract before coding, then report separately what was observed versus only proposed.
- Reuse `SolveBrand`, `app/product/approved-language.css`, and the existing kernel/World/publication boundaries. A scenic personalized Space is permitted within a readable product shell; SOV Card may retain a separate physical-object surface. The human chooses visual expression; themes never silently change privacy, identity, payment or agent permissions.
- Ship no fake successful AI actions, progress percentages, badges, payment/NFC claims, fabricated content, or nonfunctional controls to match concept art. Link real controls to real behavior and test at 375/390px and 1440px plus keyboard/reduced-motion. Preserve optional AI, a useful public identity without forced signup, and honest provider unavailability.
- Preserve module claims and separate PRs for independent lanes; no overlapping Claude security migrations, Muse-owned consumer UI or previously claimed paths. This does not change the earlier trunk conflict; consult `DECISIONS.md` and founder release approvals.

## One reusable product primitive for development AND everyday users (2026-11-07)

- **SOLVE begins with human intention, not an AI prompt or a developer workflow.** Read [docs/architecture/SOLVE-INTENTION-TO-OUTCOME.md](docs/architecture/SOLVE-INTENTION-TO-OUTCOME.md) before building agent coordination, task execution, new services or the consumer Work experience.
- The existing World plus `kernel_api.create_task`, `read_tasks`, `authorize`, `issue_lease`, `transition_task`, and kernel evidence/history are the canonical task and trust system. **Do not create a second task DB, authority store, AI memory silo, or separate developer execution platform.**
- GitHub issues, Claude Code workflows, MCP adapters and OpenClaw are **replaceable interfaces to kernel-governed Work**, not independent sources of identity, status or verified results. While integration is incomplete, label GitHub assignments as bootstrap coordination only; never claim a GitHub `@claude` mention dispatched an agent.
- Every feature must keep both sides coherent: person's actual visible state and the authorized durable outcome. A successful API call is not an independently verified real-world result. Every external actor needs separate, revocable scope and consent.
- Extract pure versioned contracts into `solve-kernel`, optional agent workers into `solve-agents`, and reusable visual components into `solve-design` only after consumer-driven tests and parity. The current deployed kernel stays authoritative during extraction.
