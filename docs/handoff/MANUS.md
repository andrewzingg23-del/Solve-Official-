# Manus: joining the build

2026-10-05, written by Claude when the founder said "manus has joined the build". The lane below is a proposal. The founder confirms or changes it, and until then Manus should treat it as a suggestion, not an order.

## Who is building

| Who | Decides or owns | Where |
|---|---|---|
| Founder | Every decision. `DIRECTIVES.md` is theirs alone: read it, never edit it. | — |
| Codex | World app, kernel client and domain, migrations, `tests/`, build and status docs | `ACTIVE-WORK.md`, first row |
| Claude | The bot: MCP connector, OAuth, `/bot`, parts, proof, receipts, routes, brand docs | `ACTIVE-WORK.md`, second row |
| Manus | Proposed: the real-browser and open-web lane (below) | `ACTIVE-WORK.md`, third row |

## Read first, in this order

1. `DIRECTIVES.md`: active directives are orders.
2. `docs/specs/SOVEREIGN-MASTER-BUILD-SPEC.md`: the founder's master spec (the PDF next to it is the original).
3. `VISION-CANON.md`, then `docs/specs/2026-10-05-spec-vision-check.md`. The check covers where the spec and the vision differ, and four decisions still open with the founder.
4. `BUILD_STATUS.md` (what is built and verified) and the latest entries of `BUILD-STREAM.md` (what is happening now).
5. `ACTIVE-WORK.md` (who owns which paths), `SECURITY-INVARIANTS.md`, `DOMAIN-CONTRACTS.md`.
6. `docs/brand/BRAND.md`: "Everything here is real." Simulated work is labeled Practice. Nothing is called verified unless an outside check verified it.

## Rules that never bend

- Never commit, paste or log a secret: no keys, tokens or passwords in the repo, in `BUILD-STREAM.md` or in an issue.
- Staging only. Never touch the production Supabase project or the legacy game project.
- No real money, mainnet or custody. Money is off by default (`lib/flags.ts`).
- Kernel memory is reached only through `kernel_api`. Never edit an applied migration.
- Nothing outward-facing without the founder's explicit go-ahead: no posting, emailing, recruiting pilot users, buying domains or filing trademarks.
- Label simulated evidence honestly. A run against test data is Practice, never a pilot result.
- Never bypass identity, grants, evidence, review or deployment gates, even to unblock yourself. Report the blocker instead.

## Working agreement (2026-10-05, after pull requests #6 and #8)

#6 and #8 were merged into the trunk while a review asked for changes. #6 put a second, near-identical panel on `/bot`; #8 put `/start` on the trunk without the brand fixes. Claude has fixed both:
- `/start` is on the white floor, with no decorative points and no fake state, and sends signed-in people to `/command`;
- the duplicate panel is gone; its World list lives in "What your bot may do".

From now on:
1. **Never merge into `claude/keen-cerf-tpd7io` while a review on that pull request is open.** Push the fixes to the branch and reply on the pull request. The trunk's integrator (Claude, or the founder) merges.
2. **Log every slice in `BUILD-STREAM.md`** (a timestamped entry starting with "Manus,") and keep your row in `ACTIVE-WORK.md` current.
3. **Research before app code.** Next, in order:
   - `docs/research/connecting-builders.md`: how Claude Code, Codex, Manus and ChatGPT each connect to solve's MCP endpoint;
   - `docs/research/meta-messaging-rules.md`.

   App changes come through pull requests for the owner to review.

## How to work alongside Codex and Claude

- **Work on your own branch, `manus/<topic>`, and open a pull request into `claude/keen-cerf-tpd7io`.** The build workflow cancels a running build when new code is pushed to the same branch (`concurrency: build-${{ github.ref }}`). A third builder pushing code to the shared branch would cancel the others' builds. Pushes that change only docs (`*.md`, `docs/`) don't start a build.
- **Claim before you start.** Fill in your row in `ACTIVE-WORK.md` with the task, branch, paths you will write and when it is done.
- **Log in `BUILD-STREAM.md`.** Add a timestamped entry starting with "Manus," when you start, finish a slice, change direction or hit a blocker. Name the paths and the checks you actually ran, with their results.
- **Stay in your paths.** For a change in someone else's paths, leave a note in `ACTIVE-WORK.md` or open a pull request for them to review.
- **Before a code push:** run the checks for what you changed (`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`). Never report a build as green until GitHub's workflow has passed.

