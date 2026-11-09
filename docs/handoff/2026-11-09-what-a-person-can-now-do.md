# 2026-11-09 — What a real person can now do, and what was actually verified

Written to the founder's review standard: *integration, human experience, independent value, real
functionality* — and the question that replaces "how much was built": **what can a real person now
accomplish that they could not accomplish yesterday, and what has been verified?**

`main` at `2b3196f`. Six pushes today, every one green on both workflows.

---

## New today, usable by a real person

**A visitor with no account can type one line and own a real record.**
Before today their words went to `localStorage` and pressing Begin sent them to a sign-in page.
Now the thing is recorded in the kernel under the anonymous identity the proxy already created,
with a scope and a history, and it appears on their Home. Signing in buys *reach* — the same
record from another browser — not ownership.
*Verified:* `npm test` 558 / 557 pass / 0 fail, `tests/product/custody.test.ts` 4/4, the real
browser suite in Chromium at 390/320/1440 with keyboard and reduced motion, and both GitHub
workflows green on the deployed commit.

**Anyone can open the record of a thing they own and see all six parts.**
What it is, whose it is, what happened, what's proven, what's next, who can reach it — at
`/world/<id>/record`, from real kernel data, readable by a visitor because reading needs only the
authority to read. Absence is rendered rather than hidden: a field the type declares and the
record lacks says "Not recorded"; nothing proven says "Nothing proves this yet"; no next action
says "Nothing is waiting on you here."
*Verified:* `tests/product/thing.test.ts` 10/10, including the universality proof below; route
builds and is live on `main`.

**Nothing speaks to a person in our words.**
"World" and "Project" no longer appear as labels; raw event types like
`kernel.confirmation.answered` are said as "Answered"; an untyped thing is shown as untyped rather
than given an invented category.
*Verified:* `tests/product/vocabulary.test.ts` reads the person-visible strings out of each surface
and fails if one of our words is stamped on a person's thing.

---

## New today in the kernel, and NOT yet usable by a person

Said plainly because it is the difference between a foundation and a product.

**Counterparty confirmation.** The other side can confirm or dispute a thing, as evidence authored
by them, with a link that reveals that one thing and nothing else. Applied to staging. **No
surface exists, so no contractor can use it yet.**
*Verified:* `tests/kernel/counterparty-confirmation.test.ts` 4/4 against real migrations, and the
attacks fail — the owner cannot confirm their own record, an unissued token is indistinguishable
from a malformed one, a second private thing in the same scope is proven absent from what the link
reveals, a different answer cannot overwrite one already given.

**A person's own vocabulary, and export.** `define_type`, `put_object`, `export_mine` applied to
staging. **Zero call sites in `app/`.**

---

## Against the four review criteria

**Integration.** No parallel systems were created. Confirmation reuses the token-hash pattern of
`kernel.world_invitations`, is appended under the owner's own delegable authority re-checked at
answer time, and relies on the kernel's existing refusal to let a party witness its own event — so
no new guard was written for the rule that nobody can confirm their own work. The record view
composes existing reads (`read_events`, `read_evidence`, `read_confirmations`, `readWorldMembers`,
`read_actors`); it added no kernel function. Nothing edited an applied migration; `kernel` schema
access for `anon`, `authenticated` and `service_role` is still denied, verified on staging after
applying.

**Human experience.** Improved in two concrete ways and not claimed beyond that: a visitor gets
custody of their words in under a minute with no account, and a person can read what happened to
their thing in plain language. The shell still shows two navigations on Home and still says
"Workbench" where canon says Bench; that is Slice 1 and deliberately deferred while the founder's
visual shell is in progress.

**Independent value.** The record view needs no AI, no collaborator, no type, no money and no
account. Custody needs nothing but typing. Confirmation, once surfaced, needs no AI and no
community. Export needs nothing. None of today's work requires another part of SOLVE to be useful.

**Real functionality.** A person can create, reopen, read and own real things, and the kernel's
673-event chain verifies end to end after the migrations. They cannot yet ask for confirmation,
attach a photograph (no storage bucket exists), name their own type, or export — all four are
built below and unreachable above.

**The compounding rule — each new feature strengthens another without becoming its dependency.**
The custody module strengthens Home and the record view; neither depends on it existing.
The six-part record strengthens confirmation by giving an answer somewhere to appear; confirmation
does not depend on the record. Confirmation strengthens evidence without evidence depending on it.
The vocabulary test strengthens every surface and nothing depends on it.

---

## What has NOT been verified, stated so it is not mistaken for done

- **Postgres 17 behaviour.** Both new migrations are *installed* on the store's 17 and their
  behaviour is exercised only on the embedded 18. No Postgres 17 binaries exist on this machine and
  no `brew` to install them. This project has been bitten by that exact difference before.
- **No real person has used confirmation.** Four tests are not a customer.
- **The production secret key is set but unexercised.** `SUPABASE_SECRET_KEY` now exists on
  Production with no git-branch scope (the real bug: the old value existed only on the retired
  `claude/keen-cerf-tpd7io` branch). A World read over MCP has not yet been run against it.
- **Production has neither new migration.** Staging only, awaiting an explicit go.
- **Staging has drifted from the repo:** three migrations applied there have no file here
  (`public_space_projection`, `sov_public_identity`, `sov_card_permanent_account_publishing`), so
  the repo cannot rebuild staging. The card depends on the public-identity one.
- **No storage bucket exists**, so files, media and photographic evidence are three capabilities
  with zero code possible until one is created.
- **Identity recovery is decided and unbuilt**, so "losing the card must not mean losing the
  person" is not yet true.

---

## Tomorrow, in order

1. **Confirmation surfaces** — ask on a thing, answer by link. Completes the only loop no notes app
   can do, and it is the brother test. Everything underneath is applied and attack-tested.
2. **A person's own vocabulary** — `define_type` / `put_object` surfaced, which is the most
   distinctive thing in the specification and currently one call site away.
3. **Export** — one control over `export_mine`; satisfies "leave with your information" outright.

Blocked on the founder, not on engineering: a storage bucket, and reconciling the three
staging-only migrations.
