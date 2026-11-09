# SOLVE — Launch Execution Order and Builder Handoff
**Date:** 2026-11-03  
**Status:** Proposed execution plan, pending review; no production promotion authorized.  
**Companion:** `docs/specs/2026-11-03-solve-launch-quality-contract.md` (required reading).

## Direct brief for the coding agent

The founder wants SOLVE to **look and feel completely different** while preserving its trustworthy kernel and broad vision. He wants each foundational dimension brought to a **10/10 launch standard**, not a rushed pile of features. Brand: **SOLVE**. Governing principle: **SIMPLE SCALES**. Existing approved identity: “Everything here is real.” Do not replace the approved brand or break real utility to make a new appearance.

The critical positioning is: **one persistent, intelligent, permissioned environment where people can understand, create, connect, coordinate, act, verify, collaborate, and optionally sell useful creations.** No AI provider, social link, third-party service, payment rail or community membership should be necessary for basic value.

This is **not** permission for blind merges, destructive migrations, secret handling in chat, autonomous prod release, crypto activation or bypassing security policies. Implement coherent tested slices on the currently approved development base. At the session's end, report what genuinely works with exact preview/commit/test evidence. Avoid pretending an entire 10/10 platform can be implemented in a single session.

## Rule zero: do not lose the product in development

A feature is incomplete unless it is accessible through the redesigned SOLVE experience, saves state correctly, survives reload, handles failure, respects permissions and demonstrates actual user value.

Build order: **trust + native useful action → continuity → genuinely new experience → connect → real collaboration → reuse/publish readiness**. All five permanent systems must be represented architecturally from the start: identity, Worlds, Connect, collaboration, exchange. Only the first four require working launch journeys; exchange readiness is a safe package/version contract until market validation and legal review.

## Priority 0 — reconcile facts before code

- Pull/inspect **main**; verify latest `DECISIONS.md`, `DIRECTIVES.md`, `AGENTS.md`, `ACTIVE-WORK.md`, `BUILD_STATUS.md`, `VISION-CANON.md`, `BUILD-CHARTER.md`, `SECURITY-INVARIANTS.md`, `DOMAIN-CONTRACTS.md`, and canonical brand docs.
- Newer founder decision says main is trunk; AGENTS says old Claude branch. **Surface and resolve this conflict through the correct approval path**; do not work from historical branch assumptions.
- Verify the independent passport target is **sovereign-passport**, not the retired proposed sov-id repo.
- Audit open #37–#42, dependency chain and owned paths. In particular **#42's mandatory external-AI connection violates founder's newer optionality requirement**; keep it unmerged until fixed, while evaluating its valuable security work.
- Verify production alias, exact deployment SHA, active branch, guest mode, database state, migrations, external provider connection and CI. The last confirmed alias was READY at main @95a32e3, not proof of later docs/feature deploy. Documentation status reports are historical.
- Enumerate only real blockers to a useful first World: broken save, faux persistence, dead buttons, unresolved session mismatches, credential/token problems, cross-World authorization or unverified dev-status source.

**Deliverable:** one evidence-backed “current reality” section with exact refs and a worktree plan. No feature should be merged solely because its PR says tests passed.

## Priority 1 — 10/10 native utility and trust

A person without AI or social accounts must be able to:

1. Open SOLVE in guest or supported authenticated mode.
2. Express an intention or choose a starter.
3. Create and name a World.
4. Add and edit a meaningful artifact, note/plan/decision, task or file.
5. Receive an accurate “saved” indicator only after persistence is confirmed.
6. Reload and reopen the exact work with correct ownership.
7. See what's next and what happened.
8. Preserve/transfer their work through the supported secure account claim path, without creating a fake owner or leaking to another guest.

No provider key, avatar, LinkedIn, Instagram, OAuth assistant, passport or payment required. The common path must work under no-LLM/no-paid-inference conditions.

**Risk tests:** two unrelated guests' data isolated; guest-to-account migration no cross-account merge; expired session recovers without data claim; simultaneous editing conflict clearly handled; failed save not reported as success; revoked grant cannot continue to read private World state.

## Priority 2 — the completely new SOLVE experience

Design two genuinely different directions; choose one after evaluating function and approved identity; implement, do not ship a moodboard. Move beyond existing product tabs and dense dashboard metaphors. A coherent intention-centered **home → World → work → return** path is more important than accumulating pages.

