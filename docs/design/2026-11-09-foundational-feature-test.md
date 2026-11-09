# The founder's foundational-feature test, scored against the repository

The founder's *"Imagine the entire application, stripped to its foundation"* specification
(2026-11-09) ends with the right challenge: **"Its next test is whether each of these independent
human benefits actually works."**

So here is each capability it names, scored against `main` as of `7a92ddf`. Not against intent.

**Verdict first: of the 48 capabilities named, 9 work today, 13 are partial, 26 do not exist.**
That is not a criticism of the specification — it is what a foundation looks like three days into
being built deliberately. The value of the scorecard is that it turns 48 aspirations into a short
list of things that are nearly true.

Scoring: **✅ works** — a person could use it today and get the stated benefit.
**◐ partial** — the mechanism exists but the benefit is not reachable, or only in one place.
**✗ missing** — no implementation.

---

## Home — orientation and familiarity

| Capability | | What is actually true |
|---|---|---|
| Your Tools | ✗ | `/apps` lists optional integrations; no personal arrangement of favourites |
| Find | ✗ | No search exists anywhere in `app/` |
| Bring in | ◐ | Only one source: Instagram, source-backed. No file, photo, link or document path |
| Create | ✅ | The intent form records a real thing, now even for a visitor (2026-11-09) |
| Your Things | ✅ | Recorded in the kernel, listed on Home, survives reload and blocked storage |
| Continue | ✅ | Recent things are listed and reopen |
| Personalize | ✅ | Three appearance modes, saved per account, device-local for guests |
| Attention | ✗ | Nothing aggregates unresolved work. `read_confirmations` exists, unused |

## ID — identity and recognition

| Capability | | What is actually true |
|---|---|---|
| Personal identity | ✅ | Kernel actor per person, anonymous or signed in |
| Public profile | ◐ | Applied to staging as `sov_public_identity`, **no migration file in this repo** |
| SOV digital card | ✗ | `/card` is hidden by `lib/product/routes.ts`: no per-person issuance |
| Physical SOV card | ✗ | Requires the anonymous public-read path, which is authorized but undesigned |
| Contact sharing | ✗ | — |
| Credentials | ✗ | Evidence exists in the kernel; no credential surface |
| Privacy | ◐ | Visibility is per record version; no one place a person reviews it |
| Recovery | ✗ | Decided 2026-11-09 (scoped). Nothing built. **Blocks the card** |
| Portability | ◐ | `export_mine` applied to staging, zero call sites |

## Space — ownership and continuity

| Capability | | What is actually true |
|---|---|---|
| Save a thing | ✅ | |
| Files and media | ✗ | **No Supabase storage bucket exists at all.** Blocks evidence and media |
| Collections | ✗ | |
| Relationships | ◐ | `read_relations` / `relate` exist, no surface |
| History | ✅ | Append-only, hash-linked, and now readable in the six-part record |
| Evidence | ◐ | Attachable in the kernel and rendered in the record; nothing can be uploaded |
| Shared Space | ✅ | Rooms, membership, real grant and revoke |
| Community Space | ◐ | `/communities` exists; not folded under Space as decided |
| Type definition | ◐ | `define_type` applied to staging, zero call sites |
| Export | ◐ | Same |

## Bench — creation and competence

| Capability | | What is actually true |
|---|---|---|
| Write | ◐ | `update_document_version` in the kernel; the workbench edits artifacts |
| Draw / design | ✗ | `/studio` is behind the experiment flag |
| Build a page | ✗ | |
| Edit media | ✗ | |
| Organize information | ✗ | |
| Preview | ✗ | |
| Save and reopen | ✅ | Artifacts persist and reopen in the workbench |
| Versions | ◐ | Every write is a version in the kernel; no restore surface |
| Share creation | ◐ | Via World access, not per creation |
| Reuse | ✗ | |
| Run applications | ✗ | Deferred by decision |
| Customize the environment | ✗ | Appearance only, not composition |

## Control — agency and security

| Capability | | What is actually true |
|---|---|---|
| See access | ◐ | Real, but only inside one World (`access-panel.tsx`) and in the new record view |
| Revoke access | ◐ | Same — works, World-scoped |
| Manage connections | ◐ | `/apps`, `/oauth/consent` |
| Manage devices and sessions | ✗ | |
| Manage AI authority | ✗ | Grants exist; no agent-authority surface |
| Review actions | ◐ | `read_actions` exists; `/control` is mostly prose |
| Stop pending actions | ✗ | `propose`/`approve`/`enact` with delays exist in the kernel, no surface |
| Recovery settings | ✗ | |
| Export | ◐ | `export_mine`, no call site |
| Reset appearance | ◐ | Modes can be changed; no explicit restore-to-usable |

---

## What this says to do next

**Five things are one small step from working**, because the kernel half is already applied to
staging and only a call site is missing. In rough order of human value per hour of work:

1. **Type definition and its vocabulary** — `define_type` / `put_object`. Makes the product speak
   the person's own words, which is the single most distinctive thing in the specification.
2. **Confirmation** (ask / answer) — the kernel shipped today; it is the contractor's whole need
   and the only loop no notes app can do.
3. **Export** — one button over `export_mine`. Satisfies "leave with your information" outright.
4. **Attention** — `read_confirmations` plus unresolved things; Home's missing sixth block.
5. **Review actions and stop pending** — the engine exists with real delays and thresholds.

**Two things are blocked on the founder, not on engineering.** A storage bucket (files, media and
photographic evidence — three capabilities, zero code until it exists), and reconciling the three
staging-only migrations so public identity is reproducible, which the card depends on.

**One thing is both missing and load-bearing for the card: identity recovery.** It is decided but
unbuilt, and "losing the card must not mean losing the person" is not true until it exists.

**And one honest note on the specification's own test.** Applied strictly, *"familiar immediately —
understood without learning our terminology"* currently fails for the things a person creates:
Home calls them projects, the kernel calls them Worlds, the record view calls one a World, and the
specification calls them things. Four names for one concept. That is a naming decision to settle
once, and it costs nothing but agreement.
