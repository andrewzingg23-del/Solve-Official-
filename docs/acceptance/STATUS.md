# SOLVE — what actually works

The living status of every capability across the five destinations. Updated whenever an
acceptance run changes what is known. A capability is **complete only when its human action has
been executed, its result independently read back, its authority verified, and its failure modes
tested** (founder directive, 2026-11-09).

Last updated 2026-11-10 from acceptance run `acc-202611100346-u17h` (**206/206, all six scenarios:
home, confirm, card, control, together, page**) against **solve-staging** (`taeikshnbcsjlgbattyp`),
on branch `solve/from-zero` — **not on `main`, not in production**. The `page` scenario was then
extended for deliberate selection: the full six-scenario run `acc-202611100408-1a18` passed 212 of 213,
and its one miss was the check's own wording ("stays" against the corrected "they stay"). With the
check corrected, `page` passed on its own (`acc-202611100411-4ksq`).

**No capability here is verified by a real human yet.** Automated runs prove behaviour and authority;
they cannot show whether someone would enjoy this, or replace a link-in-bio with it. The first real
test is written out in `docs/acceptance/2026-11-10-first-real-experience.md`.

## How to read this

| Status | Means |
|---|---|
| **Verified automatically** | Performed in a real browser against the real staging kernel, result read back through the kernel as that person, authority and failure modes tested. `npm run test:acceptance` |
| **Verified in kernel tests** | Proven against real migrations on the embedded Postgres 18, attacks included — but never exercised through the app or on the store's Postgres 17 |
| **Verified by real human** | A named person did it for real. None yet |
| **Implemented, unverified** | Code exists and may work; nothing has proven it |
| **UI only** | The screen exists; there is no working behaviour behind it, or none has been shown |
| **Backend only** | The kernel can do it; no person can reach it |
| **Unimplemented** | Nothing exists |
| **Blocked** | Cannot proceed without something only the founder can provide — see the last section |

**`scripts/test-product.mjs` is not functional acceptance.** It runs the app with no database, so it
proves layout, device-local drafts and keyboard/mobile behaviour only. Its passing has never meant
that a thing was saved. `scripts/acceptance/` is the functional gate.

All identities in acceptance runs are **automated staging fixtures**, labelled `[automated <run>]` in
the kernel and read back to confirm it, and every record they write carries the same marker. None is
a real person and none touches production.

---

## Home

| Capability | Status | Evidence |
|---|---|---|
| A visitor gets an identity with no sign-up | **Verified automatically** | Session cookie present, `whoami` returns a kernel actor |
| Create a thing | **Verified automatically** | Begin → listed on Home; `read_world` as the owner returns exactly her words |
| Unsent words survive a refresh | **Verified automatically** | Device draft, reload, field still holds the text |
| Reopen it later | **Verified automatically** | Fresh load still lists it; record heading matches |
| Its history is hers | **Verified automatically** | `read_events`: every act is hers, plus only the system issuing her own authority on claim |
| Network drops mid-create | **Verified automatically** | Error shown, words kept, retry after reconnect records it |
| Another person cannot reach it | **Verified automatically** | Exact address → 404, no content leak; `read_world` refused; `record_event` into her scope refused |
| A second browser does not see a guest's things | **Verified automatically** | Zero matching cards; the custody notice says truthfully where their own work lives |
| Find (search) | **Unimplemented** | No search anywhere in `app/` |
| Bring in (photo, file, link, text) | **UI only / partial** | Only the Instagram source path exists |
| Attention (what needs a response) | **Unimplemented** | `read_confirmations` exists, unused |
| Your Tools | **UI only** | `/apps` lists optional integrations; no personal arrangement |
| Account claiming — a guest signs in and keeps their things | **Implemented, unverified** | `seamless_guest_identity` is applied; **not proven**, and needs signed-in fixtures (blocked) |

## ID

