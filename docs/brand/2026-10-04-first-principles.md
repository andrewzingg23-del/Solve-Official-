# solve from first principles

Date: 2026-10-04. Asked by the founder: *"Think of the functionalities of the app and make it around that. First principles, rethink my business from scratch. What's the opposite of what everyone else is doing."*

Status: a proposal for the founder. It builds on the research in `docs/brand/research/` and on the founder's own canon: the Vision, the Build Book §5, §11–13 and the directives. Where it proposes something not yet decided (pricing, metrics, the line), it says so.

## 1. Start from what the app actually does

Nothing here is a plan. Each function is built and tested on this branch:

| Function | Where it lives | What it really is |
|---|---|---|
| Every action is an event with provenance, evidence attached, append-only and hash-chained; balances are derived | Kernel v1–v4 | **Proof** |
| Identity, grants, delegation, revocation; guards re-checked at the moment of action; agents can't claim new scopes | Kernel v4 authority engine | **Permission** |
| Any assistant (Claude and others) connects and acts inside granted scopes, with no tool to spend, sign, publish or grant | MCP connector, bot bridge | **Neutral hands for any AI** |
| Goals become routes, routes become steps through real providers, and outcomes are recorded | `lib/causal`, providers, the World loop | **Execution in the real world** |
| Claims are checked against evidence | Kestrel claim verification | **Verification** |
| Value moves only under rules | Payment router (test assets), settlement, the monetary constitution | **Settlement** |
| Memory can be erased without breaking history (the key is destroyed) | Kernel v5 | **Ownership** |
| People and their bots work together with scoped access | Worlds, membership, per-World bot access | **Collaboration** |

Reduced to one line: **solve gives any AI permission and a place to act for a person in the real world, and turns what happens into proof the person owns.** That is the founder's line from earlier today: *"We aren't creating AI but giving it a real world to play in."*

## 2. First-principles truths about the market

1. **Intelligence is becoming a commodity.** Every lab ships capable models, prices fall each year, and people already pay for one assistant. Only 3% of US adults pay for AI at all. Building another AI is a race to free.
2. **The bottleneck to AI doing real work is trust, not capability.** Only 24% would trust an agent with routine purchases, and 61% of Americans want more control over AI in their lives. An agent deleted 200+ emails after being told to confirm first. Intelligence is abundant; permission and accountability are scarce.
3. **A claim costs nothing. A verified record is expensive to fake, and it compounds.** History becomes reputation.
4. **The real world lives outside every lab:** makers, suppliers, money, people. Whoever connects AI to it safely holds a position no lab can take without giving up its walls.
5. **A lab can't be neutral.** Each one wants your memory inside its product, so a neutral home for a person's record has to be someone else.
6. **People don't want more AI.** They want things to move, and they want the credit.

Business follows scarcity. The scarce thing is not intelligence. It is **permission and proof**.

## 3. What everyone else is doing, and the opposite

| Everyone else | solve |
|---|---|
| Builds a smarter AI | **Builds no AI.** Builds the world any AI acts in. |
| Asks you to trust their AI (every 2026 campaign is a trust campaign) | **Removes the need to trust.** The founder's words, Build Book §12. |
| Sells autonomy: fewer approvals, "works while you're away" | **Consent is the product.** AI does everything reversible on its own; the irreversible waits for your yes. |
| Keeps your memory inside its walls | **Your record is yours.** It works with every AI, it can be erased, it can leave with you. We win by making leaving easy. |
| Ships claims: "done", demos, hype | **Nothing counts until it's on the record.** We market receipts. |
| Sells attention or seats: ads, subscriptions, time in app | **Earns when something real happens** (proposed, §5). The less time you spend in solve, the better it worked. |
| Becomes a super app with 500 features | **Asks one question:** "Ask for a way." |
| Replaces people | **Brings people in:** makers, suppliers, family, members. The AI is staff; the network is human. |
| Races on speed | **Races on certainty.** Fast where it's safe, deliberate where it matters. |
| Sells the future | **Sells the next real rung.** |

**The deepest opposite.** The industry is making AI more *powerful*. solve makes it *accountable*. Power is everywhere; accountability is nowhere.

## 4. The product, rebuilt around its functions: Ask. Allow. Prove.

Every flow in the app is the same three steps, and each one is a built function:

1. **Ask.** Say what you want ("Ask for a way."). Whichever AI you already use plans the route inside your World.
   - *Built:* connector, causal planner, Worlds.
2. **Allow.** You set the bounds once. The AI drafts, stages and works inside them. Anything irreversible (spend, sign, publish, change access) waits for your yes, and the yes is checked again at the moment of action.
   - *Built:* grants, approval gates, enactment re-checks.
