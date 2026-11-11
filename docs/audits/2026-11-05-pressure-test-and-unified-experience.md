# ONE SOLVE: adversarial engineering review + unified experience contract
Date: 2026-11-05. Scope: source inspection of main and `feature/world-multimodel-agents`, `codex/sov-shared-visual-language`, `codex/sov-step-one`; metadata and documented browser evidence. **No new executable test suite run in this review, no database changes, no source merges, no production deployment.**

## Governing decision

Preserve `DECISIONS.md`: `Solve-Official-/main` is the canonical product; `sovereign-passport` is the separate SOV ID service (Neon-backed), linked by OAuth + MCP; Supabase production/staging remain distinct. Do not make a second identity or authorization model.

## Observed code and major failure modes

| Boundary | Code observed | Adversarial failure to prove / remedy | Gate |
|---|---|---|---|
| World chat | `lib/world/room.ts`; `app/api/worlds/[worldId]/conversation/route.ts` | `postRoomMessage → claimRoomReply → complete → finishRoomReply`; catch collapses provider, lease and save failures. Existing P0 #47. Candidate branch has `tests/world/room-safe-diagnostics.test.ts` and classified provider vs save failures. Run E2E with real model, persisted exact readback, failure injection, timeout and retry. | P0 |
| Connection/consent | `lib/bot/mcp-http.ts`, `mcp-auth.ts`, `app/oauth/consent/actions.ts` | OAuth connection kernel event is recorded **before** Supabase authorization is approved. Failure between them can leave an orphaned recorded connection. Probe metadata, dynamic registration, redirect, cancellation, partial failure and revocation. Server exposes stateless JSON MCP POST; verify compatible client behavior, including GET 405 response handling. `publicOrigin` trusts forwarded host/proto; assess trusted host behavior on Vercel. | P0 |
| Passport bridge | `lib/passport/client.ts`, `link.ts`, `context.ts` | Multiple concurrent refreshes; sealed-token/key rotation partially failing; unlinked owner revoking access while requests in flight; stale cache after revocation; account change; unsupported token. Passport context must never automatically enter shared World prompts. | P0 |
| Private/shared information | `lib/world/room.ts`, `lib/world/collaboration.ts`, `lib/bot/memory.ts` | Shared context filters visibility != private, limits sources; verify every read path and agent request enforces same scope. Test adversarial member access, source-ref leak, incorrect SOV ID/account correlation, revocation after invite and before reply. | P0 |
| Task and runner | `lib/kernel/client.ts`; branch `feature/world-multimodel-agents/lib/world/tasks.ts` and `lib/capabilities/registry.ts` | Native task/create/approve built; worker not dispatched. Candidate registry distinguishes configured vs verified, disables worker. Must prove real bounded grant, cost limits, job identity, replay safety, GitHub PR, receipt and cancellation. Queue visibility does not imply exactly-once side effects. | P0 |
| Shared Studio | `lib/world/studio.ts`, `lib/studio/document.ts` | Revision parent set and multiple heads are modeled. Test true simultaneous editor forks, old-version rejection, revocation, mobile/WebGL fallback, inaccessible material/color and deterministic exports. | P1 |
| Model selection | `lib/bot/openrouter.ts`; candidate `lib/world/agent-models.ts` | Provider keys only mean configured, not usable; account subscription is not API funding. Verify actual model ID/endpoint, billing/quota, redaction, empty response, safe fallback, provider-specific rate limits, metering and context ownership. | P0 |
| Private RLS | Supabase projects; audit issue #55 | `kernel.room_replies` and `kernel.world_invitations` RLS disabled in both active DBs, BUT SQL `has_table_privilege` showed anon/auth cannot directly SELECT or INSERT in either. Inspect PRIVILEGES, exposed schemas, security-definer paths; test and add defense-in-depth RLS only via reviewed additive migration. | P1 |

**Evidence distinction:** Static inspection identifies possible failures; the checks above are not all reproduced. `main` latest observed production deployment READY at `5529d1c`. Preview branches and screenshots are not production proof. Candidate `feature/world-multimodel-agents` is 75 commits ahead of main (compare on 2026-11-05) and its own as-built doc confirms the coding dispatcher is absent. Do not merge it wholesale.

## One experience, one underlying system

### Interface primitives (in all skins)

1. **Identity** = one persistent Passport/SOV ID, account/access state, remembered preferences, approved memory. UI must expose owner and account clearly.
2. **Space** = persistent World; users can create, open, search and return to work. Different presentation skins never clone project data.
3. **Presence** = users and independently identified agents currently in a World, with explicit permission, activity and scope.
4. **Intent** = one main input, interpreted into a proposed route, answer, editable artifact or governed task; no fake automatic execution.
5. **Activity/evidence** = user-visible provenance, source versions, approvals, pending/failure and reversible operations.
6. **Capability** = app/model/tool registry, explicit connection, scope and status. `configured_unverified` must never display as `connected`.
7. **Creation** = shared editable artifact (text, design, 3D document, workflow or app) with version history and collaborative heads.
8. **Environment** = presentation blueprint; distinct skins/layouts on common data and security contracts.