**Interaction anchors:**
- Home: the person's most relevant World or next useful move, with a clear way to express an intention.
- World: a living, editable, evidence-backed environment where things exist and collaborators act. No forced chat layout.
- Contextual AI: can propose, explain or act within grants; never hides native direct editing.
- Contextual Connect: suggest the relevant capability where it adds value; also a clear universal connections manager.
- Invite: share value directly from a World with visible exact scope.
- Return: factual update, changed artifacts, decisions, next step; show no activity if none.
- Spatial/map/3D: available where a World needs them, not a compulsory loading tax.

**Visual standards:** distinctive typographic hierarchy, restraint, meaningful motion, purposeful depth, excellent touch targets, keyboard/voice-over accessibility, high contrast, reduced-motion support, usable no-WebGL version. No clone of another AI UI. Verify in 390px and 1280px real browser, with one low-end/mobile simulation. Do not change the founder-approved external brand claim or invent a rebrand without approval.

## Priority 3 — founder World uses real evidence

**World: Building SOLVE**. Display from authorized, live, source-backed infrastructure:
- source branch/commit, open PRs, checks, deployment state;
- claimed and actual agent work clearly differentiated;
- decisions, artifacts, tasks and approvals;
- blockers and next actions;
- persistent editable state that survives reload.

Example: “What is Claude working on?” must return precise references, or honestly say the connected system cannot verify current activity. Source-back build, CI and deploy status. Do not use a model's invented answer as source of truth.

Owner can create a development task, attach links/artifacts, invite bounded collaborator, review an actual contribution and see the result on next visit. Human approvals gate production promotions and major authority changes.

## Priority 4 — SOLVE Connect proves its lifecycle

Use the existing adapters and kernel permissions. Build:
- search/discovery by provider **and** intent;
- honest catalog states (discovered/supported/needs authorization/connected/verified/blocked/revoked);
- appropriate consent and readable scope;
- connection verification;
- specific per-World grant;
- one real read/use of capability;
- revoke and prove subsequent denial;
- degrade gracefully on provider outage.

Start with 2 supported actual paths already practical for the founder (e.g. GitHub information and existing verified OAuth/MCP or model provider). Exact provider selection depends on inspected working implementation, credentials and integration policy. A “LinkedIn” or “Instagram” *profile URL* can be a simple optional social link, **not** an implied data/API authorization. Don't promise unsupported personal-account API access or LinkedIn social-graph harvesting.

**Hard gate:** require explicit user authorization for new account access; for existing authorized connections respect World grants, task limits and cost/side-effect approval. Never automatically ingest third-party private data into public or shared Worlds.

## Priority 5 — invite and actual collaboration

Invite founder's brother to a **Commercial Project** World through the simplest secure, scoped invitation. He may see a limited preview without a full account when safe; require authentic identity and explicit grant before editing or seeing private resources. He must not need his own AI subscription or provider tokens.

Starter can organize files, decisions, contacts, tasks and project progress. Don't imply verified architectural engineering, permit compliance, live estimates or specialized CAD unless those are genuinely supported.

Conduct and record a real two-person workflow: one invites, second contributes, first sees the changed artifact/evidence, second is revoked/role-limited, both return. Do not claim this is complete without the brother actually participating; use controlled two-account browser QA as engineering precursor only.

## Priority 6 — prove the universal World architecture

Start an unrelated intention (e.g. neighborhood event) with a nontechnical user. It must reuse the same kernel identities, artifacts, permissions, tasks, connections and event model without showing founder/developer-specific controls. It needs a meaningful saved result, not just a list of suggestions.

A World can adapt in layout and capabilities, but stable interaction principles and permissions do not change. Validate at least five uncoached users before claiming first-session usability; document failures, not just successes.

## Priority 7 — community/discovery readiness without premature payments

Implement or validate Private → Shared → Publishable boundaries in the domain model. A packaged copy of selected artifacts/capabilities must be versioned, attributed, inspectable, revocable/withdrawable subject to published rights, and free of creator secrets and live private references.

Start by demonstrating **free share/reuse** of a World Recipe or Pack. Test recipient can use it with own identity and choose their own provider connections. Document creator/buyer terms and dependent licenses for eventual sale. Do not enable creator payouts, real checkout or token markets in this slice.

Create a reporting/abuse pathway and basic invite spam protections before any public community discovery.

## Release test matrix (minimum)

