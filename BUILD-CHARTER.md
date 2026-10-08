# SOLVE — Build Charter

**Status:** Durable decision guide for product and engineering  
**Last consolidated:** 2026-10-08  
**Purpose:** Turn the vision and app technical direction into consistent choices. This charter is stable guidance; `DIRECTIVES.md` holds current founder orders, and `BUILD_STATUS.md` tracks the changing implementation state.

## Decision order

When goals compete, use this order:

1. **Protect people and their agency.** Security, privacy, consent, and clear authority are foundations.
2. **Stay grounded in truth.** Show sources, evidence, uncertainty, assumptions, and what has actually happened.
3. **Prepare people to act.** Turn understanding into practical options, plans, and leverage.
4. **Help people coordinate.** Connect the right people, agents, skills, time, capital, information, tools, and materials.
5. **Complete useful work.** Prioritize a working outcome and observed user value over feature count or spectacle.
6. **Learn and improve.** Use real outcomes and friction to improve the smallest reusable part of the system.

## Product tests

Before building or promoting a capability, ask:

- Does this help a person or community become safer, more prepared, more capable, or more resilient?
- Is the path from user intent to useful outcome understandable?
- Can the user see who or what is acting, under whose authority, with what data, and with what result?
- Are claims, estimates, simulations, and verified outcomes clearly distinguished?
- Can the experience connect digital work to a real-world next step?
- Can the user control sharing and revoke access?
- Is this a real use case with a user or pilot, or only an impressive simulation?
- Can the capability be composed, replaced, or improved without weakening the kernel?

A feature that adds visual intensity without improving clarity, presence, trust, creative power, or task completion does not meet the bar.

## Experience bar

SOLVE should feel futuristic, spatial, alive, and personal while remaining calm, understandable, and trustworthy. It should create a sense of possibility through things people can actually inspect, edit, and do.

The adaptive home should respond to intent and context. SOV ID and avatar creation should happen early, before the main experience, without becoming a long onboarding funnel. The map, customizable identity cards, communities, 3D Worlds, agents, and workflows should form one coherent environment.

People should be able to build together. AI should make creation and coordination easier; people retain control over identity, sharing, decisions, and consequential actions. Users can start with a simple identity and a small project, then add depth—trackers, badges, shared resources, agents, spatial tools, and workflows—when valuable.

## Build progression

Keep the ambition broad and the first delivery narrow:

- Start with a meaningful user outcome and a complete end-to-end path.
- Build the identity, authority, privacy, evidence, and persistence rules needed for that path.
- Use real information or integrations when the outcome depends on the world outside SOLVE.
- Make the result editable and collaborative where the work benefits from it.
- Run a narrow real-user or founder pilot when safe; learn from actual use.
- Expand to another domain by reusing the foundation and adding domain-specific capabilities.
- Increase autonomy only when authority, observability, and recovery are clear.

“Anything” is the long-term platform ambition. It is not a claim that one agent or model can already produce safe, complete, expert-grade plans for every domain. Deliver breadth through shared workflows plus specialized models, data, tools, and human review where the work requires them.

## Engineering invariants

- The kernel owns identity, permissions, authority, event history, evidence, and ledger correctness.
- World data changes through governed interfaces; consequential changes are attributable and auditable.
- History is append-only; corrections create new events.
- Agents operate only within delegated, inspectable, revocable authority.
- External providers are adapters, not sources of ultimate authority.
- Money and rewards require explicit funding, conservation, causal attribution, and idempotent settlement.
- Recruitment alone is never a basis for rewards.
- SOV remains an internal economic primitive unless separately approved.
- Privacy controls apply to people, communities, maps, profile modules, and agent access.
- Verification is scaled to the risk and boundary changed; tests support confidence but do not replace real use.

## Boundary between canon and execution

- `VISION-CANON.md` says why SOLVE exists and what future it is building toward.
- `APP-TECHNICAL-VISION.md` describes the intended system and user experience.
- `BUILD-CHARTER.md` says how to make durable product and engineering choices.
- `DIRECTIVES.md` contains current founder orders. Follow its instruction to preserve and update directives only as authorized there.
- `BUILD_STATUS.md` records the current code, checks, deployment, and next work. Keep it factual and dated.

When implementation details conflict with the canon, surface the gap and propose a path. Do not quietly redefine the product through code.
