# SOLVE — the platform in ten layers

**Status:** Builder-authored (Claude, 2026-11-11). This is a map of what exists and a
proposed build order. **It does not change the founder's direction**
(`2026-11-10-consolidated-direction.md`); where the two differ, the founder's governs, and
only the founder changes it. Decisions belong in `DECISIONS.md`, in the founder's words.

**Why it exists:** two AI builders spent 2026-11-11 duplicating a console, on two different
shells, from two different base branches, and discarded two pull requests doing it. Not one
of those mistakes was about capability. All of them were about not knowing what already
existed or which branch was real. This file is the answer to both questions in one place.

**How to read the state column:** "built" means `docs/acceptance/STATUS.md` records it as
verified, or it is plainly present in the code on the trunk. It is not a claim about
production — nothing here is in production.

---

## The ten layers

| # | Layer | What it is | State |
|---|---|---|---|
| 1 | **Record** | Identity, authority, events with provenance, evidence, double-entry ledger, append-only history (`kernel`, `kernel_api`) | **built, verified.** The asset. |
| 2 | **Spaces** | Where work lives: a Space, its people, its pieces, publication, one public link | **built, verified** |
| 3 | **Connect** | How an outside intelligence attaches: OAuth 2.1 + PKCE + dynamic registration, its own agent per app, per-Space read-or-add grants, immediate revocation, audit | **built**, on the trunk's preview |
| 4 | **Missions** | How work outlives a conversation: `kernel.tasks` (objective, inputs, required capability, risk, reversible, budget, evidence bases, verification) and `kernel.actions` + approvals + transitions (proposed → authorized → enacting → completed/failed), with quorum, delay and challenge-window policies | **built in the kernel; no screen uses it** |
| 5 | **Control** | What can reach you, revoke it, export everything, recover | **built** (recovery unbuilt) |
| 6 | **Metering** | Durable spend per actor, shared across instances; per-agent daily caps | PR #98; **migration not applied to any store** |
| 7 | **Console** | One surface on every screen: a single thread, what is waiting on you, undo, and the screen you are standing on | **two competing PRs (#94, #99); zero live replies ever** |
| 8 | **Master bot** | One kernel agent holding the person's delegated authority. Engines sit behind it through a provider interface and a routing policy; it arbitrates when they disagree; one memory across all of them; every act recorded as itself with `on_behalf_of` the person | **not built** |
| 9 | **Means** | Sandboxed execution, repository writes, outbound action — so it changes something real instead of drafting | `bring_in_link` and `github_read_repo` only |
| 10 | **Outcomes** | What actually worked, recorded and fed back into context; standing earned from record rather than granted by assumption | **not built — and the only layer nobody else can copy** |

Layers 1–6 are most of a year of work, already done. The gap is not foundation. It is that
layers 7–10 do not exist, so almost none of that foundation is reachable by a person.

---

## The one rule for layer 8

**Apps speak *to* the master bot, never *as* it.**

The master bot holds the person's delegated authority. Other intelligences connect with
their own scoped agents and ask it for things. Every act is recorded as the master bot
acting, with `on_behalf_of` pointing at the person, so "who decided this?" stays answerable
when several agents each did something permitted.

Inverting this rebuilds the exposure that `20261110080000_connector_containment.sql` was
written to close, with a friendlier name.

**Containment has exactly one chokepoint:** `kernel.append_event` refuses a caller marked
`app_read_only`. Anything that writes to kernel memory *without* appending an event is not
contained. Any new kernel table must either append an event or refuse `app_read_only`
itself. (Found 2026-11-11 in a draft meter that inserted directly into its own table; PR #98
fixes that instance. The pattern is the risk, not the instance.)

---

## Proposed build order

Ordered for earliest proof, not for size.

1. **Name the trunk.** `AGENTS.md` says to push a slice from a side branch but never says
   what to branch *from*. Two agents independently guessed `main`, which is 47 commits
   behind this branch and zero ahead. **30 of 43 open pull requests target `main`.** One
   line naming the trunk stops that reproducing. *Founder's call; it is their file.*
2. **One live reply in the console.** Hours of work, and the oldest unproven thing in the
   project. Code written, tests green and "preview queued" are three proxies stacked where
   one fact belongs.
3. **Attribution on every piece an app reads.** `read_world` returns `{id, text}` — no
   author. With two AIs holding `add` in one Space, neither can tell the person's words from
   the other's, so the only safe reading is to distrust all of it. Add `by`, derived from the
   `kernel.entity.created` events the Space page already reads.
4. **A provider interface and a routing policy.** One engine becomes any engine. Models are
   never hard-coded; each adapter lists what it has at runtime. Routing, in order:
   sensitivity (a local-only request never falls through to a cloud model — it fails with a
   clear message), then the agent's preference, then escalation after two malformed tool
   calls, then budget (drop to cheaper or pause), then availability.
5. **The master agent itself.** Steps 3 and 4 are its parts. First slice: one live reply and
   one recorded act — identity, authority, engine and record, in miniature.
6. **Wire the console to missions.** No new kernel code. Unlocks the largest thing already
   paid for: work that survives the conversation ending, with approval only where an action
   is irreversible.
7. **Capture outcomes and feed them back.** A model knows what is likely; only SOLVE can know
   what actually worked for this person. This is the layer that compounds.
8. **Means.** Sandbox and repository writes. For a person's own repositories this needs
   per-user OAuth, which is wider than the single narrow GitHub App install currently planned.

Steps 1–4 are about a day. 5 and 6 are the product. 7 is the moat.

**Sequencing constraint from the founder's direction:** only one primary consumer experience
is under active development at a time, and external-app access does not expand until the
permission boundary is independently verified. Steps 3 and the chokepoint audit are that
boundary — the security track, which the direction keeps separate from the consumer
milestone. Steps 5–8 are not authorized by this file; they need the founder's word.

---

## Two lines in STATUS.md that are out of date

Both matter because `AGENTS.md` tells every builder to read `STATUS.md` first, and both of
these would have sent a builder the wrong way today.

1. **"It reads and adds drafts where you let it in — Blocked"** (*"staging rejects it
   ('Invalid API key')"*). The **read** half works. Verified 2026-11-11 by a real connected
   app, not a fixture: Claude Code, OAuth'd through the trunk's deployed preview with `add`
   access to one Space, called `read_world` and received the Space's title and its one piece.
   The blocker was designed out when `lib/bot/mcp-auth.ts` dropped the service key — the
   app's own token is now the only authority the connector uses. The **add** half is still
   unverified: an app cannot delete, and no screen removes a piece, so the test leaves
   something behind that nobody can take out.
2. **"Edit Space (layout, components) — Unbuilt. Only colours change today."** `page.tsx` on
   this branch has `EditSpace` with composition (`base`/`story`), cover, featured pieces and
   tint, plus a preview bar and undo.

Proposed, not applied: `STATUS.md` is the acceptance record and these are the founder's to
accept.

---

## What the Space already gets right

Worth naming so it does not get "cleaned up": the provenance microcopy. *"their word, not
checked by Solve"*, *"brought in by Solve on <date>"*, *"added by … edited by …"*. That is
the claims-versus-verified rule rendered in plain language in the actual UI, which almost
nothing ships. And `previewBar` — *"Previewing — nothing is saved yet. [Discard]"* — is the
reversibility grammar the rest of the platform needs, already invented, currently used only
for presentation drafts.
