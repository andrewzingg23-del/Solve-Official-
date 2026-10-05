# Does the master spec meet the vision?

2026-10-05, Claude. This checks `SOVEREIGN-MASTER-BUILD-SPEC.md` (founder upload, 2026-10-05) against `VISION-CANON.md`, `DIRECTIVES.md`, `DECISIONS.md` and the code on `claude/keen-cerf-tpd7io`. It is a review, not an edit. The spec itself is unchanged, and only the founder decides the amendments and conflicts below.

## Verdict

**The foundation meets the vision. Five places shift the center of gravity, and three conflict with standing founder decisions.**

- **Foundation.** The spec keeps the vision's spine:
  - a stable kernel with expanding extensions;
  - the authority chain;
  - AI that suggests but never gains authority;
  - proof over claims;
  - communities as the seed of Network States;
  - money staged, not dropped.
- **Narrowing.** It narrows the vision into a Build 1 that one founder can secure. That narrowing is right, and it matches the directive "Use Sovereign and grow it from real outcomes."
- **Drift.** Adopted word for word, the spec would quietly rewrite five things:
  - who the product is for (the community instead of the person);
  - how people get somewhere (one scaffold instead of researched routes);
  - where they enter (a community profile instead of their own node);
  - whether the world reacts on its own;
  - whether the system grows itself (Forge).
- **Fixes.** Each drift has a small fix, mostly language and mapping, not new infrastructure. Proposed amendments are in §3.

The spec's own §2 map of the repo checks out: every listed path exists here (`lib/kernel/client.ts`, `lib/kernel/server.ts`, `lib/chain/`, `lib/money/settlement.ts`, `lib/money/payment.ts`, `lib/router/`, `lib/ops/`, `lib/world/`, `lib/sandbox/`, `app/world/`, `scripts/`).

## 1. Where the spec meets the vision

| Vision says | Spec says | Where |
|---|---|---|
| "AI can flow everywhere the player authorizes. Authority cannot." | "The model never directly controls the database, kernel, secrets, or external systems." "The coordinator may suggest; it does not gain authority by suggesting." | §0, §6, §12 |
| Consequences go through permission → policy → approval → capability → provider → verification → event | Permission checklist (caller, identity, member, grant, scope, approval, limits); every mutation has authorization and an event | §0, §12 |
| Stable Master Code + evolving Sector Code | "The UX evolves while the kernel remains stable." Declarative UXExtensions that cannot change kernel policy or grant themselves authority | §10 |
| Event = proof that it happened | KernelEvent, hash-chain verification, optional anchor as witness only | §3, §13 |
| "Record what actually happened" | Outcome is distinct from the plan; state runs from Proposed to Measured outcome; "does not claim that a Bot physically completed a task without evidence" | §3, §6 |
| Rooms are assembled from common systems, not disconnected apps | One stable room shell, with the domain canvas as a plug-in | §7, §8 |
| Network States: members, rules, roles, agents, history | Community: people and bots governed by shared rules, owning Worlds | §3 |
| Provider Adapter = how the outside world performs it | Integration contract (mapping, capabilities, data in and out, events, revocation, retry, privacy) | §11 |
| SOV: "Reasons to use SOV before reasons to trade SOV" | Money is tested, documented and feature-gated, off the Build 1 path | §2, §13 |
| Imagine → … → Prove | Spark → Frame → Gather → Design → Commit → Execute → Verify → Reflect → Reuse | §6 |

## 2. What the spec adds that the vision lacks (keep all of it)

- **Trust zones.** Browser, model output, external integrations and the chain are untrusted. The kernel is the source of truth.
- **The evidence ladder, with no universal trust score.** It maps onto the kernel's evidence bases:
  - L0 is `self_reported`;
  - L1 is `system_observed`;
  - L2 is `artifact`;
  - L3 is `witnessed`;
  - L5 is `externally_verified`.

  L4 ("independently corroborated") has no basis. It should be computed from two or more independent evidence rows, not stored as a claim anyone can make.
- **Disagreement as a state.** Question, counterclaim, dispute, evidence request, review, resolution, unresolved. This is the honest version of "proof, not claims."
- **Location privacy defaults.** Private or approximate region unless someone publishes on purpose. The vision's glowing personal location needs exactly this.
- **Data classification, a provider policy, and a context preview before sending.**
- **Content versus integrity metadata.** This is the right line for anchoring.
- **"Use real runtime events. Do not fake 'thinking.'"** Brand v3 already holds this rule (the bot animates from real activity only).
- **A demand-based definition of done.** For example, a community returns for four weeks, and someone asks to fork. This is the directive's "real outcomes" in measurable form.
- **Ontology discipline.** One identity per concept, and no second authorization system.

