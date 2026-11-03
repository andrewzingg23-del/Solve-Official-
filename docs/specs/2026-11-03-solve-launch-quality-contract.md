# SOLVE — Launch Quality Contract
**Date:** 2026-11-03  
**Status:** Proposed implementation/acceptance standard; not proof of implementation or approval to deploy.  
**Owner:** Founder.  
**Basis:** `VISION-CANON.md`, `BUILD-CHARTER.md`, `SECURITY-INVARIANTS.md`, `DOMAIN-CONTRACTS.md`, `DIRECTIVES.md`, `DECISIONS.md`, `docs/brand/BRAND.md` and current repository evidence.  
**Guiding rule:** **SIMPLE SCALES.** SOLVE makes a person's life easier without asking them to understand its complexity.

## 0. The hard truth about “10/10”

A 10/10 product cannot be asserted by a founder, designer, test suite, agent, or launch checklist. It is a **standard to earn through real usage**. This contract defines ambitious launch gates, negative tests and measurable evidence so the first release can be exceptionally strong without claiming proven retention or network effects.

**North-star behavior:** A person arrives with an intention, accomplishes something meaningful, saves it, optionally connects the right capability or collaborator, and returns to useful continuity. A second person receives genuine value from shared work. No mandatory AI, social connection, integration, commerce, or setup ritual.

**Canon remains intact:** SOLVE's loop is **Understand → Prepare → Coordinate → Create → Act → Verify → Learn**. Sovereignty, privacy and preparation are not optional; the AI model, software provider, social identity, payment rail, 3D view, and community membership are. The official product name is **SOLVE**, with the previously founder-approved brand concept **“Everything here is real.”** Brand revisions need founder direction; a radical new visual and interaction design must still honor the truth promise.

## 1. Architecture that makes simplicity scale

One coherent experience, built from one authoritative kernel:

- **Person / SOV identity:** actor and ownership, minimal optional profile, future passport integration.
- **World:** persistent, uniquely scoped environment for an intention. It owns context and references to work, people, resources and capabilities.
- **Room:** an adaptive surface within the World; no independent permissions or divergent truth.
- **Artifact:** something useful produced or imported: file, note, plan, design, webpage, workflow, structured entity or evidence. Versions and attribution are visible.
- **Participant and membership:** human or agent identity, role and World-specific membership; no implicit provider-wide or other-World access.
- **Grant:** authority constrained by actor, World, capability, task, data scope, duration and approval policy; revocable and auditable.
- **Capability / adapter:** internal or external function with defined inputs, outputs, authorizations, limits, side effects and evidence.
- **Connection:** verified user-to-provider authorization, separate from World permission to use it. Access is never inherited by other World members.
- **Task / contribution / event:** attributable work state, provenance, verification, dependencies, decisions and recovery.
- **Publishable Pack / revision:** permission-safe snapshot of explicitly selected creation, never a pointer granting buyers live access to the creator's private World.
- **Offer / exchange:** future commercial entitlement against immutable published revision and terms, not an accidental extension of World membership.

This is an ontology and contract checklist, **not** a request to invent new tables. First map every concept to existing `kernel_api` and the domain contract; add migrations only for real gaps, additively, after appropriate review. One concept, one home.

**Canonical writes** go through governed interfaces. Search, recommendations, planning, chat, map, spatial view and AI-generated UI are projections/interpretations; they cannot silently become sources of authority. Every claimed side effect must have an external result or explicit “unknown / needs reconciliation” state.

## 2. Product quality scorecard: target 10/10 in each dimension