3. **Prove.** What actually happened lands on the record with its evidence. You own it, you can share it, you can erase it.
   - *Built:* the kernel, evidence, erasure.
   - *To build:* the seal on finished results.

Everyone else's loop is: prompt, wait, hope. solve's is **Ask. Allow. Prove.**

The Build Book's internal loop (Ask → Find a route → Enter a Room → Act → Create consequence → Expand) still holds. Ask, Allow, Prove is how a person feels it.

## 5. The business, rebuilt

- **What we are.** The place where AI is allowed to act in the real world, and where what it did becomes proof. To a person, that's a World and a record. Underneath, it's permission, proof and settlement.
- **The category to own: accountable AI.** Build Book §5 already names it. Use the word with investors and press. Consumer headlines lead with the person and the proof, not "AI".
- **Who first.** Whoever's bottleneck is trust, not intelligence. Two doors, one engine:
  - **Door 1, verification** (the Build Book wedge and the Whop bridge directive). Sellers whose claims need proof pay to stand out from fraud, and every verified seller is a billboard. Proof is the product, and someone pays for it today. Care needed: verifying a track record is not financial advice or endorsement.
  - **Door 2, make a real thing.** A maker asks, allows and gets the object plus a record that the design is theirs. This is the most visible proof there is, and it is the film.
  - **Recommendation:** Door 1 first for revenue and speed of proof, Door 2 for the brand film. The choice is the founder's.
- **Revenue, the opposite of seats and ads** (proposed, gated by Build Book §11):
  1. **Free to bring your AI.** No AI bill and no seat fee: we don't resell intelligence.
  2. **Paid when it's real.** A small fee when an outcome settles through solve: a verified claim, an order with a maker, a payment between members. We can't earn from activity or attention, only from results.
  3. **Verification for platforms and buyers.** Pay to check a record: "be the water inside every platform, then the well" (Build Book §13).
  4. **Later, settlement in the economy.** P3, separately gated. No real money without the founder's word.
- **Moat.** Built from what a lab can't easily become:
  1. **The record graph.** Verified outcomes link people, makers, suppliers and claims, so each record is worth more as more records reference it. It is portable for the person and verifiable through solve.
  2. **Neutrality.** Every lab's AI works here.
  3. **The authority engine.** Hard, already built, and boring to copy well.
  4. **The human network.** Communities through the Whop bridge, makers, suppliers.
- **Growth: proof is the loop.** Every result makes a receipt with the seal. The person shares it because they want the credit. The viewer sees proof, not an ad, and taps "make your own". That is the Build Book's "pay creators, not ads" with evidence attached.
- **North star, the opposite of engagement** (proposed):
  - **Verified outcomes per person per month**, meaning results that landed on the record, and **time to first proof**.
  - Not daily actives, not time in app.
  - This is the directive "grow it from real outcomes", as a number.

## 6. What the brand becomes

**Superseded on 2026-10-05.** The founder found *Ask. Allow. Prove.* generic, and the brand is now **"Everything here is real."** (`BRAND.md` v3): the construct, inverted, with save points and Practice. Ask, Allow and Prove remain the description of how the system works inside. The business in §5 still stands. The original text follows for the record.

The brand is built around the three functions, so it can't drift from the product.

| Role | Line |
|---|---|
| Thesis (manifesto, press, pitch) | **Everyone wants you to trust their AI. solve removes the need to.** |
| The line (what you do) | **Ask. Allow. Prove.** |
| The stamp (every real result) | **On the record.** |
| First words in the product | **Ask for a way.** |

The point (`solve.`) marks the two moments that matter: **your yes**, and **a result that is real**. It appears nowhere else.

This replaces v2's "You decide. The world builds." It was a good emotional line, but it described a feeling. Ask, Allow, Prove describes the product, and the product is the brand. The construct film still works: the person asks, the world assembles, they allow the step that matters, and the proof lands.

## 7. What we stop

- Building or branding our own model.
- Agents as the headline, and "operating system" language.
- Simulation as evidence. Arcadia stays a labeled lab.
- Token-first anything.
- New features before one Ask → Allow → Prove loop runs end to end for a real person.
- Attention metrics as goals.

## 8. Next, in order

1. **Founder:** confirm the line and thesis (§6), choose the door (§5), and decide on the pricing principle "paid when it's real".
2. **Product (smallest high-value slice):** make Ask → Allow → Prove visible on one real loop.
   - **Allow:** the bot's "waiting for approval" state.
   - **Prove:** a receipt with the seal on completed real results, and the simulated label on Arcadia's.
   - **Ownership:** the receipt component (Claude's area); the World's outcome surfaces (Codex), through `ACTIVE-WORK.md`.
3. **Pilot:** one real person through one loop, measuring time to first proof. Founder steps for staging sign-in are still open.
