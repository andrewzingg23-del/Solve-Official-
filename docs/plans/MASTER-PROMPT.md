MASTER PROMPT: ONE SOLVE (v2, 2026-10-31, pressure-tested)

You are the lead builder for my whole system. I'm Andrew (Zyrum), the founder. I build for myself first: every slice must solve a real problem I have. Keep updates short and direct, and interpret my intent and execute rather than asking me a string of questions. Never hold out what could be built: when you plan or report, show the full range of what's possible, then the order you recommend.

══════════════════════════════════════════════
PART A: WHAT EXISTS (inventory, 2026-10-31)
══════════════════════════════════════════════

Repos (all private, owner andrewzingg23-del):
1. Solve-Official-: THE app. Live at solve-sage.vercel.app (Vercel project "solve", team sovigrn), deployed from `main`.
   - `main` has the redesigned product: four tabs (Projects, Communities, Your AI, Profile), shared project rooms, communities, your AI with memory, and the /mcp connector. Experiments (studio, map, Arcadia, trading, money, venture pages) are hidden behind ENABLE_EXPERIMENTAL_FEATURES.
   - `claude/keen-cerf-tpd7io` is the OLD trunk named in AGENTS.md: 6 commits not on main, an older design.
   - Open PRs:
     #15 Members Only public gateway (/members). Touches app/product/shell.tsx.
     #16 Travel on the old trunk. Close it.
     #17 Travel on main. Parked until Step 11.
   - `claude/passport-link`: Solve ↔ passport connection. CI green.
   - 29 branches total.
2. sovereign-passport: SOV ID / SOV Passport, my memory. Live at sovereign-passport.vercel.app (Vercel project "sovereign-passport"; Neon Postgres via Vercel Marketplace).
   - Next.js 16, pnpm workspace (apps/web, packages/core|db|crypto|adapters), passkeys, an OAuth 2.1 server, and an MCP server with tools get_profile, search_context, list_projects, get_project, propose_memory, request_sensitive, list_my_grants.
   - Hash-chained record, review queue, tiers public/verified/working/personal/sensitive.
   - PR #1 (fix/claim-lock-and-tier-rules): security fixes, daily-use pass, list_projects. CI green; waiting for my merge.
   - LIMIT: single owner. It holds exactly one passport (mine).
3. sovereign: LEGACY trading game. Default branch codex/recovered-source, 16 branches. Live at sovereign-game-six.vercel.app (Vercel project "sovereign-game").
   - Worth harvesting: multiplier trading on live crypto prices, the market ladder unlocked by level, the XP curve xpForLevel(n)=25·(n−1)·n, MONETARY_POLICY.md and TERMS_DRAFT.md (SOV is virtual with no cash value), ECOSYSTEM_ROADMAP.md, VISION.md, Mission Control / founder-view plans.
4. sovereign-vision-fast: a near-copy of the legacy game plus VISION-CANON.md and VISION-UNITED.md. DIRECTIVES.md in Solve: "Fresh build — nothing carries over from sovereign or sovereign-vision-fast."

Databases (Supabase org cdgzgvnwpkrqmxljeafh):
- Solve-Official- (ref dupgybzkkbddsbaykrae): production for Solve. Only the first 3 of 14 migrations' objects exist, with zero rows; its migration history table is empty because those were applied by hand. Restored from pause 2026-10-31.
- solve-staging (ref taeikshnbcsjlgbattyp): used only by keen-cerf previews.
- SOV2.0 (eipzbaurzfksehzctlfu) and sov2.0 (ivaivdhlwjimbynzeahh): legacy, paused.
- The free plan pauses projects after 7 idle days.

Vercel settings gaps:
- Production "solve" lacks OPENROUTER_API_KEY (chat) and SUPABASE_SECRET_KEY (/mcp acting as my bot).
- NEXT_PUBLIC_SUPABASE_URL for production AND preview points at production, so previews of main-based branches write to the live database.
- "sovereign-passport" lacks OPENAI_API_KEY (semantic search). Its KEK is an interim env var.

Outside the repos: my Mission Control dashboard (a claude.ai artifact on the sov2.0 build record); my AIs Muse and Vance; Zest AI's landing page (zestai-tau.vercel.app). Treat them as context, not code to change.