## 3. Where the spec drifts, with proposed amendments

### 3.1 "The community is the user" vs "The player is the center"

- **Vision:** "The player is the center. Sovereign is the world that grows around them. Every user has their own world." "The world gets larger as the person gets larger."
- **Spec:** "The community is the user." The golden journey starts at "Visit public community profile."
- **Why it matters:** this is the deepest change in the document. A community-first product becomes a team workspace, and the vision is a personal world that contains communities.
- **Amendment:**
  - Change the doctrine line to *"The person is the center. The community is the first pilot."*
  - Keep the community as Build 1's pilot unit and buyer.
  - Signing in still lands a person on their own node (see 3.4).

### 3.2 One scaffold vs "I found 3 ways forward"

- **Vision:** the person asks for a way. Sovereign uses world state plus live research to give a few viable routes, each with real steps. It prefers authoritative sources and attaches the useful link to the step where it is needed.
- **Spec:** §15 suggests one scaffold (community, room, roles, bots, milestones) for the user to accept, edit or reject. It never mentions research.
- **Amendment:**
  - The home prompt ("What are you trying to make real?") returns **up to three routes**. Each route is a proposed Goal → Milestones → Tasks path with the first step ready.
  - Research is a declared, read-only capability. Proposed name: `research.read_public_web`. Sources are attached to the step as evidence, not pasted as text.
  - It is logged like any capability. It fits the spec's rule that external calls need declared capabilities, and a public read needs no approval.
  - A route stays *Proposed* until the person picks one.
- **Repo status:**
  - `lib/world/wayfinder.ts` has one planner (`planVehicleCompany`).
  - `lib/causal` has general route planning, but it plans from World state, not from a question.

### 3.3 The ontology leaves out the vision's own words

The spec says "Use only these canonical objects in Build 1." The list has no Room, Node, Route, Sector Pack or Automation, yet the spec itself uses Room (§7, §9, §14) and Globe. Add one terminology rule: *the vision's words are product language for these objects, not new objects.*

| Vision word | Spec object | Already in the kernel or code |
|---|---|---|
| Room | The live interface of a World and its Sandbox ("Build Room") | Creative Worlds (`lib/world/creative.ts`), `/world/[worldId]` |
| Node | Where a World sits on the globe (`site.location`), at the privacy level chosen | Globe and spatial model (`lib/world/spatial.ts`, `scene.ts`) |
| Personal node / Command Center | The person's own home World: their Worlds, communities, bots and next steps | Partly: `/bot` (bot, saves, first steps) and `/worlds` |
| Route | A proposed Goal → Milestones → Tasks path | `lib/causal` routes; kernel `milestone` entities; v4 tasks |
| Sector Pack | A UXExtension plus a template plus its declared capabilities, which can be forked | Not yet. `DIRECTIVES.md` already says "Pack" (Whop bridge Pack) |
| Capability | Capability | Kernel capabilities and grants |
| Provider Adapter | Provider and Runtime (AI), plus ExternalConnection (services) | `lib/causal` providers, `lib/world/remote-provider.ts` |
| Automation | A UXExtension workflow (§10 "Workflows"), which pauses for approval at any external step | Not yet |
| Event | KernelEvent | Kernel events, hash chain |
| Network State | A Community, with treasury and marketplace later behind the money gate | Kernel `organization` entities and v4 governance |
| SOV | Gated money (`ENABLE_MONEY`) | `lib/money`, `lib/chain` (DEV-SOLVE, test assets) |
| Forge | Not in the spec (see 3.7) | Seed: the connector's `propose_capability` |

### 3.4 No personal node or Command Center

- **Vision:** "The user enters through a living map. Their physical location glows from underneath the world… zoom toward their node, then into their personal Command Center."
- **Spec:** the globe is "a map of public Worlds"; the person's own place on it is missing.
- **Amendment:**
  - Add a fourth scale: *Node = where I am and what is mine.* It is private by default, so the glow is only ever visible to its owner unless they publish it.
  - The Command Center is the page the spec's §15 says to "always surface": the current goal, milestone, next best action, who is needed, what is blocked, and what evidence is uncertain.

