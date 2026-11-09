# SOLVE — what actually works

The living status of every capability across the five destinations. Updated whenever an
acceptance run changes what is known. A capability is **complete only when its human action has
been executed, its result independently read back, its authority verified, and its failure modes
tested** (founder directive, 2026-11-09).

Last updated from acceptance run `acc-202611092323-yxh1` against **solve-staging**
(`taeikshnbcsjlgbattyp`), commit on `main` recorded in `BUILD-STREAM.md`.

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
| Name yourself | **Implemented, unverified through the app** | `set_person_label` works and reads back via `read_actors` — proven by the harness labelling its own fixtures, not by the `/account` form |
| Public identity for a signed-out visitor | **Backend only, and drift-blocked** | `sov_public_identity` and `public_space_projection` are applied to staging with **no file in this repo** |
| Public preview, share, contact, credentials | **Unimplemented** | |
| SOV card | **Hidden** | `lib/product/routes.ts`: no per-person issuance |
| Identity recovery | **Unimplemented** | Decided 2026-11-09 (scoped); nothing built |

## Space

| Capability | Status | Evidence |
|---|---|---|
| A person's things are listed in Space | **Verified automatically** | Same thing appears; opens its record; no word or id of ours |
| The guaranteed six-part record | **Verified automatically** | All six parts in order; holder shown as You; every act has a real name; no internal id; "Nothing proves this yet" |
| Counterparty confirmation | **Verified in kernel tests; backend only** | `tests/kernel/counterparty-confirmation.test.ts` 4/4, applied to staging, **zero call sites** |
| A person's own types and vocabulary | **Verified in kernel tests; backend only** | `define_type`, `put_object`, applied to staging, zero call sites |
| Invite someone into a thing; grant and revoke | **Implemented, unverified here** | `access-panel.tsx` and invitations exist and are World-scoped; needs signed-in fixtures |
| "Talk to Your AI" panel | **UI only, unverified** | Renders with a Send button; nothing has exercised it |
| Apps & Integrations, Public SOV Profile cards | **UI only** | Describe capabilities; no functional run |
| Evidence (photographs, files) | **Blocked** | No storage bucket exists |

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
3. **A storage bucket**, for photographs and files.

Not blocked, and next on my side: **reconciling the staging migration drift** (read-only extraction
of the three staging-only migrations into this repo), and **making confirmation usable** — which can
be fully automated *now*, because the counterparty can be an anonymous identity and needs no email.