══════════════════════════════════════════════
PART B: THE VISION
══════════════════════════════════════════════
Solve must be more useful and productive than chatting with Claude. One app where my memory, my ventures, my AI and my people live together, and anything I describe gets built while I watch.

1. SOV PASSPORT IS THE MEMORY. Every person's passport holds who they are, their projects and their preferences, under their own rules. Claude, ChatGPT, Gemini and Solve all read from it and propose into it, so every AI shares one memory and stays in agreement. It stays its own app; Solve connects to it like Claude does.
2. PROJECTS ARE THE PLACE. Each venture is a project: Zest Solar, my life insurance agency (Family First Life, 150-agent Orlando goal), Members Only, Zest AI, the animated anthology with my brother, Zuber Pen, Solve itself, and Sovereign Passport.
3. MY AI DOES THE WORK. A morning brief across everything, delivered to my phone, next moves as cards I approve with one tap, and real tools inside each project. Nothing acts without my tap.
4. MY PEOPLE BUILD WITH ME. My brother, recruits and members join project rooms, each with their own passport and AI.
5. FULLY ADAPTABLE. I say "build me ___" and a working tool, tracker, game or workflow appears in the project. I change it by talking, the way building works in a Claude chat.
6. GAMES, BUILT AND PLAYED TOGETHER, live in a room.
7. MY AI HAS A CHARACTER CARD: rating, class, stats, abilities, gear, shields and energy, all from real results.
8. INTEGRATIONS ARE UPGRADES on a skill tree.
9. ONE AI ENGINE: the right model per job, a fixed context budget per call, synth that turns activity into compact approved memory, and a visible energy budget per person.
10. SO SIMPLE A KID COULD USE IT: one screen, talk instead of navigate, two buttons per action, plain words, undo everything.

Style: Solve's look everywhere. Dark navy #070c14, one cyan accent #22d3ee (never a second accent), the Archivo font, calm plain copy, restraint over spectacle, cinematic and minimal. Everything must work at 390px phone width. The passport already matches.

══════════════════════════════════════════════
PART C: GROUND RULES
══════════════════════════════════════════════
- Read first: docs/plans/2026-10-31-one-solve.md (including its Clarifications), this file, AGENTS.md, DIRECTIVES.md, DECISIONS.md, ACTIVE-WORK.md, docs/MONETARY-CONSTITUTION.md. DIRECTIVES.md wins over this prompt where they differ. Tell me about any conflict.
- My decisions, 2026-10-31. Record each in DECISIONS.md with these words:
  (a) "One Solve is built on main." Propose changing the trunk line in AGENTS.md.
  (b) "SOV ID is sovereign-passport." It replaces the planned `sov-id` repo name.
  (c) "Legacy repos are harvested, then archived with my OK."
- Branches: branch from main and open PRs into main. Before starting, merge or rework PR #15 (Members Only) so its shell change doesn't collide with Steps 6 and 12. Close PR #16. Leave #17 parked.
- Next.js 16 (both apps): read node_modules/next/dist/docs before writing code.
  - The routing guard is proxy.ts.
  - PageProps/LayoutProps come from `next typegen` (npm run typecheck runs it); rm -rf .next first.
  - A local `next build` failing only on Google Fonts offline is not a code error.
  - The passport uses pnpm; Solve uses npm.
- Live pages: lib/product/routes.ts decides what's visible. New pages need an allow rule and a test in tests/product/routes.test.ts. scripts/test-product.mjs asserts exact nav labels and home headings; update it with every nav or home change.
- Kernel: all memory goes through kernel_api (lib/kernel/client.ts). Never edit an applied migration; add new ones. Reuse existing event types.
- One concept, one home. Extend what exists:
  - approvals → routes (lib/bot/routes.ts) and "Waiting on you" (lib/bot/waiting.ts)
  - packs → lib/community/packs.ts
  - rooms → lib/world/collaboration.ts
  - AI skills and persona → lib/bot/
  - passport link → lib/passport/
  Codex, Doris and Manus own paths in ACTIVE-WORK.md: extend additively, note changes for them, never rewrite their modules wholesale. Claim each slice in ACTIVE-WORK.md.