### 3.5 Does the world react on its own?

- **Vision:** "The user shouldn't need to constantly ask the AI what happened. The world itself should react intelligently." For example, untouched leads, a supplier's price change, a demonstrated skill.
- **Spec:** the AI coordinator loop (observe → find ready or blocked tasks → propose) reacts only inside a goal's task list.
- **Amendment:**
  - Name *watchers*. These are internal workflows over authorized state that may only create **proposals**, shown with real presence states.
  - The spec's own rules already make them safe: internal workflows need no outside permission, and suggesting grants no authority.
  - For Build 1: one watcher that surfaces stale or blocked tasks and saves still waiting on proof.

### 3.6 Reality Builder: the default artifact is a Markdown brief

- **Vision:** turn imagination into reality (a house, a car, a product), modeling real constraints such as cost, materials and suppliers, and ending in *Prove*.
- **Spec:** §5 makes the default artifact "Markdown project brief." §4 also asks for "one code or visual artifact, selected by pilot."
- **Why it matters:** a brief is the weakest test of "turn ideas into outcomes," because nothing leaves the screen.
- **Amendment:** keep the brief as the document artifact. For the visual artifact, use one that becomes a real thing. The repo already has one path end to end:
  - a bot designs a printable part (`design_part`, with outline, holes and lay);
  - the person downloads the STL and prints it;
  - the save is recorded with proof (`add_proof`), on their word (L0), or with the photo attached (L2);
  - a signed receipt can be shared (`/saved/<token>`).

  That is Imagine → Design → Build → Prove in one loop, and it obeys the spec's rule never to claim a bot did physical work without evidence. ("It's a design until it's printed.")
- The spec's flagship canvas, Solar (§8), fits the vision too, but it needs real-world data feeds and financing talk, both of which sit at the edge of Build 1's risk envelope.

### 3.7 Forge is missing

- **Vision:** "When players repeatedly need something Sovereign cannot express yet, Forge can identify that gap and produce a tested proposal for a new mechanic."
- **Directive:** the directive says the same: "learn from real friction → propose the smallest reusable improvement."
- **Spec:** it has user-led UX creation (§10) but no system-led gap finding.
- **Amendment:** in Build 1, Forge is only a *gap log*:
  - when a request cannot be met by existing commands or capabilities, record a gap event (a non-executable capability proposal);
  - review the log weekly;
  - promote by change class.
- **Repo status:** the seed exists. The connector's `propose_capability` already records structured, non-executable proposals with an acceptance test.

### 3.8 Bring-your-own AI is not a Runtime kind

- **Spec:** "Provider powers Runtime powers Bot," through a `BotRuntime` that Sovereign calls (`generate()`).
- **Repo reality:** Sovereign is reached *by* the person's own assistant. Claude, and any MCP client, connects through `/mcp`, gets consent, and acts through scoped tools under the bot's own identity.
- **Why it matters:** this is the cheapest proof that Bot identity is independent of the provider, which is a Build 1 item. Any MCP-capable client can power the same bot without Sovereign holding a model key.
- **Amendment:** add a second Runtime kind, *client-connected (MCP)*, next to *server-called*. For this kind:
  - the provider policy is the connection's scope (which Worlds, read or add);
  - the context preview is what `read_world` would return.

## 4. Conflicts with standing founder decisions (the founder decides)

1. **The name.**
   - **Spec:** "Sovereign" throughout, including the room shell's top bar ("SOVEREIGN mark").
   - **`DECISIONS.md`, 2026-10-04:** "solve is the master brand. Sovereign stays as the engine and philosophy, and is not used as a consumer name." This is still conditional on trademark counsel.
   - **Recommendation:** read the spec's "Sovereign" as the engine and platform, and keep `solve.` on screen, unless you say the spec supersedes that decision.
2. **Brand promise and palette.**
   - **Spec §14:**
     - "Build together. See what is happening. Know what happened."
     - "Sovereign green" for identity and permission;
     - violet for bot proposals;
     - amber for needs-a-human;
     - a "green verified state" in every room.
   - **Brand v3 (approved 2026-10-05):** "Everything here is real." The cyan point lands only on a real save. Simulated work is labeled Practice. "Verified" is reserved for an outside check.
   - **The concrete clash:** one green "verified" state on every room is a universal trust score in color form. It breaks both brand v3 and the spec's own §6.
   - **Recommendation:**
     - Keep the spec's promise as the product's job description inside the app, and the brand line outside it.
     - Keep its *semantic roles* (proposal, needs-a-human, blocked) as room state colors on v3 tokens.
     - Show verified only at L5.
