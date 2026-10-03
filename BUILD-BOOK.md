# SOLVE — Build Book

One file. Everything technically useful, built and recorded through 2026-10-03. The builder reads this alongside VISION-CANON.md and DIRECTIVES.md. If this file and a directive disagree, the directive wins — only the founder edits directives.

## 1. What we're building

**solve** — lowercase, always. The app name. A living OS for real life with the player at the center. The loop: Ask → Find a route → Enter a Room → Act → Create consequence → Expand your world.

Hierarchy: Sector Pack → Room → Node → Route → Capability → Provider Adapter → Automation → Event.

AI is electricity with a hard authority boundary: permission → policy → approval → capability → provider → verification → event.

Reality Builder loop: Imagine → Design → Simulate → Price → Validate → Gather people → Fund → Build → Operate → Prove.

End state: a programmable interface for reality.

## 2. Brand lock

- Tony Stark HUD. Abyssal blue-black `#04070d`–`#0a1220`. Ice white `#f2f7fb`. Hologram cyan `#22d3ee` — the single accent. **No gold, ever.**
- Emerald `#00e5a0` = win/positive. Red `#ff4d5e` = loss/destructive.
- Archivo. Engraved uppercase labels, generous tracking. Tabular, stable numbers. Tesla-calm easing. Restrained transform/opacity motion. Vignette/grain.
- Signature intro: jagged rising market line climbs through tower forms, frontier pulse at the peak, wordmark lands, hold sigil to enter. Preserve this composition. No crown, shield, or coin mark.
- Copy: terse, confident, old-money. No gamified voice, no hashtags, no hype.

## 3. The memory kernel (directive 1 — build first)

The stable master code. Built once, built clean, never revisited.

- **Events with provenance.** Every action is an event: who did what, when, authorized by whom. No action exists without its event.
- **Double-entry ledger.** Balances are derived from entries, never stored as source of truth.
- **Append-only history.** Nothing edited, nothing deleted. Corrections are new events.
- **Evidence on everything.** Proof attaches to events, not claims beside them.
- **Identity-gated writes.** Identity, authority, and permissions gate every write. No write without a verified actor and a valid grant.

## 4. The kernel's store (directive 2)

The repo holds the kernel's CODE. The memory (events, ledger, history, identities) is DATA — it lives in a dedicated secure database outside the repo. Encrypted at rest, access-controlled, backed up. Nothing in the repo reads or writes memory except through the kernel's gated interface. The founder provisions the store (dedicated Supabase project). Build the kernel against that interface, not a local file.

## 5. Accountable AI — the five pieces

Whop shipped AI that acts (Economic Intelligence, Sep 2026). Ours acts **on the record**.

1. **Kernel.** Every AI action = an event with source, tool, time, scope, approval, result.
2. **Agent contract.** Every avatar/agent carries one: whose authority, which Worlds, tools, limits, spending cap (default zero), expiry, approval policy, data-retention policy, human owner. No contract, no action.
3. **Approval gates.** Tiered authority: suggest, draft, and stage freely. Anything irreversible — mint, transfer, settle, sign, change access, publish — waits for explicit human approval. Avatar states are semantic: listening, reasoning, waiting for approval, working, needs input, completed, unavailable.
4. **Inspectable memory.** The user sees everything it remembers, where it learned it, and can edit, compartmentalize, export, or revoke any of it. Every answer carries its source. Unknown stays unknown — no fabricated certainty, no fake memories.
5. **Provider independence.** Memory lives in the kernel, not the model. Swap providers, keep the mind. An outage erases nothing: not identity, not World state, not history.

## 6. The AI avatar

A persistent companion tied to the SOV ID — the human-facing expression of the user's bounded agent across Worlds. Recognizable, directable, continuous. A core entry point and identity surface, not decoration.

**What it does:** welcomes and orients; turns plain-language intent into a first World and an executable next step; holds scoped text/voice conversation with authorized context; remembers user-approved preferences, goals, decisions, and World history with provenance; works inside Worlds (explains state, finds missing evidence, drafts artifacts and plans, prepares actions for review); appears in shared spaces as a clearly labeled AI actor.

**Hard boundaries:** human and AI actors are distinct — avatar output is never passed off as the person's action. AI cannot mint, transfer, settle, sign, change access, publish, or decide irreversibly without explicit approval. No simulated affection, certainty, or false memory to drive engagement. Face/voice cloning needs explicit consent — never by default. Minor Worlds get guardian-scoped controls, age-appropriate interaction, no public child profiles.