| Dimension | The 10/10 launch definition | Release gate / evidence |
|---|---|---|
| Vision coherence | SOLVE supports understanding, preparation, creation and coordination; does not collapse into a dev dashboard or AI chat | Founder, construction and unrelated-project journeys use one architecture; separate examples, not three hardcoded products |
| Immediate value | Start from intention and create or edit something useful without outside connections | Observed novice test: 4 of 5 new people finish an uncoached meaningful task; median time to saved first outcome target <= 3 min (product hypothesis) |
| Interface quality | Visibly new interaction model, calm, distinctive, predictable, fully operable with touch/keyboard | Real desktop and narrow-phone journey video/screenshot review; WCAG 2.2 AA audit; no dead controls, trap dialogs, sideways scroll or fake saves |
| Native utility / resilience | Useful without external model, internet-provided AI, social or marketplace | Disconnect all optional providers; create/read/edit/save/reopen still works as supported, with honest offline/network status |
| Trust / security | Authority and privacy survive malicious inputs, revoked access, and cross-World attempts | No known unresolved critical/high exploit in exposed launch surfaces; 100% pass on required owner/guest/invite/agent cross-World denial matrix; independent security review |
| Connect | Find, authorize, verify, assign to World, use and revoke a supported provider easily | Two real integrations through complete lifecycle; denied scope, expired token, revoked token and provider outage tests; no fake integrations |
| Adaptability / self-creation | Worlds compose validated capabilities and vary by intention while controls remain consistent | Founder and unrelated Worlds differ appropriately; configuration persists and reverses; no execution of generated unreviewed code |
| Collaboration / community | Shared work is useful before a social feed exists | Invite link: scoped access, successful meaningful contribution, permission enforcement, revocation and return; real two-user test |
| Retention / continuity | Users return to correctly resumed work, decisions, proof and next action | At least 30 save/reload/session/device test cases; distinguish verified, proposed, simulated, failed; real-world return interviews and instrumented cohorts before any claim of retention |
| Commerce readiness | Sharing, attribution, version and licensing do not leak private state | Publish-as-copy test excludes secrets/private artifacts/hidden context and works independent of live source; payments disabled until legal/payment/trust gates |
| Economics / differentiation | Valuable outcome without unlimited subsidized inference or commodity AI-wrapper positioning | Per-user/task cost ledger and budget controls, provider fallback, one real workflow substantially reduces steps; pricing tests before revenue claims |
| Execution reliability | A working release rather than an impressive build log | All launch routes, auth/guest, DB-backed save, CI, browser E2E, production smoke tests, error monitoring, rollback and accessibility verified from the exact release SHA |

The 3-minute and 4-of-5 targets are **internal hypotheses**, not industry benchmarks. Validate or revise from observed tests; do not call them results until measured.

## 3. Core experience / interaction contract

**Entry:** The founder-approved first-words concept “Ask for a way.” may coexist with a plain, clearly labeled intention input. A person can (a) describe goal, (b) select a relevant starter, (c) begin blank, (d) reopen a World, or (e) join an invitation. The user must get a tangible result instead of a chat essay. Avoid onboarding gates for avatar, payment, provider key or social link.

**Stable shell / adaptive Worlds:** Keep predictable Home, Worlds, people/sharing and connection entry points, simple back/close/recover controls, and consistent permission vocabulary. A World may surface an editable design canvas, project workspace, map or conversation without changing basic safety/navigation principles. Text-first and accessible fallbacks exist for 3D/slow devices. The UI should show *what exists, what's happening, who's acting, what changed and what happens next*, progressively disclosed.

**Native baseline:** Even with no AI or third-party service, users can create a World, add/edit at least one meaningful artifact, organize files/info and decisions, invite another person where connectivity exists, control permissions, and return to saved work. Guest access must accurately distinguish local-only state, remotely durable guest state and claimed account-bound state. On account linking, migration must be explicit, conflict-safe, idempotent and recoverable.

**Return:** Show the last genuinely saved artifact or task, new contributions, unresolved decisions, evidence and a useful next step. “No activity since your last visit” is a valid honest result. No hallucinated worker status.

**UX target:** Every visible control works, explains why it cannot yet work, or is intentionally absent. No placeholder feature masquerades as functional. Progressive disclosure reveals advanced controls when context calls for them; predictable interaction beats unlimited rearrangement.

## 4. SOLVE Connect: discovery is not authorization

**UX:** Find it → Connect it → Use it; also Disconnect/Replace. Search by provider or intent. Display provider, capabilities, account, costs, requested permissions, data sharing and supported uses in plain language. No technical OAuth/MCP vocabulary required in ordinary setup.

**States:** `discovered`, `supported`, `authorization_required`, `connected`, `verified`, `degraded`, `revoked`, `unsupported`. “Discovered” never implies usable. A profile link is not an OAuth connection. LLM API access is not control of an existing consumer assistant session.

**Minimal adapter contract:** `capability_id`, `provider_id`, `version`, `input_schema`, `output_schema`, `auth_type`, `user_scopes`, `world_grant_requirements`, `data_egress_class`, `cost_model`, `side_effect_level`, `approval_policy`, `timeout`, `rate_limit`, `idempotency_key_strategy`, `evidence_contract`, `health`, `revocation`, `fallback`, `terms/license`. Version dependencies; make adapters replaceable without reauthorizing broader scopes.