## First, since 2026-10-05: founder first

The founder decided solve is built for them first (`docs/plans/2026-10-05-founder-first.md`). Before the lanes below, find out how each of our builders can connect to solve's MCP endpoint (remote MCP over streamable HTTP, with OAuth and a consent screen; the server is `app/mcp/`):
- Claude Code;
- Codex;
- Manus itself;
- ChatGPT.

Read each one's official docs. Write what works, what doesn't, and the exact setup steps in `docs/research/connecting-builders.md`, citing each source. Once staging works for the founder, walk that path with them.

Then, for the Outreach Room (`docs/plans/2026-10-05-business-leverage-outreach.md`): from Meta's current official docs, write `docs/research/meta-messaging-rules.md`. Cover:
- the Messenger, Instagram and WhatsApp rules for messages a business starts (windows, tags, templates, opt-in);
- Lead Ads and click-to-message ads;
- publishing to your own Page and Instagram account;
- app review.

Also cover CAN-SPAM and CASL for commercial messages. Cite every claim and note the date read; flag anything a lawyer should confirm.

## Proposed lane: the real browser and the open web

Codex and Claude build. What nobody covers yet is using solve the way a person would, in a real browser, and reading the outside world carefully. That is where Manus is strongest. Work in this order:

### 1. Staging walkthroughs: find real friction

The founder still has to run two SQL files on staging (see `BUILD_STATUS.md`). Once they are in, walk the golden path on the staging preview as a new person, on a phone-sized and a laptop-sized screen:

1. Sign in.
2. Make a bot.
3. Connect an assistant through the MCP connector and approve it on the consent screen.
4. Start a World.
5. Ask for a way to do something (`propose_routes`), take a route and mark a step done.
6. Design a part (`design_part`) and download the STL.
7. Save proof (`add_proof`).
8. Share the receipt and open it signed out.

File each walkthrough as `docs/qa/YYYY-MM-DD-<path>.md`. For every friction point give:
- the exact steps;
- what you expected and what happened;
- a screenshot path;
- whether it blocked you;
- the smallest fix you would suggest.

Use only test accounts the founder provides, and label any run on test data as Practice. This is the directive's loop: observe real friction, then propose the smallest reusable fix.

### 2. Bridge research: facts for an open founder decision

The spec says to connect one outside service first, Discord or Slack. The active directive says a Whop bridge, and its first step is "read their API docs first". Read the official docs for each (Whop: OAuth, members, products, webhooks; Discord and Slack: account linking, a selected channel, posting with approval). Write one contract per service in `docs/research/<service>-bridge.md`, using the spec's seven points (§11):

1. Sovereign object mapping.
2. Capabilities exposed.
3. Data in and out.
4. Kernel events.
5. Revocation.
6. Failure and retry.
7. Privacy classification.

Cite every claim with a link to the official page, and say when each page was read. No code yet: this informs the founder's choice.

### 3. Route quality

Using a real assistant connected to a test bot, ask for real things and judge the routes `propose_routes` returns:
- Do the links resolve?
- Are the sources official and current?
- Are the steps concrete?
- Would a person know what to do next?

Report in `docs/qa/`, with each ask and route quoted.

## Where things are

| Path | What |
|---|---|
| `supabase/migrations/` | The kernel (applied migrations are never edited) |
| `lib/kernel/client.ts` | Typed `kernel_api` client |
| `lib/bot/` | The bot: connector tools, memory, parts, proof, receipts, routes |
| `app/mcp/`, `app/oauth/`, `app/.well-known/` | How an assistant connects |
| `app/bot/` | The person's bot page |
| `app/world/[worldId]/` | A World: pieces, routes, saves, history |
| `app/saved/[token]/` | Public receipts |
| `lib/world/`, `lib/causal/`, `app/world/` | Codex's World engine and the Arcadia sandbox (Practice) |
| `lib/money/`, `lib/chain/`, `lib/router/` | Money: built and tested, off by default |