**Build order:** (1) first useful avatar — branded presence, text conversation, World-aware welcome, visible agent identity, source-linked responses, memory controls; (2) useful companion — connectors, memory review, voice, artifact creation, event history distinguishing suggestions from approved changes; (3) World participant — multi-agent teams, bounded Pack execution, collaboration/versioning.

## 7. Whop bridge Pack (directive 3 — after the kernel)

Connect a Whop seller's account via Whop OAuth (read their API docs first). Import their community — members, roles, products — and generate invite links into a SOLVE World. Membership status syncs through Whop webhooks into capability grants: join on Whop = granted here, lapse there = revoked here. Every imported track record enters the kernel as a verifiable claim, not a fact. Read-only to start. The seller connects their own account and their own data — portability, not poaching.

## 8. Product blueprint

**A. Arrival.** User states intent → avatar introduces itself (not human, shows what context it can see) → asks only for missing inputs → creates a private draft World (intent, facts, open questions, people/skills needed, first plan, source-linked artifacts) → surfaces three actions: continue alone, invite someone, discover a Pack/creator. Every avatar action lands in history with source, tool, time, scope, proposed changes, approval, result.

**B. Discovery.** Search by intended outcome, category, capability, availability, location, price, evidence level, community type, access rules. Entity types: person/creator, community/World, Pack/tool, course/learning path, service/appointment, product, event, opportunity, project. Listings carry: who it helps, expected outcomes, what's included, effort, price and terms, prerequisites, owner/staff, evidence with provenance, reviews, refund/exit terms, disclosures, integrations, data permissions. Recommendations disclose why they appeared, what signals were used, confidence, and any commercial relationship — with a dismiss control. Reviews tie to a real receipt, participation, or verified interaction; unverified reviews are marked. Launch invite-only or category-limited.

**C. Publishing and commerce.** Creator profile + World page; offers as first-class objects linked to their fulfillment World. Avatar-assisted composer from proven templates, desktop/mobile preview, sourced claims. Offer primitives: free, one-time, recurring, application/waitlist, limited capacity, ticket, appointment, bundle, add-on, trial, discount. Each maps to entitlements, duration, renewal, cancellation/refund rules, capacity, and audit events. Checkout only through approved provider-hosted rails: price breakdown, taxes/fees where known, reconciliation, idempotent webhooks, receipts, explicit return/cancel state. Post-purchase: avatar onboarding, permission grant, orientation, first action, route to human help. Creators can version products without silently changing existing users' entitlements.

**D. Delivery.** The World after the join: chat and DMs, threads, announcements, feed, files/artifacts, courses with progress, office hours, appointments, events, livestream/calls, member directory, tasks/bounties, project boards. Pack permissions govern who can read, post, publish, moderate, invite, export, view private data, approve money actions. The avatar answers from allowed source material, cites sections, distinguishes official policy from member claims, drafts replies, summarizes threads. Completion badges need evidence and criteria — never bought as proof of skill. Integrations (Discord, Telegram, calendars, CRMs, payment providers) import source-labeled, scope-limited data; they never define canonical identity.

**E. Operations and economics.** Member CRM with explicit permission/consent record, onboarding step, access state, last meaningful activity, help requests, agreed follow-up channel. Marketing: landing pages, referral attribution, campaigns, affiliate marketplace, offer links, coupons, opt-in messaging, labeled sponsored placements. Analytics across the full path: visitor → intent → conversion → first value → outcome/milestone → renewal/churn → refund/dispute — with defined formulas, attribution separated from causation. Creator workbench: explainable next-best-actions from real performance data, impact estimates with uncertainty, draft previews, approval buttons, rollback/pause, audit events. AI never runs ads, changes prices, messages cohorts, issues refunds, or moves funds without scoped authority. Payouts, tax, KYC/KYB, fraud, and refunds are provider capabilities behind approved region-aware adapters.

**F. Agents, API, Packs.** APIs/webhooks for World, actor, membership, offer, event, artifact, and allowed actions — actor+World+capability scope enforced on every operation. CLI/MCP: read-only inspection and drafts before writes; money, messaging, publishing, access changes, and bulk edits need explicit approvals and typed scopes. Pack manifests declare permissions, data touched, callbacks, network needs, UI surfaces, model use, cost, version, deletion/export behavior. Sandboxing, signing, version pins, review, revocation, audit logs, graceful degradation. No Pack gains broad access from one World's install; provider failure never erases World state.

## 9. Build priority

