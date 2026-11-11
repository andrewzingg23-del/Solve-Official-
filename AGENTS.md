<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# SOLVE builder rules

Read first, in order: `docs/direction/2026-11-10-consolidated-direction.md` (the governing direction),
`docs/direction/2026-11-11-platform-layers.md` (what already exists, and what does not),
`DECISIONS.md` (the founder's decisions, in their words), `SECURITY-INVARIANTS.md`, and
`docs/acceptance/STATUS.md` (what works, and how it was verified). Only the founder changes the
direction; record their decisions in `DECISIONS.md` with their words.

**Scope**
- Five products — Card (ID), MySpace (Space), Bench, Control, My AI — on one foundation. Home is the doorway. Add no sixth.
- One concept, one home. Before adding anything, find where that concept already lives and extend it.
- One consumer experience in development at a time. Security fixes are a separate, bounded track.
- Keep only what is structurally needed and has integrity. Code nothing reaches, and docs nothing governs, are deleted (git keeps them).

**The kernel**
- Reached only through `kernel_api` (`supabase/migrations/`). Never grant API roles the `kernel` schema. Never edit an applied migration; add a new one. Don't redesign it without a verified need.
- Staging first. Production changes only with the founder's explicit approval.

**Honesty**
- No fake success, progress, badges, payment or NFC claims, or controls that do nothing. Say plainly what is unavailable.
- Claims, proof and confirmation are different things, for people and AI alike. Label simulated evidence as such.

**Visual standard**
- Use the rebuilt system (`app/ui/`): the card sets the standard; the person's colours shape their environment; contrast is computed, never hoped for. Test at 320/390 and 1440, with keyboard and reduced motion.

**Verifying and shipping**
- Test in proportion to the risk. Any change touching identity, authority, privacy, publication or files gets an attack test.
- Before pushing: `npm run typecheck`, `npm run lint`, `npm test`, and the browser checks the change affects (`npm run test:product`, `npm run test:acceptance` against staging). Never report green that you didn't see.
- Append a short entry to `BUILD-STREAM.md` for each coherent slice: what changed, where, the checks you ran and their results, and what's next.
- **The development trunk is `solve/space-presentation`.** Branch every slice from it and target it with every pull request. `main` is 47 commits behind it and 0 ahead (2026-11-11), and 30 of 43 open pull requests target `main` because this file never said where to branch from — two AI builders guessed, and two pull requests were discarded over it. If the founder names another trunk, that one wins and this line is wrong.
- Push each finished slice from a side branch; merge it to the trunk only with the founder's word. Never override the commit author (Vercel maps it to GitHub to deploy).
