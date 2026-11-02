# Seamless guest access implementation plan

Goal: Let the founder create projects, Worlds and communities without email sign-in, with persistent isolated ownership.

Architecture: Establish a unique Supabase anonymous authenticated session in the request proxy, persist its cookie before rendering, and register its canonical kernel actor. An additive migration removes the explicit anonymous-session rejection from register and resolve_caller while preserving subject matching, actor identity, grants, RLS and function ACLs. Existing sessions are retained.

- [x] Reproduce the kernel rejection with an anonymous Auth session.
- [x] Add migration and request-session bootstrap; retain callback/API boundaries and login switch.
- [x] Test guest registration idempotency, cross-user denial, ordinary-account continuity, cookie propagation and failure behavior.
- [ ] Verify guest project/community create and reload, full tests, typecheck, lint and production build.
- [ ] Activate provider and additive migration on the correct project; commit and deploy only with passing checks.
- [ ] Verify actual live guest create, save, reload and second-session isolation.

Provider inspection: production Anonymous Sign-ins is disabled. Its browser setting change requires action-time confirmation under the computer-use policy. No production setting changed during implementation.
