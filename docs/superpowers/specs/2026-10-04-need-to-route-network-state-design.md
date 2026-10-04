# Need-to-Route: Individual Value and Network-State Growth

Status: Founder-approved direction; design submitted for review. No product code is included in this change.

Date: 2026-10-04
Base reviewed: claude/keen-cerf-tpd7io
Vision source: VISION-CANON.md
Build constraints: DIRECTIVES.md, BUILD-BOOK.md

## 1. Purpose

Design the first product path that turns an individual's need and experience into a useful, evidence-bearing route through Sovereign. Distribution should emerge from that product path: people find value, complete work, share proof when they choose, and invite people whose participation is actually needed.

The five-to-ten-year objective is infrastructure for durable, user-created economic communities and eventually interoperable network states. The near-term product remains narrow. A person should receive useful value before being asked to recruit, publish, pay, connect an assistant, or join a larger community.

## 2. Vision alignment

This design preserves the founder's core:
- The person and their own World are the center.
- A person asks for a way; Sovereign finds and explains viable routes.
- Rooms, Sector Packs, and providers are composable capabilities, not a forced app funnel.
- Consequential action follows the existing permission, policy, approval, capability, provider, verification, and event path.
- The durable kernel remains identity, authority, permissions, events, ledger, provenance, history, and evidence.
- SOV has reasons to use before any reason to trade. Public token activity, custody, credit, yield, land, and real-money treasury features remain separately gated.
- Creation stays open to people. Distribution earns trust through real usefulness.

The long-term network state is not a launch screen or a token. It is a later result of people reliably meeting needs, producing verified value, governing shared systems, and sustaining an economy together.

## 3. Current project state and constraints

- The current active application branch is claude/keen-cerf-tpd7io. Main presently holds the founder canon and build documents; the app code is on the active working branch.
- The existing first-run screen asks how to shape the person's avatar. It does not yet ask what the person needs, what they know, or what they can contribute.
- The current Build Book proposes verified outcome records for trading-signal sellers as the first market, with possible adjacent markets in ecommerce, courses, coaching, and agencies. This remains a market hypothesis until customer evidence supports it.
- The current critical-mass plan proposes a small hand-picked circle and co-op outcomes. Its adoption numbers are estimates, not observed traction.
- The app has World, bot, kernel-backed memory, and collaboration work underway. The current build status says staging sign-in and outside-assistant use have not yet been demonstrated with real users.
- There is an open draft PR for the World idea graph and scoped collaboration. The new path should reuse those Worlds and grants rather than create a parallel social or profile system.

Before recruiting beyond a controlled pilot, verify the staging sign-in, identity attachment, permissions, and assistant connection path. Do not expose production data or real-world side effects during that verification.

## 4. Product thesis

Sovereign should help a person answer three questions:
1. What am I trying to accomplish?
2. What experience, skills, time, or resources do I bring?
3. What is the most useful next step for me?

The system returns a small number of actionable routes, explains why each fits, and lets the person choose. A selected route creates or updates a private World with the goal, open questions, next action, needed roles, and evidence that would show progress.

The route is a product object that can be tested and improved. Needs and experience are owner-controlled context; they are not hidden advertising attributes or global status scores.

When no credible route exists, make the gap useful: tell the person what is missing, offer a known workaround or human handoff if one exists, and ask before sharing the need as a product signal. Explore existing providers and integrations before proposing new software. Treat each untried route as a hypothesis until a small, honest test produces evidence.


## 5. User journey

### 5.1 Entry

Offer three plain-language starting points:
- I need help achieving something.
- I have a skill, resource, or experience I want to put to use.
- I am exploring and want to see what is possible.

Always allow a free-text description and a skip path. Ask only for missing information needed to recommend a safe first step.

### 5.2 Need and experience context