**P0/P1 — first commercial loop:** identity, creator profile, World page, offer presentation, limited searchable catalog, access control, one approved checkout rail, join/buy, onboarding, support with human handoff, delivery for the first vertical, basic chat/announcements, creator member controls, receipts/refund path, event/operation audit. Avatar onboarding and World-aware drafting with source-linked answers, visible permissions and memory controls, manual approval of side effects. Basic analytics: discovery, conversion, activation, time-to-first-value, retention, refunds, support, creator success.

**P2 — once the loop works:** multi-product/recurring plans, trials, coupons, bundles, affiliate marketplace, referrals, scheduling/bookings, events/live calls, forums/feed, automated messages, staff roles, integrations, cohort analytics, creator SEO, Pack SDK. Agentic CLI/MCP with action scopes, approval queue, sandbox, replayable activity, budget caps. Ads only after attribution is reliable — behind spend caps and manual review.

**P3 — separately gated:** multi-region payouts, seller KYB/tax, local payment methods, card issuing, treasury/credit/yield, public app marketplace at scale, paid referral marketplaces, token economics, physical fulfillment, public minors, open agent-to-agent commerce.

## 10. What we don't copy

- No app-pile UX. Capabilities compose inside one persistent World with shared identity, navigation, memory, and provenance.
- Never equate screen time, clicks, ad spend, recruiting, or purchases with trust, rank, skill, or quality.
- No affiliate payment or sponsored ranking disguised as organic recommendation.
- No outcome or income promises without evidence. Label every projection and assumption.
- No AI in control of money, access, or public communication by default. Recommend and stage; authorized people approve.
- Don't rebuild Whop's finance/compliance overhead before the loop works and the economics justify it.

## 11. Economics

- SOV is earned through verified action. **No ICO, no presale, no buy-in — ever.**
- Price is discovered by the market, not set by the team. No peg, no defense. Supply enters through work; demand comes from use — verification fees, settlement tolls, marketplace transactions. Reasons to use before reasons to trade.
- Design supply: 1B fixed. Ecosystem 45%, treasury 20%, team 15% vested, liquidity 10%, community 10%. (Genesis parameters recorded; devnet mint approved, mainnet only on the founder's explicit word.)
- Current product direction does **not** authorize a public token, cash-out, deposits, a card, custody, yield, or a real-money Growth Pool. Token economics is P3 — separately gated. Internal balances are never presented as redeemable cash.

## 12. Launch playbook

Copied from how Whop launched. Same moves, our soul.

**The choice:** You've been buying access. Rooms full of promises. Win rates without ledgers. It felt like the truth because everyone agreed to pretend. That was the blue pill. The red pill: every claim logged before the outcome, every number computed not claimed. We're not asking you to trust us — we're removing the need to. Bring your claims. We'll verify them. What survives is real.

1. **Be the customer.** The founder's agency and community are the first rooms. Dogfood from the first commit. If it doesn't work for his team, it doesn't ship.
2. **One wedge.** Verification for trading signal sellers — Whop's biggest, most fraud-ridden vertical. "Bring your claims. We'll verify them." The avatar is the front door.
3. **First proof fast.** Ten sellers with verified track records in 7 days. Proof compounds — every verified seller is a billboard.
4. **Pay creators, not ads.** Pay-per-view clip engine like Content Rewards — but every claim links to the ledger. Marketing becomes evidence.
5. **Spread market by market.** Signals → ecom → courses → coaching → agencies. Each vertical's verified sellers become the next vertical's supply.
6. **Build quietly.** No hype until the numbers force attention.

## 13. Strategy one-liners

- Same skeleton, different soul. They sell access; we sell proof.
- Say it. Log it. Do it. It's on the record. The record is the product.
- They record the payment. We record the outcome.
- Be the water, then be the well: the verification layer inside every platform first, the marketplace second.
- Whop verifies the payment. SOLVE verifies the performance.
- The avatar is the interface, not a feature. What Whop can't copy is accountability: continuity across Worlds, inspectable memory, provenance on every claim, identity you own.

## 14. Scorecard

**User:** signup → first useful World; → first meaningful action; % of avatar answers with a relevant source; correction rate; approval/reversal rate; successful handoffs; retained value at 7/30 days.
**Creator:** time to publish; page-to-join conversion; join-to-first-value; outcome evidence; member retention; support load; refund/dispute rate; net revenue after fees; ability to export and leave.
**Marketplace:** search success; recommendation dismissal rate; cold-start for new creators; fraud/impersonation rate; evidence quality; trust/safety resolution time.
**System:** authorization denials; cross-World leaks; unapproved side effects; webhook duplicates; settlement invariants; provider outage recovery; export/restore correctness; agent-attributed vs human actions.

Never use Whop's reported lift claims as a forecast. Establish our own baseline before claiming causal growth.