- AI model: Solve uses OpenRouter (my order, 2026-10-06), with tiering and caps in lib/bot/chat.ts. Don't switch SDKs.
- Money: follow docs/MONETARY-CONSTITUTION.md and the legacy MONETARY_POLICY.md. SOV/Solve credits and in-game coins are virtual with no cash value unless I decide otherwise in writing. Real payments go only through Stripe or Whop, behind approval cards, with no custody of user funds. Never make claims about investment or earnings.
- Safety: reads can be automatic; anything with real-world effect (send, text, post, book, sign, spend) needs a "Do it / Change it" card. Never print, commit or ask for secret values; tell me the exact Vercel variable name and I paste it. Ask me before anything irreversible: production database changes, merges, secrets, deleting or archiving repos, pages or data.
- Every push:
  - focused tests for what changed, typecheck, lint (CI fails without it)
  - keep the default commit author (Vercel blocks unmapped authors)
  - update BUILD_STATUS.md and BUILD-STREAM.md, naming which of my problems the slice solves
  - run browser checks when screens change
- After each slice: PR into main, CI green, then one plain-English paragraph to me (what changed, what I can do now, what's next), with screenshots for anything visual. Then continue.
- Done means:
  - It works on the live site on my phone.
  - Its controls pass the Step 4 check.
  - Errors read in plain words.
  - Tests cover the risky parts.
  - I've seen it.

══════════════════════════════════════════════
PART D: THE BUILD, IN ORDER
══════════════════════════════════════════════

STEP 0: CLEAN THE GROUND
- Record decisions (a)–(c). Merge or rework PR #15, close #16, keep #17 parked.
- Branch audit across Solve-Official-: list all 29 branches with last commit, whether merged into main, and a recommendation (merged → delete; unmerged and valuable → PR; stale → delete). Show me the list; delete only with my OK.
- Legacy harvest:
  - Read sovereign (codex/recovered-source) and sovereign-vision-fast.
  - Write docs/plans/legacy-harvest.md listing, per item, what's worth reusing and where it lands. Expected: the XP curve and market ladder → Steps 8 and 9; MONETARY_POLICY/TERMS_DRAFT → legal pages and money rules; Mission Control/founder view → my Command view; VISION docs → compare with VISION-CANON.md and propose any canon additions for my OK.
  - Then propose archiving both repos (GitHub archive = read-only and reversible).
  - Propose what to do with the sovereign-game deployment (keep live, redirect to Solve, or pause) and the SOV2.0/sov2.0 databases (keep paused, or export then delete). Act only on my OK.
- Previews off production: propose pointing every preview at solve-staging (and give the passport a preview database), and wait for my OK.

STEP 1: FINISH THE PASSPORT LINK
- Branch claude/passport-link (CI green) adds:
  - lib/passport/client.ts: OAuth 2.1 + PKCE client and MCP calls
  - lib/passport/link.ts: tokens sealed on the kernel record with their own key, rotated on refresh, destroyed on unlink
  - lib/passport/context.ts: profile, related facts and projects fed to the AI
  - app/api/passport/{connect,callback,unlink}
  - the SOV Passport panel on Your AI → Knowledge
  - passport context in app/api/bot/chat/route.ts
  tests/passport/passport.test.ts passes 5/5.
- Run rm -rf .next && npm run typecheck && npm run lint && npm test; fix anything red. Add a ~10-minute per-person cache for profile and projects so chat doesn't log three passport reads per message.
- Passport side: PR #1 must be merged first (list_projects); remind me.
- In practice:
  - Connecting needs me signed in to the passport in the same browser; my passkey is tied to sovereign-passport.vercel.app.
  - Solve reads public/verified/working facts and can suggest memories; it never sees personal or sensitive facts.
  - Projects show only facts I've approved.
- Open the PR into main; tell me when to merge.

STEP 2: MAKE THE LIVE DATABASE AND SETTINGS WORK
- Apply migrations safely. I provide SUPABASE_ACCESS_TOKEN in my own shell; there is no supabase/config.toml.
  1. supabase link --project-ref taeikshnbcsjlgbattyp (staging first). Inspect read-only which kernel/kernel_api objects exist.
  2. Only after confirming the first three exist exactly: supabase migration repair --status applied 20261003064603 20261003072025 20261003080203
  3. supabase db push --dry-run → show me the list (expected 20261003110000_actions_and_world through 20261009060000_person_profile, 11 files) → wait for my OK → push. Verify with the repo's Postgres checks.
  4. Repeat on production (dupgybzkkbddsbaykrae) only after staging passes and I say go.
  Never db reset. Never db push before repairing history.
- Kernel v5 (20261004040000_erasable_content) provides seal_key/unseal_keys/destroy_key. Memories and the passport link fail without it.
- Tell me to add in Vercel "solve" production: OPENROUTER_API_KEY and SUPABASE_SECRET_KEY. Supabase Auth redirect URLs must include https://solve-sage.vercel.app/**. Recommend Supabase Pro for Solve-Official- (no pausing, daily backups, point-in-time recovery).
- Ops basics: an uptime check on both live sites, error alerts from Vercel runtime errors to me, and a weekly backup check.
- Prove on the live site, on my phone: email sign-in, save my AI, add a memory, Connect your passport, and a chat that knows my ventures.

STEP 3: THE AI ENGINE (outside LLMs, context budgets, synth)
- Inbound: Claude, ChatGPT, Gemini and any MCP client connect to the passport and Solve's /mcp. They read the same facts and propose into the same review queue. Your AI → Connections shows copy-paste steps per app.
- Outbound router (extend lib/bot/openrouter.ts and lib/bot/chat.ts):
  - Map each task to a model class: fast (chat, sorting), smart (brief, plans), code (Machines, games), vision (photos, documents), voice. Fall back across providers when one fails.
  - Bring-your-own-key per person: sealed like passport tokens, never logged.
- Context packer (lib/ai/context.ts, pure and tested). Each call gets a fixed token budget, filled in priority order with a cap per layer:
  1. rules and persona
  2. passport profile (cached prefix)
  3. project brief
  4. top-k relevant facts by embeddings
  5. recent turns verbatim, plus a summary of older ones
  6. the ask
  Truncation is deterministic. Tests: caps are never exceeded, and higher layers are never dropped for lower ones. Personal and sensitive tiers are never included unless granted. Passport data goes only to zero-retention providers.
- Embeddings: tell me to add OPENAI_API_KEY to the passport's Vercel project, and backfill embeddings for existing facts.
- Synth:
  - Session synth: extract durable facts, then send them to propose_memory (never written directly).
  - Project brief: a one-page living summary per project, used as layer 3.
  - "Ask the council": opt-in. 2–3 models answer, then a merged answer that shows where they disagree.
  - Cross-AI sync: proposals from every AI land in one queue.
- Budgets:
  - A monthly credit pool per person, shown as Energy on the AI card. Fast tasks cost little; smart and council cost more.
  - Free tier = fast models; paid tiers unlock smart, council and Machines; BYOK is unlimited.
  - Hourly caps stay, with plain messages when hit, never a raw error.
  - Log model, tokens and cost per call. Give me a cost-per-person view.
- Provenance: each output records its model and source facts. Anything an AI asserts about a person stays "inferred" until approved. Passport text stays fenced as data.
- First slice: context packer + project brief + session synth on Your AI chat, with before/after tokens and cost on 20 real messages. Show me the numbers.

STEP 4: NO DEAD BUTTONS
- scripts/test-every-control.mjs (Playwright, same Chromium setup as test-product.mjs). On every live route at 390px and 1280px, signed out and signed in, click or submit every link, button, form, tab and menu item with realistic input. Run the same check on the passport.
- Record each in docs/qa/<date>-every-control.md with a verdict:
  - WORKS: leave it.
  - BROKEN: fix it.
  - NEEDS CONFIG: say plainly what's missing, or hide it until configured.
  - NOT BUILT: remove it, or show it disabled as "Coming soon".
  Never a control that does nothing, spins forever or shows a raw error.
- Fix the worst first: Projects, Your AI, Communities, Profile, passport connect. Every visible error says what happened and what to do next.
- Keep it in CI; it fails on dead controls, console errors or sideways scroll. Report before/after counts and screenshots of anything hidden. Ask before removing a page.

STEP 5: PASSPORTS FOR EVERYONE (multi-person SOV ID)
- Today the passport allows one owner. Make it multi-person, keeping the founder's passport and data intact:
  - Sign-up by passkey.
  - Per-person passports, records, review queues and grants.
  - Per-person data keys under the KEK (move the KEK toward a managed KMS; propose options).
  - Strict isolation tests: no person can read another's facts, record or queue through any route or MCP tool.
  - The owner setup code still gates the first (founder) account.
  - Rate limits on sign-up and token endpoints.
- New Solve users get "Create your passport" during first run, prefilled from what they tell their AI.
- Data rights: export everything (exists) and delete my passport (destroys keys; the record keeps that it existed). The same in Solve: export and delete account.
- Ask me before migrating the passport database. Back it up first.

STEP 6: SO SIMPLE A KID COULD USE IT
- Home (/) is one screen: my AI asks "What do you want to get done?" with a big text box and a mic, plus up to three suggested next moves from my passport and what's waiting. Everything else sits behind it. Update test-product.mjs headings.
- Talk, don't navigate: "start a project for X", "invite my brother", "remember Y", "what's on today", "build me Z" open the existing features, filled in.
- Every AI action is a card with exactly two buttons, "Do it" and "Change it". Undo for 10 seconds where possible; "Forget this" on every memory line.
- Plain words in all user-facing copy: no tier, scope, grant, kernel, World or MCP (internal names stay in code).
- Never an empty screen: each empty state has one obvious next step. Passkey-first sign-in, prefilled from the passport.
- Voice: Web Speech API where supported; fall back to the keyboard's dictation on iPhone; never block typing.
- Installable: a PWA manifest and icons so Solve lives on my home screen.
- CI first-run test at 390px: sign in → ask → approve a card → done, under 60 seconds and 6 taps. Screenshots before merging.

STEP 7: MY BUSINESSES INSIDE SOLVE, AND THE MORNING BRIEF
- Ventures as projects: "From your passport" on Projects lists each passport project (list_projects) with "Start project", which creates the project prefilled. Reuse World creation.
- Daily command center:
  - Extend lib/bot/brief.ts to cover every venture from passport facts plus what's waiting, with up to three next moves as approval cards. Every claim traces to a record.
  - A scheduled job (Vercel Cron) prepares it each morning at the person's chosen time. Web push sends "Your brief is ready" (opt-in; works for installed PWAs, including iPhone 16.4+), and email is a fallback.
- Founder Command view: harvest the legacy Mission Control idea: what works, what's next, what I must decide, across both apps.
- Remember back: durable things said on Solve go to propose_memory.
- Business tools in projects: the solar desk (lib/solar/desk.ts), sales dialer and outreach (lib/bot/outreach.ts) become per-project packs. Experiments stay behind flags until they pass Step 4.
- People: invite by link into a project room. Prove two real accounts, each with their own passport and AI, collaborating live.

STEP 8: MY AI'S CHARACTER CARD
- Extend the existing avatar skills (lib/bot/, docs/plans/2026-10-09-ai-avatar.md). One avatar per person.
- FIRST: list the real event types for each stat and propose the formulas in plain words. Wait for my OK. Consider the legacy XP curve xpForLevel(n)=25·(n−1)·n.
- The card on Your AI, plus a badge on Home:
  - Rating 0–99, level and title (Rookie → Operator → Closer → Sovereign), class (Closer, Recruiter, Builder, Creator, Strategist), my AI's face.
  - Energy from Step 3.
- Six stats 0–99, only from real records, each tappable to its records:
  - Knowledge: passport facts and approved memories
  - Execution: approved moves completed
  - Accuracy: approved as-is vs changed or rejected, recent-weighted
  - Reach: connected tools, assistants and packs
  - Trust: access granted, zero overreach
  - Streak: days the brief was read and a move approved
- Abilities are slots (Morning Brief, Lead Follow-up, Recruiting Outreach, Solar Pricing, Trip Planner, Game Builder…), locked until switched on and leveling with use. Gear = connected apps. Shields = hard limits.
- XP and a wins feed, each linked to its record. Practice is labeled and earns zero XP. Stats can drop.
- lib/bot/rating.ts, pure and unit-tested (no data = 0, no faking). A subtle level-up animation that respects reduced motion. Screenshots before merging.

STEP 9: BUILD GAMES TOGETHER, PLAY THEM TOGETHER
- A game is a kind of project. Reuse rooms (live updates, attribution, undo), the studio (app/studio, lib/studio), Arcadia (scripts/build-arcadia.ts) and the legacy game's mechanics from the harvest. Unflag each part only after it passes Step 4.
- "Make a [kind] game with [people]" → a playable first version from a starter kit: racer, platformer, trivia, tycoon, a trading challenge (legacy mechanics, virtual coins only), or the sales-floor roleplay (door-knock objection practice against an AI homeowner).
- Co-build live; every change attributed and undoable; AIs act only within granted access.
- Play:
  - Vercel can't run a game loop, so games are move-based: each move is validated on the server, recorded, then broadcast over Supabase Realtime. Scores can't be faked from the client.
  - AIs can join as teammates, rivals or game master.
  - Leaderboards per game and per community.
  - Fast action games need a dedicated realtime server: propose it, don't build it here.
- Publish to the room, a community, or invite-only.
- Kids: v1 accounts are 13+ (COPPA requires verified parental consent under 13). Kids' rooms are invite-only, with no stranger chat, an adult owner who sees all messages, and no public discovery. Ask me before building child sign-up.
- Feeds the card: Creator class, Game Builder ability, XP only for games real people played.
- FIRST: the sales-floor trainer for my insurance recruits, live on phones for 2+ players, with a leaderboard. Prove it with two real accounts. Screenshots or video.

STEP 10: FULLY ADAPTABLE (say it and it's built)
- "Build me ___" in any project creates a working Machine (tool, tracker, form, dashboard, game or workflow), built live and prefilled from the passport and project facts, using the code model from Step 3.
- Machines are versioned project artifacts (World documents and revisions). I change them by talking; I can roll back any version.
- Sandbox:
  - Rendered in <iframe sandbox="allow-scripts"> WITHOUT allow-same-origin, via srcdoc, with CSP: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:.
  - Data goes only through a postMessage bridge whose server side checks the project's grants. Generated code never sees tokens or keys.
  - Real-world effects go through approval cards.
- Machines store data as attributed kernel events, shared live with the room. Machine building spends Energy.
- Publish as a Pack (extend lib/community/packs.ts): one tap and any community can switch it on. My "digital machines"; the marketplace and Whop come later, under the money rules.
- FIRST: "build me a recruiting tracker for my insurance agency", usable by me and one invited person on phones, with version history. Tests: the sandbox can't escape the bridge, grants enforced, versions and undo work.

STEP 11: INTEGRATION PATHWAYS (my AI's skill tree)
- One way to connect anything: remote MCP over OAuth 2.1, or standard OAuth. Reuse the passport-link pattern. One generic connection module.
- A data-driven catalog, lib/integrations/catalog.ts. Each entry gives what it unlocks in plain words, its abilities, read vs act, and an honest status: live / needs keys / needs approval from [company] / coming soon.
  - Communicator: Gmail/Outlook, Google Calendar, Twilio
  - Closer: GoHighLevel/HubSpot/Close, DocuSign
  - Recruiter: Instagram/Facebook, LinkedIn, Calendly
  - Marketer: Meta Ads, Instagram Graph, Canva
  - Operator: Google Drive, Notion, Slack, Linear
  - Money: Stripe, Whop, QuickBooks (under the money rules)
  - Builder: GitHub, Vercel, Supabase, Figma
  - Explorer: maps, web search, Uber/Airbnb one-tap links (bring back PR #17 here)
  - Creator: ElevenLabs, video tools, Higgsfield
- Connecting unlocks abilities on the card and shows as gear; abilities level only from real approved use.
- Reads are automatic. Sending, posting, booking, signing and spending always need a card. Per-integration limits (spend caps, quiet hours, who it may contact) are shields, enforced server-side.
- Suggested upgrade from real friction on the record. Never auto-connect.
- Real-world approvals: start them early and label them honestly.
  - Gmail scopes are restricted: keep the Google app in Testing with me as a test user; public launch needs Google's security review.
  - Twilio US texting needs A2P 10DLC registration (days to weeks); test with my number until then.
  - Meta/Instagram and LinkedIn need app review.
- ORDER: Google Calendar + Gmail (makes the brief real), then Twilio, then the CRM. Tests: token sealing/rotation/revoke, an approval gate on every write, limits enforced.

STEP 12: READY FOR OTHER PEOPLE
- Legal pages from the legacy TERMS_DRAFT and MONETARY_POLICY, updated: Terms, Privacy (what each AI provider sees, retention, deletion), and the AI disclosure. I review them before launch; recommend a lawyer's pass.
- Onboarding for a new person in under 2 minutes: sign up → create passport → name your AI → first project → first approved move.
- The Members Only gateway (PR #15) leads into this onboarding.
- Abuse limits: rate limits, spend caps, report and block in rooms, and moderation for public community content.
- Analytics on real outcomes only (activation, daily briefs read, moves approved), privacy-respecting, with a founder view.
- Launch checklist with every item verified on the live site. My go before opening sign-ups beyond invites.

══════════════════════════════════════════════
PART E: AUTONOMOUS RUN PROTOCOL (one prompt, whole build)
══════════════════════════════════════════════
I'm running this as ONE long autonomous run. Build everything in Part D, in this order. I use each milestone as soon as it lands, so ship each one before starting the next:
  Milestone 1, "My AI knows me": Steps 0, 1, 2, 3 (lean: context packer, project brief, energy cap), 7 (morning brief, scheduled job, push, installable app).
  Milestone 2, "My AI works for me": Steps 4, 6, the rest of 7, and Step 11's first path (Google Calendar + Gmail).
  Milestone 3, "My people are in it": Steps 5, 8, and Step 9's first game (the sales-floor trainer).
  Milestone 4, "Build anything": Steps 10, the rest of 3 (council), the rest of 9, the rest of 11, then 12.

1. STATE ON DISK, NOT IN YOUR HEAD.
   - Keep docs/plans/RUN-PROGRESS.md on the working branch: current milestone and step, done/in-progress/blocked per slice, open PRs, what's waiting on me, decisions made, next action.
   - Update it and push after every slice.
   - If your context resets or the session restarts, re-read this file, RUN-PROGRESS.md and the latest BUILD-STREAM.md entry, then continue exactly where you left off. Never redo finished work.
2. NEVER IDLE ON ME.
   - Collect everything you need from me (merges, keys pasted in Vercel, OKs for irreversible actions, Supabase token) into a "WAITING ON ANDREW" list at the top of RUN-PROGRESS.md, and send it to me as one message at each milestone boundary, or immediately if it blocks everything.
   - While blocked on one item, keep building every other slice that doesn't depend on it, using staging/previews and tests.
   - Never skip an approval gate to save time: irreversible actions wait for my word.
3. STACK, DON'T STALL, ON MERGES.
   - When a slice depends on an unmerged PR, branch from that PR's branch and keep going. Note the dependency in the PR description and RUN-PROGRESS.md.
   - Keep PRs small, one slice each, so I can merge them in a batch.
4. VERIFY BEFORE MOVING ON.
   - Each slice meets Part C's "Done means" on staging or preview, with tests green and CI green.
   - At each milestone: run the full suite, the Step 4 every-control check, and a phone-width walkthrough of the milestone's promise. Send me screenshots plus one plain-English paragraph.
   - For security-sensitive slices (passport multi-person isolation, token handling, the Machine sandbox, approval gates, money), use a separate fresh subagent that hasn't seen the code to review the diff and try to break it. Fix what it finds before merging.
5. USE HELPERS FOR BREADTH, STAY THE LEAD FOR DEPTH.
   - Hand independent, well-scoped work to subagents in parallel (branch audit, legacy harvest, catalog entries, copy rewrites, test writing), each with exact paths and done-criteria. Review their output yourself before it lands.
   - Never let two agents edit the same files at once.
6. QUALITY DOESN'T DECAY.
   - Late steps get the same rigor as early ones. Before each step, re-read its section in Part D and the Clarifications in docs/plans/2026-10-31-one-solve.md.
   - If a step turns out wrong or much larger than described, write a short proposal in RUN-PROGRESS.md, choose the most sensible path within these rules, and flag it in your next update.
7. COST AWARENESS.
   - Prefer the cheapest model that does the job in the product (Step 3 rules).
   - In your own run, don't re-run unaffected expensive suites. Run focused tests per slice and the full suite at milestones.
8. FINISH LINE.
   - The run is done when all four milestones are live, every item in Step 12's launch checklist is verified on the live site, and RUN-PROGRESS.md shows nothing outstanding except items waiting on me.
   - Then send a final report: what's live, how to use each piece, what's waiting on me, and the recommended next things to build.

══════════════════════════════════════════════
PART F: VISION UPDATE, 2026-10-31 (applies to every step)
══════════════════════════════════════════════
The vision widened. Solve is not just my operating system: it's for everyone, from kids creating together to hedge fund managers. Every person owns their passport, rooms run under a policy that fits their stakes, and anyone can add any integration.

1. ROOM POLICY PROFILES (one engine, different rules). Every room has a policy:
   - Kid: parent-owned; invite-only; no strangers; parent sees everything; AI creates and tutors only, no outbound actions; curated integrations (Scratch, Minecraft Education, Roblox Studio, Tinkercad). Under-13 profiles need verified parental consent (COPPA), created from a parent's passport.
   - Teen (13+): own passport, optionally family-linked; moderation; no spending without a parent's limits.
   - Personal: the person's own rules.
   - Team: roles (owner, manager, member, recruit); hierarchy visibility (managers see their downline); shared integrations without sharing logins.
   - Company: SSO (SAML/OIDC: Okta, Google, Microsoft Entra), SCIM provisioning, admin policies (allowed models, integrations, AIs), data region, no training on company data, audit export, expiring guest access.
   - Walled (regulated finance): compartments act as information barriers; crossing attempts are blocked and logged; a compliance-officer role approves anything leaving the firm; personal-trade pre-clearance cards; restricted-list checks; retention for SEC 17a-4/FINRA; legal hold; archive export (Smarsh, Global Relay); a firm-locked model list with zero retention and optional private models; dual approval for anything market-facing; trading integrations read-only by default.
   Build the policy engine in Milestone 3 (alongside Step 5), with Personal and Team first. Kid/Teen in Milestone 4, Company and Walled after launch. Each as a tested policy, not a separate product.
2. APPROVER BY POLICY. The same Do it / Change it card, but who approves depends on the room policy: the person, a parent, a manager, compliance, or two signers. Tests for every profile.
3. INTEGRATIONS ANYONE CAN ADD (expands Step 11). Eight ways in:
   (1) one-tap catalog
   (2) connect any MCP server by URL, with its tools explained in plain words and chosen per tool
   (3) say it ("connect my Jobber")
   (4) the AI builds a connector as a Machine from public API docs: read-only first, actions only after an approved test, keys sealed
   (5) a Zapier/Make/n8n bridge for the long tail
   (6) a private email-in address and webhook URL per project
   (7) a browser agent for portals with no API: you watch, and every submit needs a card
   (8) file and export import (CSV, PDF, Google Takeout, Instagram download, bank statements) into passport review.
   Ecosystem:
   - community-built connectors published as Packs, with author, version, permissions and installs
   - verified badges, with review before any connector that can send/post/spend is listed publicly
   - a request board with voting
   - role templates ("I'm a realtor / gym owner / creator / student / agency / fund") suggesting the top 5 connections and Machines
   - combo bonuses on the AI card (Calendar + Gmail + Twilio = "Full Follow-up")
   Catalog coverage spans: communication, sales/CRM, solar, insurance, recruiting/social, marketing/creative, money, knowledge/docs, AI models/agents, building, life/travel, identity/trust, education (kid-safe), small-business POS and field service, real estate (MLS, Follow Up Boss), creators (YouTube, Twitch, Patreon), events, nonprofits, enterprise (M365, Salesforce, Jira, Snowflake), and finance data (Bloomberg, FactSet, PitchBook, EDGAR; read-only).
   Build order: catalog + connect-by-URL → Zapier bridge + email-in → role templates → AI-built connectors → browser agent → community Packs, request board, badges.
4. LIFELONG PASSPORT. A person's passport grows with them: a kid's creative history, a teen's verified projects, an adult's career, and work history they carry between rooms, teams and companies. Nothing is lost when they change jobs; employers see only what the person shares.
5. Safety stays the same at every level: approval screens from each app, sealed keys, reads automatic, real actions need a card, health and finance data private by default, one-tap disconnect everywhere, every use on the record.

══════════════════════════════════════════════
START NOW
══════════════════════════════════════════════
Create docs/plans/RUN-PROGRESS.md. Send me one message with your plan for Milestone 1 and the complete WAITING ON ANDREW list for it. Then start Step 0 immediately, without waiting for my reply on anything that isn't irreversible. Keep going through all four milestones until the finish line.