| Capability | Status | Evidence |
|---|---|---|
| Name yourself | **Implemented, unverified through the app form** | `set_person_label` works and reads back via `read_actors` — proven by the harness labelling its own fixtures, not by the `/account` form |
| Public identity for a signed-out visitor | **Backend only, and drift-blocked** | `sov_public_identity` and `public_space_projection` are applied to staging with **no file in this repo** |
| Public preview, share, contact, credentials | **Unimplemented** | |
| Digital SOV card on ID | **Verified automatically** | Carries the person's chosen name from their identity record; true ID-1 proportion at 320/390/1440; name and small print measured ≥ 4.5:1 in the rendered browser; the face claims nothing untrue (no number, expiry, payment mark or verification) |
| Shape the card's look | **Verified automatically** | Base, Personal, Expressive; any colour; dark or light; matte, metal or glass. The kernel holds exactly the saved look as a private record in the person's own scope; it persists across reloads; every change is an act in their history |
| Undo, and return to Base | **Verified automatically** | Undo restores the previous look as a new version — including after the very first change; Base is one tap away |
| Nobody else can read or write a person's look | **Verified automatically** | Read refused; a forged write into their scope refused |
| Any colour stays readable | **Verified in unit tests** | 306 hostile combinations (brightest yellow, near-white, near-black, primaries) across every expression, tone and finish: all text ≥ 4.5:1 |
| Card's public side (scan → their world), physical card | **Not built** | Needs the narrow public-read path and the staging drift reconciled; printing needs a manufacturing decision |
| Old `/card` sandbox | **Hidden** | `lib/product/routes.ts`: no per-person issuance |
| Identity recovery | **Unimplemented** | Decided 2026-11-09 (scoped); nothing built |

## Space

| Capability | Status | Evidence |
|---|---|---|
| A person's things are listed in Space | **Verified automatically** | Same thing appears; opens its record; no word or id of ours |
| The guaranteed six-part record | **Verified automatically** | All six parts in order; holder shown as You; every act has a real name; no internal id; "Nothing proves this yet" |
| Ask someone to confirm a thing | **Verified automatically** | The holder asks from the record; a link is shown once and never stored; the record shows the request as waiting, never as confirmed |
| Answer from a link, with no account | **Verified automatically** | A stranger to SOLVE opens it, sees the asker's chosen name, the one thing and the question — nothing else of the holder's — and confirms or disputes |
| Both sides see the outcome | **Verified automatically** | The kernel records the answer and its evidence as authored by the person asked; the holder sees "Confirmed by someone other than its owner" and who; a returning answerer is told "You answered" |
| Confirmation cannot be abused | **Verified automatically** | The holder cannot confirm their own record; a changed answer is refused in the app and in the kernel; a tampered or malformed link reveals nothing; answering grants no access to the holder's thing |
| Withdraw a request | **Backend only** | `cancel_confirmation` exists and is kernel-tested; no control in the app yet |
| A person's own types and vocabulary | **Verified in kernel tests; backend only** | `define_type`, `put_object`, applied to staging, zero call sites |
| Build something with a friend | **Verified automatically** | `together`: the starter invites by link (share sheet or copy); a friend with no account sees who invited them and to what, joins with one press, adds words and photos credited to them; a link preview doesn't use up the invite; a used link turns anyone else away; only the starter can make invites (kernel-enforced) |
| Photos in a shared thing | **Verified automatically** | A phone photo carrying GPS is stored with no location; stored bytes hash to what the kernel recorded; outsiders can't download, link, list or upload; a recorded photo can't be overwritten even by a builder |
| Ways to make it (tools as paths) | **Verified automatically** | `page`: a portfolio is recommended here first, a specialist offered and labelled as opening another app; the Replit link carries exactly the brief the owner edited, in Replit's documented format; a made-elsewhere link comes back marked "their word, not checked" |
| AI choosing the tool | **Unimplemented** | Needs are read by tested rules, not a model |
| Public page, deliberately selected | **Verified automatically** | Nothing the owner made is public until ticked; what friends added is never offered; the preview shows exactly what's ticked; a stranger with no account sees exactly the ticked pieces, links tappable, and gets no identity by looking; ticking more updates the live page |
| Stop sharing | **Verified automatically, with a stated limit** | The page and its photos stop opening at once for new requests. **Not** recalled: a photo link already issued keeps working until it expires (up to 10 minutes), and anything a visitor already saved or screenshotted. The owner is told exactly this |
| Grant and revoke a named person | **Implemented, unverified here** | Kernel-tested (removing someone removes their photo access too); no rebuilt control to remove someone yet |
| "Talk to Your AI" panel | **UI only, unverified** | Renders with a Send button; nothing has exercised it |
| Apps & Integrations, Public SOV Profile cards | **UI only** | Describe capabilities; no functional run |
| Files other than photos; deleting a photo so its bytes are gone | **Unimplemented** | The `things` bucket exists on staging; deletion waits on per-scope keys |