| ID | Journey | Expected proof |
|---|---|---|
| N01 | New person, no AI, no social, create World + artifact | Durable correct owner/scope and visible result |
| N02 | Save → hard reload → resume | Same version/content, no false save notification |
| N03 | Separate guest/person tries another private World | Denied across API, browser, events, evidence, search and direct URL |
| N04 | Guest transitions to account | Correct idempotent ownership mapping or honest non-claim; no cross-user data |
| C01 | Discovery of known provider | Correct capability & availability status, not fake one-click |
| C02 | Authorized connector reads relevant data for World A | Works within explicit World A scope only |
| C03 | Revoke grant/token, use in World A or B | Denied; no cross-World token inheritance |
| C04 | Provider outage / token expiry | Existing World remains usable, clear recoverable error |
| A01 | Untrusted page/tool output tries to expand agent authority | Blocked + event/provenance as appropriate |
| A02 | Agent requests consequential action | Proposal/approval path, no autonomous privilege escalation |
| S01 | Invitation to World, contributor limited access | Only shared resources visible; contribution attributable |
| S02 | Invitation expires/revoked | Denied in new requests; limitations disclosed |
| W01 | Founder World gives Dev Room source-backed status | Exact references to actual commits/checks/deploy |
| W02 | Unrelated World produces saved useful artifact | Same universal primitives, different presentation |
| P01 | Publishable copy of private World selection | Secrets, personal context, private links excluded |
| E01 | Empty state/dead buttons test | Every route has working action or truthful disabled state |
| U01 | Mobile + desktop + keyboard + reduced motion | Accessible, no horizontal overflow, no blocked controls |
| R01 | Error and recovery | Failed save/connection/worker can't report false success |
| L01 | Preview vs production status | SHA, environment and actual browser verification reported separately |

Test suites: affected targeted tests, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, relevant `npm run test:product`, `npm run test:shared-room`, `npm run test:browser`, `npm run test:world`, staging DB checks, Playwright end-to-end and manual mobile/desktop review, as appropriate to touched boundaries. Don't claim tests executed if environment missing. Respect existing official build gate; integrate status docs truthfully.

## Product telemetry and research plan

Privacy-safe product analytics (without document bodies, passwords, credential text, or secret prompts) should record:
- `world_created`, `first_artifact_saved`, `save_reopened`, `connection_started`, `connection_verified`, `connection_revoked`, `invitation_sent`, `invitation_accepted`, `shared_contribution_saved`, `world_returned`, `pack_copied`, `verified_outcome` with appropriate anonymized/consented metadata.
- Funnel: entry → meaningful saved result → return → collaboration, segmented by provider-free and connected users.
- Reliability: save failure and recovery, agent side-effect approvals, provider latency/cost/error, cross-World denies, browser errors.
- Creator/community: contribution rate and recipient value, *not* total invitations as a vanity metric.

The **initial research study**: five uncoached outside testers across at least two unrelated intentions, plus founder and brother, observed without leading questions. Qualitative questions: What did you expect? What did you do? What worked? What did you trust? What would you come back to do without prompting? How many separate tools did you avoid? Did connecting/working with another person actually help? Collect day-1 and day-7 return evidence if the period has elapsed; don't forecast retention as measured.

## Cost and business discipline

- Default AI provider-free mode for native work; supported provider-free or free-tier AI is an upgrade, not a dependency.
- Per-World/provider budget ceilings and rate limits where incurred costs exist; visible warnings and interruption controls.
- Track unit cost per successful useful outcome, not per message.
- Offer advanced AI, professional integrations, Pack sales, memberships and transaction fees as **hypotheses**, not mandatory revenue surfaces at first launch.
- An eventual community moat requires creator supply and recipient demand in the *same useful network*, not a disconnected crowd of registrations.
- SOV/crypto follows separate monetary constitution and approvals.

## Morning handoff checklist (do not substitute narrative for code)

At the end of an actual build session report:
1. Exact branch and commit(s), PR(s), CI URL(s) and deploy URL(s).
2. What is visual-only vs functional, local vs preview vs live production.
3. The most important genuinely usable flow, demonstrated in browser.
4. Tests run and failures/unrun tests.
5. Which existing primitives were reused and any new migrations requested.
6. Which of N01–L01 actually passed and which remain pending.
7. Security, data, consent and rollout/rollback status.
8. Top three blockers, with exact needed human authorization.
9. Next one or two high-value coherent slices.

**No claim of a complete “10/10” until actual user acceptance and release gates prove it.**

### Bottom line

**The founder should open SOLVE because SOLVE genuinely makes building SOLVE easier. His brother should accept a shared World because it makes a real construction project easier. Another user should create an unrelated World because it makes their goal easier. The community grows from shared value, and commerce remains optional.**

SIMPLE SCALES. Everything here is real.
