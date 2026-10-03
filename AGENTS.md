<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# solve builder notes

- Start every session by pulling `main` and reading `DIRECTIVES.md`. Active directives are orders; only the founder edits them.
- Then read `BUILD-BOOK.md`, `VISION-CANON.md`, `docs/MONETARY-CONSTITUTION.md` and `BUILD_STATUS.md`.
- Kernel memory is reached only through `kernel_api` (`supabase/migrations/`). Never grant API roles access to the `kernel` schema, and never edit an applied migration; add a new one.
- Before pushing: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Update `BUILD_STATUS.md`.
- Keep `BUILD-STREAM.md` current: append a short timestamped entry when work starts, a coherent slice finishes, direction changes, or a blocker appears. Include the slice, affected paths, checks actually run and their outcomes, and the next step or blocker.
- Push each completed coherent slice with its stream update; do not hold updates until the full feature is finished. If code is intentionally uncommitted or checks are still running, say so explicitly in the stream and checkpoint before switching tasks.
- GitHub Actions in `.github/workflows/build.yml` runs tests, typecheck, lint, and build for every pushed branch. Never report a green build until that workflow succeeds.