**Safety:** OAuth best current practice (PKCE S256, state/mix-up defense, exact redirect matching, token audience validation, no token pass-through); encrypted server-side token vault; short-lived or refreshable scoped tokens; redaction in logs; test revocation; outbound URL/SSRF allowlisting, DNS rebinding checks, egress restrictions and timeouts. Treat tool descriptions and retrieved documents as untrusted content, never as instructions granting authority. New external writes require risk-based explicit approvals.

**Discovery / scraping:** First use official catalogs/APIs, MCP Registry, SDKs and terms-compliant public metadata. Maintain license, capabilities and freshness provenance. **No mass-scrape of private services, credential bypass or unvetted auto-installation.** Discover and recommend automatically; connect only with user authorization. Benchmark candidates on task success, cost, reliability, privacy and reversibility, not popularity alone.

**Real provider caveats:** LinkedIn's open API scope is narrow; many data use cases require partner approval and have storage/transfer restrictions. Instagram API support differs by personal vs professional accounts. Show “Link profile” where authorization or data APIs do not support the proposed capability. Do not promise “one-click connect everything.”

## 5. Multi-intelligence and collaboration: shared work, not group-chat theater

Every World can have humans, native assistants, external agents or none. Each participant's visible identity, capability, allowed data, task, output and proof must be known. Tasks have `proposed → authorized → working → submitted → independently reviewed → verified/completed` or `blocked/failed/unknown` transitions; distinguish suggested work from real external execution. External agent session control is explicitly unavailable unless a verified API/runtime exists.

Implement task-scoped context bundles with minimization and expiry. An agent's incoming document, GitHub issue, webpage, tool result or teammate message can contain prompt-injection instructions—never allow that content to alter grants, goals or policies. Human review for impactful writes, production releases, payments, messages to third parties or private-to-public publication. Separate executor from verifier.

**Invitation:** A recipient should see the context and value of an invitation before complicated setup. A scoped invitation may allow secure read-only preview where feasible; persistent contribution requires appropriate identity/role. Do not let anyone impersonate the founder or inherit his third-party tokens. Revoke and expiry affect future access; already delivered external data cannot be retroactively clawed back, so disclose that limitation.

## 6. Community is the intended moat—but it must be earned

The smallest viable network is **one World that becomes more useful when another person contributes**. The product loop is `create → share → recipient gets value → contributes → creator returns → reusable result spreads`. Users should not be forced into public communities to collaborate.

Provide **Private → Shared → Published** with independent permission and disclosure boundaries. A published Pack is an explicit sanitized, immutable or versioned derivative; never a live share of private owner state. Publication review must inspect embedded prompts, files, external references, dependency licenses, data rights and tool privilege declarations.

Trust in communities requires anti-spam, reporting/blocking, invite abuse limits, moderation processes, impersonation resistance, transparent creator identity/claims, dispute pathways and protections for minors. Do not treat social profile connection as reputation proof.

**Test the moat:** measure invitation acceptance, recipient first useful outcome, second-party contributions, reuse/copy of a creation and repeat cross-person value. Three unrelated solo users prove breadth, *not* network effects. Select one concrete collaboration loop to prove network lift before growth claims.

## 7. Commerce is optional and must not compromise sovereignty

Reserve versioned offer/entitlement and publishable-Packs contracts without enabling checkout immediately. Later, verified commerce needs seller onboarding/KYC where required, tax, refund/chargeback handling, disclosures, fees, fraud screening, consumer protection, sanctions screening where applicable, IP licensing, takedown/disputes, provenance of deliverables and policy enforcement. Prefer compliant payment providers rather than inventing custody or a homebuilt processor.

No real-money or crypto activation without explicit founder approval, qualified legal/compliance review, robust idempotent accounting and independent evidence. Keep prices, seller proceeds and SOLVE fees distinct; network-revenue aspirations are goals, not earnings claims.

For licensed third-party capabilities bundled into sold Worlds, verify that **resale and downstream usage rights** exist. A buyer may need their own provider subscription, OAuth connection and consent; disclose dependencies *before* purchase. A Pack can be functional even without importing the creator's private data.

## 8. Trust, privacy, children and compliance are first-order

Baseline to OWASP ASVS 5.0 for web/API controls; OWASP GenAI LLM Top 10 (2026) and agentic threat models for model/connector behavior; NIST AI RMF for trustworthy lifecycle practices. Run cross-tenant permission tests, secret-leakage tests, session fixation/CSRF tests, IDOR tests, invite replay/expiry tests, malformed data and prompt-injection adversarial tests, malicious Pack tests, cost-spike tests and failure/recovery tests.