Capture only what is useful for the chosen route:
- Desired outcome and timeframe.
- Relevant experience, clearly marked as self-described.
- Skills, resources, or capacity the person elects to offer.
- Optional constraints such as location, availability, price range, or accessibility.
- Visibility choice for each item.

Experience is contextual: someone can be new to one activity and expert in another. A person may later attach evidence to an experience claim. Evidence-backed claims must remain distinguishable from self-description. A claim or completed task never grants authority by itself.

Do not infer protected, financial, health, or other sensitive traits to route users. Do not require private needs to be public. The owner can review, edit, compartmentalize, export, or revoke shared context.

### 5.3 Route cards

Return up to three routes, including a useful low-commitment option when available. Each route shows:
- What outcome it targets and why it fits this person.
- What is known, what is uncertain, and the source of material claims.
- Required experience or prerequisites, if any.
- Expected effort, time, cost, and relevant risks.
- What the person would do, what other roles might be needed, and how completion would be evidenced.
- Whether any provider or placement is paid or sponsored.

The person can choose, edit, ask a question, or decline. If Sovereign cannot establish a credible route, it says so and asks for the missing input instead of fabricating certainty.

Initial matching is explicit and inspectable. AI may explain, research, and draft route options, but it cannot silently change profile data, grant permissions, claim success, purchase, message others, or create public listings.

### 5.4 World and action

On route acceptance:
- Create or update a private World around the person's outcome.
- Show one achievable next action, relevant artifacts, dependencies, and any needed collaborator role.
- Keep the route connected to the existing World, History, People, and Proof views.
- Let the person invite someone for a stated role or task with a narrow grant.
- Let an outside assistant contribute only within its owner's grant and with human/agent attribution intact.
- Record consequential changes through the existing kernel boundary; record evidence and outcomes as events.

A route is not complete when a plan is generated. Completion requires the person to confirm the outcome and attach evidence appropriate to its risk. Simulated, self-reported, provider-reported, and independently verified results remain distinct.

### 5.5 Next route and distribution

After a meaningful outcome, ask what the person wants next. Offer a shareable proof artifact only with the owner's approval and visibility selection. Invite a collaborator when a real task needs that role, and explain why their help matters.

Distribution therefore comes from:
- A person's own result being useful and credible.
- A clear next step that matches their needs and experience.
- A World that becomes more valuable when the right person contributes.
- Opt-in sharing that gives the recipient useful context immediately.

Measure completed outcomes, repeated use, successful handoffs, and useful invitations. Do not treat impressions, signups, raw invites, purchases, screen time, or recruiting alone as evidence of trust or contribution.

Sales should feel like a relevant route through a real need. Commercial terms, sponsored placements, referral relationships, uncertainty, and data use remain visible. The interface must not disguise paid promotion as neutral advice or use psychological targeting to pressure a person.

## 5.6 Operate SOV through SOV and discover missing routes

SOV should use its own governed route system to operate and improve SOV. The team keeps an internal World for customer-approved friction, unmet needs, integration opportunities, hypotheses, experiments, and observed outcomes. AI can investigate and draft route or product proposals there, attributed to the acting agent and its accountable owner. It must use the same identity, permission, provenance, evidence, and review rules as any other participant.

A repeated or blocked request is a discovery signal, not proof of demand. “Find secrets” means uncover non-obvious unmet jobs, costly workarounds, coordination failures, and overlooked integrations through consented conversations, volunteered requests, and appropriately aggregated opt-in product signals. It never means finding credentials, probing private Worlds, inferring sensitive traits, or covertly surveilling people. A person's private need stays private unless they explicitly choose to share a minimal, revocable product request.

For each promising gap, follow this loop:

