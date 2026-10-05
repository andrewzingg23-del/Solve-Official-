# A business with leverage, recruiting through the product, for kids and operators alike

2026-10-05, Claude, for the founder's questions:
- *"how to also turn this into a business with as much leverage and recruiting as possible simultaneously and build this as flexible as kids and serious operators"*;
- *"I should also have a ai to business outreach flow as well and all automated with meta accounts but build this as an example in app"*.

It builds on what is already decided: the business model in `docs/brand/2026-10-04-first-principles.md` §5 (free to bring your AI, paid when it's real, verified outcomes as the north star), the critical-mass phases in `docs/plans/2026-10-04-critical-mass.md`, and "built for the founder first" (`DECISIONS.md`, 2026-10-05). Proposals here are the founder's to accept.

## 1. One loop that is the product, the growth and the recruiting

Leverage means the same action does several jobs. In solve, one finished route does four:

1. **Real value:** a person asks, an AI finds routes, they take one and do it.
2. **Proof:** the result is saved on the record (a save point).
3. **Distribution:** they share the receipt because it gives them credit; a viewer taps "make your own".
4. **Reuse:** a route that worked becomes a template (a Pack) that others start from, credited to whoever made it.

So the business is not a separate growth machine bolted on. Every real outcome markets itself, and every working route becomes a product. The vision says the same: "Creation can be open. Distribution earns trust."

**How recruiting rides the same loop.**

- **Pilot users and partners:** found through the Outreach Room (§3), which the founder uses first. It's a real need, used for real, with the founder's own outcomes as the first proof.
- **Contributors, human and AI:** a World can now take collaborators by role (live collaboration is merged). Someone who sees a public receipt can be invited into the World it came from, for a stated role. Their contribution is attributed on the record, which is their portfolio.
- **Building in public:** solve is built through solve (founder first). The "Build solve" World and its receipts are the demo, the hiring post and the investor update at once. They are always labeled as the founder's own use, never as traction.

**What earns money**, with the model as it stands:
- **Free:** bring your AI.
- **Paid when it's real:**
  - a small fee when an outcome settles;
  - for operators, paid Packs priced per result (a booked meeting, a qualified lead, an order), never per seat.
- **Verification** for platforms and buyers.
- **Money stays off** until the founder switches it on (`lib/flags.ts`).

## 2. Kids and serious operators: one engine, different defaults

It is not two products. It is one engine with progressive disclosure (spec §15) and a **profile** that sets what a person's grants can ever include:

| | Young | Standard | Operator |
|---|---|---|---|
| Ask, routes, Worlds, pixel art, printable parts | Yes | Yes | Yes |
| Practice labels, save points, receipts | Yes | Yes | Yes |
| Shared Worlds | Only with people a guardian approves | Yes | Yes |
| Messages to the outside world | Never | Each one approved | Each approved, then batches by policy |
| Money | Never | Off until switched on | Off until switched on |
| Who approves | A guardian | The person | The person, or their team's policy |

**One concept, one home.** The profile is a policy on the person, and the kernel's grants enforce it. It is not a separate kids' app: a young profile simply can never be granted `message.send` or money capabilities.

**Before any child signs up:** in the US, accounts for under-13s need verifiable parental consent (COPPA), and other countries have their own rules. So no accounts for children until a guardian-consent flow exists and counsel has checked it. Until then, kids use solve through a parent's World.

## 3. The Outreach Room: AI to business outreach, as an example in the app

**Meta's rules, as published.** Manus will confirm them from current official docs (see §4):
- **Messenger and Instagram:** a business may message a person freely only within 24 hours after that person messaged it. Outside that window, only narrow tagged cases are allowed. Promotional messages need the person's opt-in.
- **WhatsApp Business:** a business can start a conversation only with message templates Meta has approved, sent to people who opted in.
- **Pages and Instagram:** publishing posts to your own Page and Instagram professional account is supported through the API.
- **Lead Ads and click-to-message ads:** people come to you, with consent, and the conversation is then inside the window.
- **Cold DMs:** automated cold messages from personal or business accounts breach Meta's terms and get accounts banned. Anti-spam laws (CAN-SPAM in the US, CASL in Canada) add consent, identification and opt-out rules for commercial messages. Counsel should confirm them for each market.

**So "all automated with Meta accounts" becomes:** automate everything except the moment a message first reaches a new person, and use Meta where its rules welcome automation.
1. **Find:** the person's assistant researches businesses that fit a goal, from public sources, with the source attached to each lead.
2. **Draft:** a personal message for each lead.
3. **Approve:** the person approves each message. Later, once reply quality is proven, approved templates and batches are allowed by policy. The kernel's action policies already support thresholds.
4. **Send** through a channel the rules allow:
   - email, with identification and opt-out added automatically;
   - the business's own contact form;
   - Meta, only inside a reply window or to people who opted in.
5. **Replies and outcomes:** each reply, meeting and deal is recorded on the record, on the person's word or with proof.
6. **Inbound with Meta:** click-to-message ads and Lead Ads bring businesses to the person's Meta accounts first. The AI then handles the conversation inside the window: the vision's AI Receptionist Room.

**As an example in the app:** the first slice (built 2026-10-05) is the whole flow with a **Practice channel**, labeled Practice. Approving a message records that it would have been sent; nothing leaves solve. A real channel (email first, then Meta after the founder's Meta app review) plugs into the same approval later, with no change to the flow.

## 4. Slices and owners

| Slice | Owner | Needs |
|---|---|---|
| Outreach Room with the Practice channel: `propose_outreach` (find and draft), per-message approval, a Practice send on the record | Claude | Nothing. Built 2026-10-05 |
| Meta and anti-spam rules for outreach, from official docs, cited | Manus | Becomes part of its research lane |
| Replies and outcomes on each lead | Claude | After the first slice |
| Real email channel (identification and opt-out added automatically, rate limits, kernel action with approval) | Claude or Codex | The founder's sending domain and provider |
| Meta inbound (Messenger, Instagram, WhatsApp webhooks inside the window; Lead Ads) | Codex or Claude | Meta Business account, app review, the founder's go-ahead |
| Profiles (young, standard, operator) | Codex (kernel policy) with Claude (bot) | The founder's yes, plus counsel before any child signs up |
| Save a finished route as a Pack others can start from | Claude | After the founder's first real routes |

The north star stays verified outcomes per person per month. For outreach it is replies, meetings and deals on the record, never messages sent.
