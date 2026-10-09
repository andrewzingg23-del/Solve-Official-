# Shared idea space handoff

Branch: `codex/shared-idea-space`, based on main `661dfb7`.

## Use

1. Sign in, create or open a World, and enter its Room.
2. Open **People & access**. Create an invitation with **Can edit** for a collaborator. Send the displayed full link yourself. The invitee signs in and accepts. Links are single-use, expire after 48 hours, and can be cancelled before acceptance. Remove accepted members with the existing member list.
3. Send a shared message or record a decision. A decision names its author; it does not claim group unanimity. Messages survive reloads and have earlier-history pagination.
4. Expand **Bring selected AI knowledge into this room** to publish approved excerpts as a shared document. This is deliberate publication to room members and authorized bots, not automatic account-history synchronization.
5. **Ask AI** reads the same World documents, human-recorded decisions and recent messages. OpenRouter and its model provider receive that selected context. Private personal memory is excluded. Output remains a draft. Document IDs and versions are inspectable under the reply. Failed questions remain saved and can be retried after a reload.
6. Existing MCP-connected assistants can call `read_room` and `post_room_message`. The bot needs World Read/Add access, and posting also needs connection write consent. These tools use the canonical bot identity and cannot record a human decision. Reuse `request_id` when retrying.
7. Expand **Component cost worksheet**, enter prices/quantities/currency, batch size, material waste, fixed overhead and assumptions. Save the estimate as a shared document. Prices are supplied by the user; this feature does not fetch or verify supplier prices.
8. Edit documents from World Details. Stale revisions retain the typed draft and show the newer saved version. Compare it, merge deliberately, then select it as the editing base.

## Activate in staging

Local development and kernel/browser validation do not deploy this release or modify a remote database.

Apply these additive migrations using the project's authorized staging migration process before deploying the matching app version:

- `supabase/migrations/20261009010000_shared_idea_space.sql`
- `supabase/migrations/20261009020000_world_invites_and_revisions.sql`
- `supabase/migrations/20261009030000_room_reply_status.sql`
- `supabase/migrations/20261009040000_private_room_sources.sql`
- `supabase/migrations/20261009050000_room_boundary_guards.sql`

Apply all five in order with the matching app release. Invitation acceptance now takes the original token as `p_token`; the database hashes it internally. Stored digests cannot authorize acceptance, including hashes in historical events. Existing invitation links remain valid. New invitation events omit the digest.

Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the same project. Configure Supabase Auth sign-in/callback settings for the app's staging origin. In-app inference additionally needs `OPENROUTER_API_KEY`. External MCP bot operations need that project's `SUPABASE_SECRET_KEY` and the existing OAuth/MCP setup in `docs/plans/2026-10-04-master-bot.md` and `docs/plans/2026-10-04-bot-world-bridge.md`.

The cloud configuration draft adds the missing variable/secret requirements without supplying values. Its secret destinations are `openrouter.ai` and the repository's staging host `taeikshnbcsjlgbattyp.supabase.co`. If a different Supabase project is chosen, update the secret destination to that exact host in environment settings. Review/save and publish the environment configuration to make it available to future cloud tasks. Publishing the cloud environment does not deploy the app or apply migrations.

## Verification

- `npm test`: real migrated kernel and existing application tests.
- `npm run typecheck`, `npm run lint`, `npm run build`: standard repository checks.
- `npm run test:shared-room`: two Chromium contexts against real migrated SQL; authentication and inference are labelled fixtures. Set `CHROMIUM_PATH` if Chromium is not at `/usr/bin/chromium`. Screenshots are generated in ignored `.browser-tests/shared-room/`.

The browser journey covers invitation acceptance, two-person persistence, decisions, deliberate shared-source publication, source-grounded inference, failure/retry across reloads, stale-edit retention, cost calculation/persistence, identical fresh submissions, history retention during refresh, legacy malformed-source rendering and mobile overflow. The HTTP tests exercise the same domain handlers used by the Next routes. Without live Supabase/model configuration, they do not validate live Auth, OAuth/provider integration, remote migrations, or deployed behavior. A real-Postgres concurrency/load check remains outstanding; local PGlite validates the SQL guards and transitions.

## Review resolution

One independent whole-branch review reported four Important findings and no Critical or Minor findings. All four received regressions and fixes:

- Invitation acceptance hashes the raw token inside the authoritative RPC. A disclosed digest cannot join a World. New shared history omits the digest; upgrade tests retain existing links and exact creation retries.
- The reply RPC validates each source-reference field. The renderer filters malformed historical references so an old append-only row cannot crash the room.
- The composer retires acknowledged request IDs. Separate identical submissions persist separately; saved-question retry actions retain their original ID.
- The conversation retains displayed messages across latest-window refreshes and updates overlapping records, preserving earlier history and current reply state.

The reviewer declined to judge live Supabase/Auth/provider integration, remote migration deployment and real-Postgres concurrency. Those checks remain staging work; no review finding was waived.

## Remaining roadmap

This release delivers the shared work loop. Continuous identity/profile synthesis, wider external imports, adaptive component specifications, supported connector jobs, isolated generated tools, reputation, merchant payments and user-held encryption keys remain separately scoped. No claim of live card issuance, end-to-end encryption, decentralization, or unrestricted integration generation is introduced here.