1. Define the person, job, desired outcome, and current workaround using evidence and clearly labeled assumptions.
2. Ideate genuinely different routes: connect an existing provider, coordinate a human workflow, partner, compose existing capabilities, create a Room or Pack, or explain why no safe route is available yet.
3. Review each route against the founder vision, user value, privacy, authority, legal and operational risk, cost, and reuse across people. Explain uncertainty and who benefits.
4. Have a responsible person choose the smallest reversible test. Prefer a manual or integration-backed pilot before building a platform capability.
5. Record what happened, including failure, effort, and unintended effects. Refine the route; generalize it only when evidence shows it helps beyond one request.

Prioritize build work using severity of need, evidence of recurrence, time to a useful outcome, whether people will commit to a pilot, reusable reach, delivery and support cost, and safety/compliance risk. Novel routes are welcome; novelty alone is not a reason to ship. No route should be promoted through fake certainty, hidden commercial influence, or recruitment pressure.

## 6. First-market path

Keep the Build Book's trading-signal verification wedge as the current hypothesis, not as a permanent product boundary:
- A creator may need a credible, inspectable record of past claims and outcomes.
- A prospective member may need to understand what a record does and does not demonstrate.
- Evidence should be inspectable, source-labeled, time-bounded, and correctable through appended records rather than silently edited claims.

For this initial market, the first route may help a creator publish a verifiable record or help a visitor inspect a record and understand its evidence. The initial version must not provide personalized investment recommendations, choose signals for a person's portfolio, execute trades, custody funds, promise returns, or treat past results as guaranteed future results.

Before public pilot or compensated ranking, obtain qualified legal review for the precise product, messaging, compensation, and market. SEC and FINRA materials highlight requirements and investor-protection concerns around adviser marketing, compensated endorsements, performance claims, and social-media-influenced investing:
- SEC, Investment Adviser Marketing: https://www.sec.gov/resources-small-businesses/small-business-compliance-guides/investment-adviser-marketing
- FINRA, Social Media-Influenced Investing: https://www.finra.org/rules-guidance/key-topics/fintech/report/social-media-influenced-investing

The product-market hypothesis must also be validated directly with creators and prospective members. A gap in a competitor map is not demand.

## 7. Network-state architecture, worked backward

### Stable kernel
Keep identity, actor type, authority, grants, append-only events, evidence, history, and double-entry accounting in the stable kernel. Needs, route logic, market rules, and user interface evolve above it.

### Personal layer
Each person controls their World, private needs, goals, preferences, and experience claims. Sharing is scoped and revocable. A route can work for a person without requiring public profile exposure.

### Capability layer
Rooms and Sector Packs deliver market-specific work. Routes reference approved capabilities and provider adapters. Market-specific rules stay in a versioned pack, not in the identity or event kernel.

### Community layer
A group may later add memberships, roles, rules, dispute handling, shared projects, services, and transparent economics. Add governance and treasury tools only after real communities have recurring work and a demonstrated reason to govern together.

### Network-state layer
Later, communities can interoperate through portable, owner-controlled identity and evidence, cross-community services, and explicitly negotiated rules. Geography, land, local infrastructure, and legal jurisdiction come after stable digital communities and productive local economies. Do not launch a token or public treasury to simulate missing utility.

## 8. Recruitment and market sequencing

1. **Controlled readiness:** demonstrate the staging sign-in, SOV ID, World persistence, grants, revocation, and outside-assistant boundaries.
2. **Individual value:** test the need-to-route journey with people in the current proposed niche. Recruit by stated need and relevant experience, not a broad demographic funnel.
3. **Small cluster:** assemble enough complementary participants around one real outcome. The critical-mass document's 20-person circle can be a test cohort, not a target presented as proven.
4. **Repeat loop:** establish that people complete useful work, return, and choose to share evidence or invite a needed participant.
5. **Adjacent markets:** consider ecommerce, courses, coaching, and agencies one at a time, only where the same proof, discovery, fulfillment, and outcome loop transfers with limited bespoke code.
6. **Network features:** add wider creator discovery, cross-community exchange, governance, and network-level economics as actual participant needs emerge.
7. **Physical expansion:** support location-aware services, shared assets, and eventually physical places only after product, community, economic, and legal foundations hold.