Required privacy controls: data minimization, clear retention and erasure policy, per-World data scoping, safe defaults for map/location and social presence, inspectable grants, export where supported, genuine revoke, and no silent third-party data transfer. User-controlled export does not mean SOLVE owns rights to export provider-restricted social data.

Kids/teens are part of the long-term architecture but **not automatically eligible for an unsupervised public launch**. A child-oriented experience requires age-appropriate consent, guardian permissions, restricted discovery/DMs, AI boundaries, reporting, content moderation and COPPA/other applicable review. Market launch should explicitly define allowed ages and geographies.

Release blocker examples: any cross-World private data leak, tool executing outside grant, secrets in browser logs, simulated activity presented as verified, unrecoverable save loss, unauthorized publication, unbounded cost/loop, inaccessible core path or false “connected” state.

## 9. Performance, resilience and operational launch

- Accessibility: target **WCAG 2.2 AA**, keyboard navigation, screen readers, focus visibility, non-drag alternatives, sufficient hit targets, accessible authentication, reduced-motion and readable touch layouts.
- Web performance: field **p75** Core Web Vitals target LCP <= 2.5s, INP <= 200ms, CLS <= 0.1; also test low-end/mobile network, timeout, heavy 3D and no-WebGL fallback.
- Reliability: idempotent writes, optimistic concurrency, durable task/outbox records, bounded retries with backoff, circuit-breakers and explicit unknown/reconciliation states. Prevent provider outages from making existing Worlds unreadable. Verify backup/restore and rollback.
- Observability: instrument failed saves, latency, token/connector expiry, failed permission checks, provider error/cost and client errors while omitting secret, private document and sensitive content by default. Define incident ownership and on-call path.
- Cost: rate-limit expensive AI/tools per account/World/task; quotas, budgets and opt-in spending caps; stop runaway autonomous loops; track true cost per verified outcome.
- Build: exact SHA → CI → preview → browser smoke → production approval → smoke → monitoring → rollback; documentation changes must not be mistaken for shipped product changes.

## 10. Launch sequence and stop rules

### Gate A — Integrity & real usefulness (private founder)
Current deployed application opens, auth/guest is coherent, World create/edit/save/reopen is durable, source-backed Building SOLVE shows actual work, errors are honest, no critical cross-World leaks. AI may be absent. A truly new visual/interaction experience must exist on an isolated preview.

### Gate B — Collaboration & portability (founder + brother)
One complete invitation accepted; an invited collaborator sees only intended materials, adds meaningful contribution, founder sees provenance and returns to it. Connection lifecycle works with at least two real supported capabilities; offline/no-provider baseline still works. Commercial-project World is useful without specialized unverified construction claims.

### Gate C — External alpha
At least five uncoached people across distinct intentions complete a useful task; 4/5 target, qualitative friction logs, clear consent/privacy/compliance, keyboard and mobile journeys, no dead controls, no high-risk unmitigated exposed flaws. Separate “looks different” from “does useful work.”

### Gate D — Small public launch
Defined user segment/age/geography, live release SLOs/alerts, production smoke, incident/backup/rollback, retention instrumentation with consent, support/report channel, policies, data export/erasure, and a verified invitation loop. Public claims are limited to capabilities tested in production.

### Gate E — Publish and commerce (separate later release)
Private/public boundary red-team; immutable packs, dependency licenses, policy enforcement, moderation and rights; payments/compliance/chargeback/tax/creator economics ready. Only then enable selling, subject to founder approval.

If a gate fails: fix the narrow blocking journey before adding another surface. Never claim readiness from unit tests or preview status alone.

## 11. Specific repo conflicts discovered during review (not hypothetical)