### Source of visual truth

`docs/sov-reference/README_VISUAL_TARGET.txt` on `codex/sov-shared-visual-language`: `01_APPROVED_FULL_COMPOSITION.png` authoritative, `02_DESKTOP_HOME_REFERENCE.png` for Home and customization, `03_ONBOARDING_REFERENCE.png` for onboarding. True implementation = HTML/CSS/React controls, not screenshot hotspots. Source imagery can be separated, interactions must remain real. The 2026-11-04 design QA records **founder approval of direction**, not comprehensive final screen approval.

Production `app/globals.css` hard-codes `#04070d` dark cyan `#22d3ee` and cinematic interface. Candidate branch adds `app/product/tokens.css` SOV material family: graphite/glass, muted gold `#e8bd82`, warm typographic editorial system, spatial environment. **These conflict.** Define SOV tokens by semantic role (canvas, content, surface, glass, elevated, focus, action, success, risk, overlay, depth, typography, motion, spacing) and map them per skin. Avoid global or scattered hard-coded palette overrides. Keep warm Atelier as approved flagship, Standard accessible, Backstage user-chosen expressive scene; the system's behaviors stay invariant.

### Visual architecture

- **Home / Cockpit:** ambient scene behind a real operable UI; identity/avatar, single intention composer, 3–4 relevant Spaces, Continue/Waiting, trusted activity.
- **World / Room:** same ambient material and layout grammar; contextual Space header, participants, conversation + canvas + artifacts, task state and provenance. No independent UI style for development room.
- **Passport:** separate service remains independent; entry, consent and return share branding/typographic/material cues. Do not fake unified backend ownership.
- **Agent console:** same avatar/presence grammar as Home; model choice is a capability selection, not a new bot identity; reveal what model can read/do and charge.
- **Studio/Spatial:** reuse World artifacts, saved document revisions and permission layer; 3D is a presentation/editor of the same objects, not a separate persistence backend. Provide 2D fallback.
- **Community/Packs:** community is a World with a public front door; pack is an enabled capability in that World, not a separate app.
- **Security and consent:** source, permission, model/provider, last action, approval, revoke all visibly legible and not hidden behind decorative glass.
- **Mobile:** single focused task/scene, bottom navigation clear of safe areas, optional canvas modes; controls remain usable at 375/390 px, keyboard and reduced-motion tests. Scene must never block readability.

### Configuration contract (presentation cannot authorize)

Keep `ExperienceBlueprint` separate from canonical `Actor/World/Task/Grant/Event`. Typed versioned skin/layout overrides, semantic tokens, view registry, visual assets and interaction availability. All actual features resolve server-side permissions. AI may propose an experience change but must show preview and need approval, retain undo; changing a skin resets no content, identity, grants or task statuses.

### Pressure-test UX copy states

Every task/action must distinguish:
- `draft` (proposal)
- `needs_approval` (requires person)
- `queued` (accepted, not started)
- `running` (worker actually leased)
- `failed` (error plus retry path)
- `completed` (result saved)
- `verified` (evidence independently checked)

Never use “done”, green tick, or connected badge solely for a queued task, configured credential or successfully deployed preview.

## Test matrix — minimum high-value journeys

1. First-run anonymous/staging identity → project → persist → reload → attempt other user's project (deny) → secure account claiming → same principal after second device.
2. Home skin/layout Standard↔Atelier↔Backstage: **same** World IDs, documents, grants, agent IDs and conversation; reset visual choices without deleting content.
3. Shared-room two-member, two-agent: independently authenticated, read own/allowed sources, no private memories, attribution, edits/history, revocation.
4. Ask AI provider success and errors: one question ID, one response, exact persisted readback, idempotent retry; actionable error category.
5. MCP consent and Passport link: registration, complete, decline, failure, revoke, reconnect, concurrent token refresh, cross-environment issuer rejection.
6. Task request→approved→actually dispatched→PR or artifact→independent verify→history; no unsupported worker or cost claim.
7. Full mobile, keyboard, screen reader, low GPU, reduced-motion, low bandwidth; task status and approval controls usable without a 3D rendering.

## Sequence of executable work

**A.** Isolate & cherry-pick *only* the safe diagnostic fix and its tests from `feature/world-multimodel-agents`, independently confirm full chat+room behavior; close P0 #47 after real persisted readback.

**B.** Validate Passport + OAuth with stable identity and staging account mapping; choose a single external provider read-only and verify whoami/get_context.

**C.** Extract approved SOV semantic token system and ExperienceBlueprint from the reviewed design branch; migrate one complete Home→World→Agent→Consent journey, preserving existing server data and action behavior.

**D.** Bring native task planning/approval and *one actual* bounded worker online, then verify permanent receipts, failure recovery and scope control.

**E.** Broaden to community, studio, reusable Packs and additional integrations only after these tests.

No production merge or migration authorized by this review; prepare reviewed PRs for each separately testable slice.