For each market expansion, require evidence of independent paying customers, repeat use, a measurable customer outcome, improving delivery effort, positive direct contribution, and demand for the adjacent use case from existing participants. Set precise numerical thresholds before each pilot; do not mistake the current estimate for a forecast.

## 9. Privacy, trust, and failure handling

- Needs, goals, and experience data are private by default and accessed only with the person's grant.
- Record self-reported versus evidence-backed claims distinctly.
- Explain recommendations and disclose paid relationships.
- Do not expose one World to another by default.
- Deny missing or expired permissions; record consequential denials where the kernel supports it.
- If sources conflict, surface the conflict and preserve both provenance chains.
- If no route is reliable, ask for input or return no result.
- If evidence cannot be verified, label it as unverified rather than completing the claim.
- If a profile or route service is unavailable, leave the person's saved World unchanged and offer retry/export.
- Human and agent actions remain distinct; every accepted proposal is attributed to its author and accountable owner.
- Financial, public, access-changing, irreversible, and physical actions retain the current explicit approval gates.

## 10. Acceptance criteria for the first slice

A first release of this design is acceptable when:
1. A new signed-in person can state a goal in their own words and skip optional profile fields.
2. The flow can distinguish a need from an offered capability without forcing the person into a market category.
3. The person receives up to three routes with fit rationale, sources, effort, cost, uncertainty, and commercial disclosure where relevant.
4. The person can select, edit, or reject a route; selection creates a private World with a concrete next action.
5. User-described experience and evidence-backed experience are visibly distinct.
6. Personal needs and experience are not shared across Worlds unless the owner chooses.
7. An invitation is tied to an actual role/task, states the access requested, and is revocable.
8. Route, agent, and human activity is attributable in History; consequential actions follow kernel authority.
9. The user can correct the result and the system preserves the correction's provenance.
10. The experience works on phone and desktop, including empty, no-match, error, and returning-user states.
11. Focused tests cover privacy, permissions, attribution, edit/revocation, source display, and route failure.
12. Pilot reporting measures time to first useful outcome, outcome completion, return use, invite usefulness, support cost, and direct contribution margin, not raw recruitment counts.
13. When no credible route exists, the person sees the limit and any useful workaround, and can choose whether to share a minimal product-gap request.
14. Product-gap proposals distinguish evidence from assumptions, compare materially different routes, and name the smallest safe test and its cost or effort.
15. The team can use an internal World to operate SOV and review proposed improvements under the same attribution, permission, provenance, and approval rules; private customer Worlds are not product-discovery inputs by default.

## 11. Explicitly outside this slice

- Public profiles by default, global reputation scores, leaderboards, or paid ranking.
- Automatic psychological, financial, health, or demographic profiling.
- Signup or recruitment-only rewards.
- Public token, cash-out, deposits, treasury, custody, yield, or real-money pooled rewards.
- Personalized investment advice, brokerage, or automated trading.
- A public marketplace or mass-ad campaign before a trusted pilot.
- Autonomous actions that change access, publish, message, spend, sign, or control physical equipment without existing grants and approvals.
- Land, citizenship claims, or legal-jurisdiction claims.

## 12. Review checklist

- The person gets a first useful step before a request to invite, pay, connect an AI, or publish.
- The long-term kernel remains independent from the first market.
- The current market wedge remains a testable hypothesis.
- Recruitment is a consequence of useful work and chosen sharing.
- Individual needs and experience guide service; they do not become covert targeting, rank, or authority.
- Commercial recommendations are relevant and disclosed.
- The first cohort is a learning environment, not a fabricated growth claim.
- The path from an individual outcome to a community economy is explicit, with governance and physical presence deferred until earned.
- SOV improves through consented evidence and its own governed Worlds; non-obvious unmet needs lead to tested routes, not automatic feature work.