1. **Trunk conflict:** `DECISIONS.md` (2026-10-31) records **main** as canonical trunk; `AGENTS.md` still names `claude/keen-cerf-tpd7io`. Treat the newer dated founder decision as direction, flag the stale instruction for founder-approved reconciliation and verify current Git state before code work.
2. **Passport repo decision:** newer `DECISIONS.md` states **`sovereign-passport`**, not a newly created `sov-id` repository. Follow the latest verified decision, with independent identity and OAuth/MCP integration.
3. **Brand:** `docs/brand/BRAND.md` approves “Everything here is real” and “Ask for a way.” A radical visual redesign should reinforce these rather than silently inventing a different brand.
4. **Potentially conflicting PR:** open **#42 “Build connection-gated shared workspace”** explicitly requires external AI before new work can be created or changed and requires collaborators to connect their own intelligence. That contradicts founder's newer non-negotiable **basic utility without AI/integrations**. **Do not merge #42 as-is.** Salvage its good work (credential isolation, encryption, persistent workspace, evidence) but remove connection gating; verify guest/owner/invite journeys and re-review.
5. **Stacked PRs:** open #39–#42 may depend on one another; #37 proposes canonical project/map entity. Avoid indiscriminate merges and duplicate data models; integration should follow current base/CI checks.
6. **Deployment fact:** At review, `solve-sage.vercel.app` resolved to READY production deployment of **main @ `95a32e3`** (“Enable isolated persistent guest workspaces without email sign-in”), not the new doctrine/docs commit **`5529d1c`**. A later production build was reported BUILDING. This does **not** prove that new intended product features are deployed or that the logged-in experience works. Verify again at release time.
7. **Old build reports are historical:** `BUILD_STATUS.md` contains dated contradictory staging/production statements. Use current CI/DB/deployment evidence, not old status prose, for a launch decision.
8. **Kernel/security:** `SECURITY-INVARIANTS.md` already names extensive tests. Extend those rather than rebuilding authority logic. No production migrations or credential exposure by assumption.

## 12. Research-to-design notes (reviewed 2026-11-03)

- **OpenClaw competitive reality:** it already advertises extensive chats/providers/plugins and community skills, so connector count and agent access are weak stand-alone differentiators. Its trust documentation describes a single-operator/same-trust-boundary assumption, not mutual-adversary multitenant sharing. SOLVE's harder opportunity is safe multi-user Worlds, shared evidence, true continuity and creator exchange—not to copy a plugin catalog.
- **MCP standardization:** the evolving MCP spec now addresses HTTP-native transport, authorization, tasks and UI extensions. Integrate via versioned capability contracts and verify actual provider/runtime support rather than hardcoding one experimental transport.
- **OAuth:** RFC 9700 and 2026 browser-based app BCP support hardened OAuth flows; registry presence is discovery, not a trust audit.
- **Provider data limits:** LinkedIn restricts broad member-data usage/combination and requires approvals for many APIs. Instagram's professional-account APIs have distinct eligibility from personal accounts. A social link, verified connection, and social graph import must be separate features.
- **Risk:** OWASP's 2026 LLM risk list includes prompt injection, sensitive disclosure, excessive agency, supply chain and unbounded consumption. Solve these through permissions, tool isolation, validations, rate limits and provenance—not prompt wording.
- **UX:** NN/g's progressive disclosure and empty-state guidance support an intention-first surface with immediate meaningful actions instead of a blank or overwhelming dashboard.
- **Network effects:** “Come for the tool, stay for the network” and the cold-start literature warn against marketplace-first launches; measure shared value before attempting broad commerce.
- **Standards:** WCAG 2.2 AA, Core Web Vitals, OWASP ASVS 5.0 and NIST AI RMF are useful external references, not substitutes for actual independent testing.

### Primary references (links are research references, not third-party endorsement)

- https://openclaw.ai/integrations
- https://docs.openclaw.ai/gateway/security/trust-model
- https://blog.modelcontextprotocol.io/posts/2026-07-28-release-candidate/
- https://registry.modelcontextprotocol.io/docs
- https://www.rfc-editor.org/info/rfc9700
- https://www.rfc-editor.org/rfc/rfc10017.html
- https://learn.microsoft.com/en-us/linkedin/shared/authentication/getting-access
- https://learn.microsoft.com/en-us/linkedin/marketing/restricted-use-cases?view=li-lms-2026-02
- https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api
- https://github.com/GenAI-Security-Project/GenAI-LLM-Top10
- https://github.com/OWASP/DevSecOpsGuideline/blob/master/current-version/2-Process/2-2-Develop/2-2-5-AI-Agent-and-MCP-Security.md
- https://asvs.owasp.org/
- https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence
- https://www.w3.org/TR/WCAG22/
- https://developers.google.com/search/docs/appearance/core-web-vitals
- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.nngroup.com/articles/empty-state-interface-design/
- https://stripe.com/guides/atlas/andrew-chen-marketplaces
- https://stripe.com/connect/marketplaces

## Decision and evidence policy

This document is a **proposed contract**. It does not overwrite the founder's canonical instructions or approved brand, does not authorize production/DB/monetary changes, and does not say any launch gate is already passed. In particular, “10/10” is an aspiration enforced by independently checkable behavior, actual user preference and evidence—not a declaration of perfection.

**The correct product outcome:** three people with three different intentions can do meaningful things through one SOLVE foundation, connecting or sharing only what they choose, and the system becomes more useful—not more complicated—as those choices grow.
