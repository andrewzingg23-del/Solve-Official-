# SOLVE — shell and page foundation: map, reuse and gaps

Answers the founder's *Complete Shell & Page Foundation* directive (2026-11-09),
deliverables A–E, plus a proposed slice order for F and the validation path for G.

Everything below was read from the repository on 2026-11-09 at `main` `54c05c0`.
Where the directive assumes something the code contradicts, the code is reported.

---

## 0. Six findings that change the shape of this work

**1. There is already exactly one global shell.** `ProductShell`
(`app/product/shell.tsx`) is applied in `app/layout.tsx` and wraps every route.
The directive's first requirement is therefore largely met. What is wrong is its
*destinations*, not its existence.

**2. The real duplication is one page, not many.** `app/reality/entry.tsx` renders
its **own** header (`.reality-head`) and its **own** bottom navigation
(`aria-label="Mobile navigation"`) *inside* `ProductShell`, which already renders
a sidebar and `aria-label="Primary mobile"`. So `/` ships two navigations today.
That is the single concrete instance of "a separate application shell per
feature", and it is one file.

**3. Navigation destinations are wrong, and the fix is five lines.** `homes` in
`app/product/shell.tsx` is currently Space · Projects · Communities · Control.
The directive asks for Home · ID · Space · Bench · Control.

**4. All five destinations already have routes.** `/` (Home, `RealityEntry`),
`/account` (ID), `/space` (Space), `/workbench` (Bench — currently a pure
redirector, 12 lines), `/control` (Control, 41 lines). Nothing needs inventing to
stand the five up.

**5. The mechanism for retiring and aliasing old paths is already built.**
`lib/product/routes.ts` is a single release-surface policy with aliases
(`/sov-id`, `/claim`, `/start` → `/account`; `/command` → `/`; `/avatar` →
`/bot`) and experiment gating that already hides ten roots. Directive §12.4 —
"map old paths into the new structure without deleting existing capabilities" —
is satisfied by extending this file, not by deleting routes.

**6. Three mechanisms are built and have zero call sites.** `defineType`,
`putObject`, `exportMine`, `requestConfirmation` and `readConfirmations` are
applied to staging and typed in `lib/kernel/client.ts`, and **nothing in `app/`
calls them**. That is where the leverage is: the gap is reachability, not
capability.

---

## A. Route and page map

Status key: **W** working · **C** exists, needs consolidation · **U**
implemented but unactivated/unverified · **M** missing, needs engineering ·
**F** needs founder authorization.

### Home

| Logical page | Route today | Status | Note |
|---|---|---|---|
| H01 first-use Home | `/` `app/reality/entry.tsx` | C | Works; renders duplicate chrome; first line does not reach the kernel |
| H02 developed Home | `/` | C | Reads real `listCreativeWorlds`; honest load-failure state present |
| H03 universal find | — | M | No search anywhere in `app/` |
| H04 create | `/` intent form, `/worlds/new` | C | Two entry points for one idea |
| H05 bring in | `/personalize/instagram` only | C | Source-backed; not generalised to file/photo/link |
| H06 attention | — | M | Nothing aggregates unresolved work; `read_confirmations` exists unused |

### ID

| Logical page | Route today | Status | Note |
|---|---|---|---|
| I01 my identity | `/account` | W | |
| I02 edit identity | `/account` | W | Save/failure states present |
| I03 public identity | staging migrations `sov_public_identity`, `public_space_projection` | U | **Applied to staging, no migration file in the repo.** Drift; see §E |
| I04 public preview | — | M | |
| I05 share / contact | — | M | |
| I06 credentials | — | M | Kernel has evidence/claims; no surface |
| I07 SOV card | `/card` | F | Hidden by `routes.ts`: "no per-person issuance/ownership flow" |
| I08 identity recovery | — | M | Decision recorded 2026-11-09 (scoped recovery); nothing built |
| I09 privacy | `/account` partial | C | |

### Space

| Logical page | Route today | Status | Note |
|---|---|---|---|
| S01 my things | `/space`, `/projects` | C | Two lists of overlapping concepts |
| S02 one thing | `/world/[worldId]` | C | Not the six-part record |
| S03 edit a thing | `/world/[worldId]/workbench` | C | |
| S04 define a type | — | M (kernel W) | `define_type` live, zero call sites |
| S05 relationships | `read_relations` | U | |
| S06 evidence | — | M | **No storage bucket exists.** Blocking |
| S07 history | `readEvents` used in 27 places | C | No reusable timeline component |
| S08 shared space | `/world/[worldId]/room` | W | |
| S09 people / members | `access-panel.tsx` | W | Real grant/revoke, World-scoped |
| S10 invite | `invitation-panel.tsx`, `/world-invite/[token]` | W | Full state set already |
| S11–S15 community | `/communities`, `/community/[id]` | C | Must fold under Space, not primary nav |
| S16 appearance | `lib/product/appearance.ts`, `/space` | W | |

### Bench

