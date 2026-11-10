# User outcome

<!-- What can a real person do now that was previously impossible or unreliable? -->

# Visual + technical experience contract (required for UI changes)

- [ ] **Visual:** approved language/tokens and visual hierarchy, phone/desktop, user-controlled expression, empty/loading/error/success/revoked, accessibility/reduced motion (or explain why not applicable)
- [ ] **Mechanics:** actor and authority, existing source of truth/API, actual mutation/persistence/readback, failure/retry/revoke/undo, privacy (or explain why not applicable)
- [ ] **Coupling:** every visible control corresponds to real supported behavior, truthful unavailable state, or clearly marked concept
- [ ] **Evidence:** screenshots/device check and positive/negative tests where applicable, clearly distinguishing verified from unverified

Reference: the builder rules in [AGENTS.md](AGENTS.md) and the [direction](docs/direction/2026-11-10-consolidated-direction.md).

# What changed

<!-- Paths/behavior; which existing primitives were reused? What was deliberately not rebuilt? -->

# Scope and coordination

- Issue / claim:
- Base branch and exact SHA:
- Owned paths:
- Known overlap or dependency with another agent:

# Evidence (not claims)

- [ ] Relevant tests executed and results linked below
- [ ] Typecheck / lint / build executed if appropriate
- [ ] Authorization and privacy boundaries checked if affected
- [ ] Real browser / device / provider behavior checked if claimed
- [ ] Failure, retry, revoke, and recovery tested where applicable

**Observed result / links:**

**Unknown or untested:**

# Compounding knowledge

- Root cause or useful pattern:
- Added regression guard or reusable module (link):
- What future work can safely reuse:
- One highest-leverage next dependency:

# Release boundaries

- [ ] No production schema/data/secret/payment changes without authorization
- [ ] No simulated features presented as operational
- [ ] No overlap with another actively claimed scope
- [ ] Review and release permissions respected
