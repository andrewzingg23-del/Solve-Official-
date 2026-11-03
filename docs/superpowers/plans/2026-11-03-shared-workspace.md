# Shared Workspace Implementation Plan

> Execute natively in this session; user explicitly requested implementation.

**Goal:** Sign in, invite another person, create and revise work, and return to it in a coherent workspace.
**Architecture:** Existing Worlds and versioned artifacts; a new work route composes existing plans/access panels with a document editor and sandboxed preview. Server actions enforce displayed actor, permissions, bounds and versions before provider use.
**Tech Stack:** Next 16, React 19, Supabase Auth, existing kernel and OpenRouter.
**Spec:** docs/superpowers/specs/2026-11-03-shared-workspace.md

## Constraints and review focus
- No schema, production or paid model configuration changes.
- Reject stale/account-switched/unauthorized AI revisions before inference; recheck version on save.
- Model failure preserves saved content. Manual creation/editing works without model.
- Guests are explicitly browser-bound; signing into another identity does not migrate existing projects.
- Preserve source sandbox on new route; test two sessions and third-party isolation.

## Tasks
- [ ] Add real-kernel action tests for creation, duplicate retry, AI revision, stale/concurrent revision, authorization and provider failure.
- [ ] Implement work/actions.ts with createWorkDocument and reviseWorkDocument using existing primitives. Reuse existing first draft action for generation.
- [ ] Implement work/page.tsx and editor.tsx: saved documents, source/text editing, sandboxed preview, next steps and invitation panels. Add routes from home, cards, project navigation and accepted invitation.
- [ ] Expose sign-in, explain guest account switching and improve login/callback continuity. Verify public staging Auth settings without reading credentials.
- [ ] Run focused and full checks, browser desktop/phone and two-person saved collaboration; publish reviewable staging branch and inspect its exact deployed state.

## Updated execution order after founder correction
1. Bring-your-own-provider store, verification, activation and key isolation tests. Existing MCP whoami records a successful connection check; current authorization plus that check activates assistant path.
2. Connection-first entry and server-enforced project creation gate. Remove deployment-key fallback from all user-facing LLM routes; requesting person supplies model/key. OpenRouter first provider adapter, explicit UI.
3. Shared work route and editing/create controls; preserve saved reading after disconnect. AI revisions run only with personal API key; external-assistant users work through MCP.
4. Test/review/deploy staging. No user's provider is connected on their behalf; no key requested in chat.