| Logical page | Route today | Status | Note |
|---|---|---|---|
| B01 bench home | `/workbench` | C | 12-line redirector, no home |
| B02 generic editor | `/world/[worldId]/workbench` | C | |
| B03 document editor | `update_document_version` | U | Kernel only |
| B04 visual / media | `/studio`, `/world/[id]/studio` | F | Behind experiment flag |
| B05 website / app | — | M | |
| B06 workflow | `lib/causal/*`, actions/transitions | U | Engine exists, no surface |
| B07 preview · B08 versions · B09 test/run | partial | M | |
| B10 publish/share | `public_world`, publication boundaries | U | |
| B11 export | `export_mine` | U | Live, zero call sites |
| B12–B14 composition, collaborative | — | M | Explicitly deferred scope |

### Control

| Logical page | Route today | Status | Note |
|---|---|---|---|
| C01 control home | `/control` | C | Mostly prose; little real data |
| C02 people and actors | `read_actors` | U | |
| C03 one actor | — | M | |
| C04 grants | `my_grants` (10 call sites) | C | Exists World-scoped; generalise `access-panel` |
| C05 grant / revoke | `issue_grant` / `revoke_grant` (4 each) | C | Same |
| C06–C08 connections, AI providers | `/apps`, `lib/product/optional-integrations.ts`, `/oauth/consent` | C | |
| C09 action history | `read_actions` (5) | C | |
| C10 pending · C11 approvals | `propose_action` / `approve_action` / `enact_action` | U | Engine live, no surface |
| C12 security · C13 data/export · C14 restore | partial | M | `export_mine` is the spine of C13 |

### Shared system screens

Working: G01 `/login`, G06 `/world-invite/[token]`, G19 (guest draft survives
blocked storage — verified by the browser suite), G20.
Unactivated: G21, G22.
Missing and small, because the kernel half is done: **G07 confirmation request,
G08 confirm/dispute** (`request_confirmation`, `read_confirmation_request`,
`answer_confirmation` all live on staging, zero call sites), G10 provenance
inspector, G11/G12/G13/G14 the action lifecycle surfaces.
Missing: G02, G03, G04, G05, G09, G15, G16, G17, G18.

---

## B. Shared shell architecture

Keep `ProductShell` as the one shell. Changes required:

1. `homes` becomes Home `/` · ID `/account` · Space `/space` · Bench
   `/workbench` · Control `/control`.
2. `RealityEntry` stops rendering `.reality-head` and `.reality-mobile-nav`; the
   shell supplies both. Its intent form, starters and appearance block stay.
   This removes the duplicate navigation and the second skip-link target.
3. `minimal` mode keeps its current job (`/oauth`, `/saved`, `/world-invite`) and
   gains the confirmation-answer route, which a counterparty opens from a link
   and which must not present itself as the recipient's own workspace.
4. Workspace focus mode: one `WorkspaceHost` prop that suppresses the sidebar for
   editors, maps and canvases. `minimal` is the existing precedent.
5. Projects and Communities leave primary navigation and are reached from Space.
   Their routes stay and keep working — nothing is deleted.

Desktop 1440px: existing left sidebar. Mobile 390px: existing compact header plus
bottom navigation, already ≥44px and verified by `scripts/test-product.mjs`.

---

## C. Page schematics

Produced **only for the slices being built**, deliberately. A schematic for a page
whose mechanism does not exist yet is concept art, and the founder's standing
constraint is not to build or specify ahead of leverage. The map above records
every page's parent and status; schematics follow each page into its slice.

Slice 1 and 2 schematics are in §F.

---

## D. Component reuse map

| Contract in the directive | Exists today as | Action |
|---|---|---|
| AppShell, PrimaryNavigation | `app/product/shell.tsx` | Keep, retarget `homes` |
| IdentityControl | `shell.tsx` identity blocks, `lib/product/identity.ts` | Extract |
| UniversalEntry, Create | `reality/entry.tsx` intent form, `project-composer.tsx`, `/worlds/new` | Consolidate to one |
| BringIn | `personalize/instagram/*`, `lib/product/public-embeds.ts` | Generalise |
| ResourceList | `reality-project-grid`, `app/projects`, `app/space/personal-space.tsx` | Three variants → one |
| ThingInspector, TypeDrivenFields | — | **Build; nothing exists** |
| ProvenanceLine | `tests/github/status.test.ts` references an unused `provenanceLine` | Build properly |
| HistoryTimeline | 27 ad-hoc `readEvents` call sites | Extract one |
| EvidenceViewer | — | Build; blocked on storage |
| AuthorityControl, PermissionGrant | `app/world/[worldId]/access-panel.tsx` + `access-actions.ts` | **Generalise this; do not rebuild** |
| InvitationSurface | `invitation-panel.tsx`, `/world-invite/[token]` | Generalise for confirmations |
| ApprovalSurface, PendingAction, OutcomeSurface | `lib/causal/*` engine only | Build surfaces |
| CommunitySpace | `/communities`, `/community/[id]` | Fold under Space |
| WorkingEditorHost | `/world/[worldId]/workbench` | Keep |
| AppearanceProvider | `lib/product/appearance.ts` | Keep |
| ConnectionStatus | `lib/product/optional-integrations.ts`, `/apps` | Keep |
| PublicProjection | staging `public_space_projection` | Verify, then reuse |
| RecoveryEntry | — | Build after the recovery decision is implemented |
| CompositionEditor | — | Deferred by decision |