3. **The one outside bridge.**
   - **Spec:** "Discord or Slack, not both."
   - **`DIRECTIVES.md` (active):** a *Whop* bridge Pack, with Whop membership synced into grants.
   - A directive stands until you edit it.
   - **Recommendation:** let Whop fill the spec's one bridge slot if the first pilot community lives on Whop. Otherwise, say which wins.
4. **The first pilot and flagship canvas** are now three different candidates:

   | Candidate | Source | Note |
   |---|---|---|
   | Verification for trading-signal sellers | `BUILD-BOOK.md` | Sits close to the spec's exclusion of financial data |
   | Solar | Spec §8 | |
   | Printable parts with proof | Already built | |

   One pilot keeps Build 1 honest.

## 5. Inside the spec (wording fixes, no decision needed)

- §2: in the PDF, `ENABLE_EXTERNAL_FINANCIAL_ACTIONS=false` renders as a heading, not as the third flag. It is plainly meant as a flag.
- §3 ("use only these objects") versus §7, §9 and §14, which use Room and Globe: fixed by the terminology rule in 3.3.
- §5's "Markdown project brief by default" versus §4's "one document artifact and one code or visual artifact": see 3.6.
- §14's "Green verified state" versus §6's "Do not reduce trust to one universal score": see conflict 2.

## 6. Build 1 against the repo today

| Build 1 item | Status | Where |
|---|---|---|
| Person ID | Built; staging sign-in unverified | Kernel `register`, Supabase Auth |
| Bot ID, no authority by default | Built | `lib/bot/store.ts`, kernel agents |
| Community | **Missing** | Kernel `organization` entities and v4 governance exist to build on |
| Private World and Sandbox | Built | `lib/world/creative.ts`, kernel scopes |
| Two humans | Grant path built; invite is one panel | `issueGrant`, `app/bot/worlds-panel.tsx` |
| Two bots, two providers | One bot per person. Claude through MCP; a second MCP client is untested | `app/mcp/`, `lib/bot/connector.ts` |
| One social bridge | **Missing** (see conflict 3) | |
| Document plus visual artifact | Built: documents, pixel art, printable parts | `lib/bot/part.ts`, connector tools |
| Low-risk grants, revocation | Built | `setBotAccess`, `revokeConnection`, `revoke_grant` |
| Human approval | Built: consent screen, v4 approvals | `app/oauth/`, kernel v4 |
| Real-time presence | Built, waiting on the staging migration | `lib/bot/presence.ts` |
| Agent execution statuses | Partial: tool-level, not the spec's 13 states | `lib/bot/presence.ts` |
| Activity and provenance panel | Partial: saves and history on World pages, the memory feed | `app/world/[worldId]/page.tsx`, `app/bot/` |
| Export | **Missing** | |
| Fork or remix template | **Missing** | |
| Hash-chain verification | Built | `verify_chain` |
| Merkle anchor | **Missing**; optional | |
| Idea-to-Impact loop | Partial: milestones and tasks in the kernel; one planner | `lib/causal`, `lib/world/wayfinder.ts` |
| One UXExtension | **Missing** | |
| Money gated off | **Not gated**: `/money` is reachable, and no `ENABLE_*` flags exist | `app/money/` |

## 7. Recommended order

1. **Founder:**
   - decide the four items in §4;
   - apply v5 and presence on staging (two SQL files; see `BUILD_STATUS.md`).
2. **Gate money** (`ENABLE_MONEY`, `ENABLE_PAYMENTS`, `ENABLE_EXTERNAL_FINANCIAL_ACTIONS`, all default false). This is small, and it is the spec's first repo-hygiene rule.
3. **Routes from an ask** (3.2): up to three proposed Goal → Milestone → Task paths with the first step ready. This feeds the spec's Idea-to-Impact item and the vision's Wayfinder at once.
4. **Community** on existing kernel primitives (`organization` entity, scope grants, v4 governance), with no second authorization system.
5. **Export, and the context preview for client-connected runtimes** (3.8).
6. **The pilot:** one community, one real project, the printable-part loop or the founder's pick, measured by the spec's demand criteria.