## Bench

| Capability | Status | Evidence |
|---|---|---|
| Bench home: begin, resume | **Layout-tested only** | Renders at 320/390; resume list for a signed-in person never exercised |
| Edit a thing in the workbench | **Implemented, unverified** | Requires a durable account; needs signed-in fixtures |
| Versions and restore, preview, reuse, export | **Unimplemented / backend only** | Every write is versioned in the kernel; no surface |

## Control

| Capability | Status | Evidence |
|---|---|---|
| Control home | **UI only** | Prose about capabilities, no data |
| See and revoke access | **Backend only** (World-scoped UI exists) | `my_grants`, `revoke_grant` |
| Export everything | **Backend only** | `export_mine`, zero call sites |
| Sessions, devices, AI authority, pending actions | **Unimplemented** | The action engine (`propose`/`approve`/`enact`, delays) exists in the kernel |

---

## Defects the acceptance system found and fixed on its first day

Each was invisible to unit tests and to the database-free browser suite, and each was something a
real visitor would have seen.

1. **Every unnamed visitor's acts rendered with a blank name** in their own record, and the owner
   line read " (you)" with nothing before it. Ordinary guests have an empty label.
2. **The kernel's service actor appeared as "kernel"** — our word, on a person's thing.
3. **The record showed the raw scope id** `world:<uuid>` under "whose it is".
4. **Space hid a person's own things behind "Create my Space"** until they answered onboarding
   questions — a prerequisite in front of what they already owned.
5. **Space told a guest their work was "saved only in this browser"** and called things "projects".

Then on confirmation, two more: the confirmation readers named people from the raw label column
instead of their chosen name (the asker appeared as "Someone"; fixed in the kernel by
`20261110010000_confirmation_names.sql`, applied to staging), and the answer re-rendered its own page
and unmounted the message telling the person their answer was recorded.

Then on the card, four more: our word "Project" still in ID's copy; undo impossible after a person's
first change (it had nothing to restore to); raw kernel event types in the account history; and the
skip link flashing over the card after saving, because a server action refocused the page and the
link showed on any focus rather than keyboard focus only.

And two defects in the harness itself, fixed rather than tolerated: an ambiguous `alert` selector
(Next.js renders an invisible route announcer with the same role), and fixture labels that were
trusted on write instead of read back.

---

## What genuinely needs the founder, and why

1. **Signed-in fixtures — the single biggest gap.** Every signed-in path is unverifiable by
   automation today: account claiming, editing in the workbench, durable identity across devices,
   invitations, grant and revoke. Email delivery cannot be automated, so the harness needs to mint
   sign-in links itself. The standard, staging-only way is Supabase's admin `generateLink`, which
   needs a **staging** secret key. Put it in `.env.local` as `SUPABASE_STAGING_SECRET_KEY` — never in
   chat — and the harness will create clearly labelled fixture accounts on staging only. Without it,
   those paths can only ever be *verified by real human*.
2. **The iPhone sign-in issue.** What exactly did you see? The leading hypothesis from the code:
   magic links use PKCE, so the code verifier lives in the cookie jar of the browser that *asked* for
   the link. On an iPhone, a home-screen SOLVE app, Gmail's in-app browser and Safari are three
   separate cookie jars, so a link opened in a different one fails. The robust fix needs an **email
   template change** in Supabase Auth (a `token_hash` link, or a 6-digit code), staging first. The
   code side is mine; the template is a dashboard setting.
3. ~~A storage bucket~~ — created on staging 2026-11-10 (`things`, private, kernel-decided).
4. **The anonymous sign-in rate limit on staging** (about 30 new guests an hour from one address).
   It blocked automated runs twice on 2026-11-10, and friends joining from one shared network would
   meet the same ceiling. It is a Supabase Auth setting.
5. **A real experience with you and your brother**, written out in
   `docs/acceptance/2026-11-10-first-real-experience.md`. No automated run can stand in for it.

Not blocked, and next on my side: **the SOV card** — the founder's direction is that the visual
language is the value and the card is its reference — built on a versioned appearance record, and
**reconciling the staging migration drift**, which the card's public side depends on.