Known duplication to collapse: **two navigations on `/`**; **three thing-list
renderers**; **two creation entry points**; **27 inline history reads**.

---

## E. Integration and gap report

**Already working.** One global shell; guest identity and anonymous sign-in;
guest draft survival including blocked storage; login with OTP fallback; World
rooms; World-scoped grant/revoke; invitations end to end; appearance; optional
integrations; OAuth consent.

**Exists, needs consolidation.** Home chrome duplication; Projects vs Space vs
reality grid; two creation entries; Communities as a primary tab; `/control` as
prose rather than data; inline history reads.

**Implemented but unactivated or unverified.** `define_type`, `put_object`,
`export_mine`, `request_confirmation`, `read_confirmation_request`,
`answer_confirmation`, `cancel_confirmation`, `read_confirmations` — all applied
to staging 2026-11-09, all with zero call sites. The action lifecycle
(`propose`/`approve`/`enact`) and `lib/causal`. `update_document_version`.
`public_world`. The behaviour of the two 2026-11-09 migrations is exercised only
on the embedded Postgres 18, not the store's 17.

**Missing and requiring engineering.** `ThingInspector` with the six parts and
type-driven fields; universal find; the attention surface; evidence storage **and
there is no Supabase bucket at all**; provenance line; history timeline;
confirmation request/answer surfaces; the action-lifecycle surfaces; identity
recovery; chain anchor; contest; public-read-for-strangers.

**Requires founder authorization.** Applying either 2026-11-09 migration to
**production** (`dupgybzkkbddsbaykrae`) — staging only so far, and the runbook
requires an explicit go. Creating a storage bucket. Un-hiding `/card`, `/money`,
`/packs`, `/trading`, `/studio`. Minting the Vercel `SUPABASE_SECRET_KEY` — it
currently exists **only** on the retired branch `claude/keen-cerf-tpd7io`, so
production has none, which is why World reads over MCP fail.

**Drift that blocks safe production work.** Staging carries three migrations with
no file in `supabase/migrations/`: `public_space_projection` (20261107005431),
`sov_public_identity` (20261108074034), `sov_card_permanent_account_publishing`
(20261108074837). It also records `seamless_guest_identity` as 20261102043609
while the repo file is 20261102043153. The repository therefore cannot currently
rebuild staging, and a future `supabase db push` works from an incomplete
picture. Reconcile before production.

---

## F. Proposed slice order

Each slice lands on `main`, green, before the next begins.

**Slice 1 — one shell, five destinations.** Retarget `homes`; strip the duplicate
header and bottom nav from `RealityEntry`; give `/workbench` a real Bench home
instead of a redirect; move Projects and Communities out of primary navigation
while keeping their routes; extend `lib/product/routes.ts` aliases. *Schematic:*
shell supplies brand, identity, five destinations, search slot (inert until H03,
so omitted rather than faked); Home's main column keeps the intent form, then
unresolved work, then recent things, then appearance. *Risk:* the browser suite
asserts both navigations today and will need updating with the change.

**Slice 2 — the first line becomes a thing.** The intent form writes to the kernel
under the guest identity that already exists, instead of only `localStorage`.
*Why first among the mechanisms:* it is the only change that makes types, export,
confirmation and authority reachable by a person who has not signed in — every
unactivated mechanism above depends on a thing existing. *Schematic:* unchanged
UI; on submit, record the thing, show it, keep the device draft as the offline
fallback and keep the honest blocked-storage message.

**Slice 3 — `ThingInspector`, the guaranteed six-part view.** Type-driven fields
from `type_fields`; provenance line; history timeline; access block reusing
`access-panel`. Proof of universality: a tree removal and an application
rendered by the same component from their own type definitions, as the directive
requires.

**Slice 4 — confirmation surfaces (G07, G08).** Ask on a thing; answer by link in
`minimal` mode. Completes the first loop no notes app can do, and is the brother
test.

**Then, in order and not before:** attention surface (H06), evidence storage and
`EvidenceViewer` (needs a bucket), action-lifecycle surfaces, universal find,
identity recovery, chain anchor, contest.

---

## G. Validation

The acceptance test, which the founder approved over a visual target: *can a
person enter, recognise what is theirs, do something meaningful, understand the
consequence, and remain in control — with no explanation?*

Mechanically, after slices 1–4, one path must run in one shell with no second
application: Home → type one real thing → it is recorded as theirs → open it and
see all six parts → ask someone to confirm it → they answer from a link → the
answer appears as evidence authored by them with its provenance → the owner
revokes that access from the same surface → ID shows what is public and what is
not → Control shows the authority that permitted it → Bench opens the thing for
editing → back to Home.

To be verified by `scripts/test-product.mjs` at 390px and 1440px with keyboard
and reduced motion, plus kernel tests for every authority boundary the path
crosses. No step may be claimed before the corresponding workflow run is green.
