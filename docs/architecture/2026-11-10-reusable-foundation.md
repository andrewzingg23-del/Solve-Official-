# The reusable foundation, traced through ten lives

An engineering analysis, not direction: only the founder changes the direction (`DECISIONS.md`).
Branch `solve/act-on-pieces`, from `solve/shell-truth`; inspected against staging (`taeikshnbcsjlgbattyp`)
and the 25 kernel migrations on 2026-11-10.

## 1. The finding in one paragraph

Every one of the ten experiences runs the same loop: **a person, in a Space, finds or brings in a
resource, a capability applies to it, the kernel decides whether they may, the act is appended as an
event, the result is read back, and one or more presentations show it.** Nothing about a family trip,
a company, an insurance file or a game differs at that level; only the *kinds* of resources and the
*providers* of specialist capabilities differ. The kernel already holds the hard parts (identity,
scopes, grants, versioned records, events, evidence, files, public projections, an action lifecycle
with policies). What is missing is mostly **thin product adapters**, not foundation — with one
security exception (§6).

## 2. The ten, traced

Intention → Resource & context → Capability → Permission → Action → Verified result → State → Presentation.

| # | Life | Intention | Resource & context | Capability | Permission (kernel) | Action | Verified result | Persistent state | Presentation |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Parent, family vacation | Plan the trip with the family | Space "Lisbon in June"; notes, photos, bookings (links) | add, revise, invite, share | owner `*`; family `editor` grants via invitation | add a plan, fix it when dates change | kernel version n+1, author recorded | entity versions + events | Space for family; nothing public |
| 2 | Two brothers, a company | Decide and record together | Space per company; plans, decisions, documents | add, revise, invite, confirm | both editors; only the starter invites | revise the plan; ask the other to confirm | revision + evidence | versions, evidence | Space; later public page |
| 3 | Insurance agent, client | Gather a client's facts safely | Space per client; documents, photos | bring in files, request info, share selectively | agent owner; client `viewer`/`editor` | client adds a document; agent revises notes | file stored, bytes hashed, access by `file_allowed` | storage objects + entity records | Space; never public |
| 4 | Creator, portfolio | Show work to the world | Space; photos, texts | publish chosen pieces, update | owner only publishes (actor-scope record) | tick pieces, publish, update a caption | `read_page` shows exactly the ticked, owner-authored latest versions | page record (versioned) | Space + public page — two presentations, one truth |
| 5 | Child, personalized Space | Make it look like mine | Space; drawings, words | appearance, arrangement | owner (guardian rules: unbuilt) | change colours, arrange pieces | look record version, contrast computed | look record; *presentation record (missing)* | Space restyled; Base restorable |
| 6 | Contractor, a job | Keep the job's truth current | Space per job; notes, site photos, client | revise status, add evidence, invite client | contractor editor; client viewer | update "materials ordered → delivered" | version n+1; client sees it, can't change it | versions + events + evidence | Space for crew and client |
| 7 | Community, an event | Organize many people | Space; agenda, tasks, people | invite many, add, revise, publish | members editor/viewer; organizer publishes | revise the agenda; publish details | public page updates once, everyone sees it | versions; page record | Space + public page |
| 8 | Developer, a tool | Build something that runs | Space; spec, links to repo/deploy | bring in links, connect a provider (GitHub, Vercel) | owner; provider OAuth | link the repo; revise the spec | link recorded "as their word" until a connected tool confirms | entity + (provider authority outside) | Space; provider owns its state |
| 9 | Own external AI | Have my AI help, inside limits | a Space the AI is let into | read, add drafts (agent grants) | owner issues grants to their AI's agent; app token contained | AI adds a draft; person edits/accepts it | draft authored by the agent; person's edit is theirs | versions + events (via recorded) | labelled as the AI's in the Space |
| 10 | Recovering on a new device | Get my life back | identity, all Spaces | recovery, sign-in, export | identity links | sign in; claim guest work | same actor, same Spaces | identity_links; export file | everything as it was |

## 3. What is identical across all ten

1. **Identity** — an actor resolved by `resolve_caller` from a token (person, guest, agent, app).
2. **A Space** — a scope (`world:<id>`) claimed by its owner; membership is grants.
3. **Resources** — kernel entities (versioned) and files (storage, `file_allowed`); kinds differ, the record doesn't.
4. **Relationships** — today grants/invitations; `relate`/`end_relation` exist and are unused by the product.
5. **Capabilities** — capability strings (`world.entity.write`, `kernel.read`, …) checked by `require_allowed`.
6. **Authority** — grants, cascading revocation, policies (`action_policies`), app containment.
7. **Actions** — every change is an appended event; `upsert_entity`/`update_document_version` (optimistic `expected_version`); a full propose → authorize → enact → settle lifecycle exists for consequential acts.
8. **Evidence** — `attach_evidence`, confirmations, bases (self-reported → verified).
9. **History** — `read_events`, versions, `export_mine`.
10. **Presentation** — separate records that *point at* resources: the look (actor scope), the public page selection, the public Space. Never copies.

The five human actions are behaviours over that foundation, not places:

| Action | Kernel path | Where in the shell |
|---|---|---|
| **Find** | `read_world`, grants, Search over permitted records | Search, Space switcher, People |
| **Bring in** | `upsert_entity`, `put_object` + `file_allowed`, links | Add, the box, inside a Space |
| **Create** | `claim_scope` + `upsert_entity` | the box ("Make it a Space") |
| **Share** | `create_world_invitation`, grants, page/space records, `read_page` | Add people, visibility, Share & publish |
| **Act** | `update_document_version`, actions lifecycle, connector tools | on the resource itself |

## 4. What we have, partly have, lack, and can compose

| Mechanism | Status | Notes |
|---|---|---|
| Guest identity, sign-in | **Have** | anonymous actor, upgrade by sign-in |
| Recovery / second-device claim | **Missing** | decided, unbuilt (life 10) |
| Space create, list, switch | **Have** | `lib/world/creative.ts` |
| Add text, photos | **Have** | photos: GPS stripped, hashed, `file_allowed` |
| Links as resources | **Partly** | records exist (`documentType: link`); no Add path since Ways was removed |
| Other files (PDF, documents) | **Missing** | storage + `file_allowed` reusable; needs a type check per kind |
| **Revise a piece** | **Partly → this slice** | `updateCreativeArtifact` + `update_document_version` exist; no UI |
| Typed records (fields) | **Partly** | `define_type` + record view; no way to set fields in the UI |
| Invite, roles, remove | **Have / kernel-only** | removal has no control |
| Public page / Space, withdraw | **Have** | owner-authored latest versions only |
| Appearance (person) | **Have** | look record, contrast computed, undo, Base |
| Arrangement per Space | **Missing** | see §5 |
| Outside AI: connect, let in, add, disconnect | **Have, with a gap** | see §6 |
| Consequential actions (approve, settle) | **Kernel-only** | lifecycle + policies, no product use |
| Provider capabilities (calendar, GitHub, payments) | **Missing** | adapters over the same contract (§7) |

## 5. Edit Space: are positioned artifacts and versions enough?

**No — a separate, versioned presentation record is needed.** Measured against the kernel:

* `canvas {x, y}` lives *inside each artifact's version*. Moving a piece would write a new version of
  the resource: its history would fill with "moved" acts, and — because `read_page` publishes a piece
  only when its **latest version is the owner's** — a friend nudging the owner's photo would silently
  pull it off the public page. Presentation would be changing the truth and its authority.
* One position per piece allows exactly one presentation; the shell needs several (the Space, the
  public page, a phone view, the person's own design) over the same resources.
* The pattern already exists twice: the **look** and the **public page** are small versioned records
  that reference resources by id and are restricted to named choices. A **Space presentation record**
  (`sov = solve.presentation`, in the Space's scope, `{ layout, order[], cover, emphasis }`, named choices
  only, written with `world.entity.write`, previous version kept for undo, "Restore Base" = write the
  empty record) reuses `upsert_entity` and needs **no kernel change**. Positions in artifacts can stay
  as legacy data and be ignored.

## 6. The outside-AI permission model, verified independently

Probe: `scripts/acceptance/probes/app-token-reach.mjs`, on staging, 2026-11-10.

* An app connected **Read only**, never let into a Space ("Your AI here: Off"), **read that Space
  directly** through `kernel_api.read_world` with its own OAuth token — the private title came back.
* Its direct **write was refused** ("this app can read but not change anything").
* The connector's own tools respect the per-Space grants; the app's token does not, because a
  contained app token still resolves to the person for reads (stated in `20261110080000`).
* No service credential reaches a browser or an agent: the connector uses the staging key server-side
  only, to act as the AI's **agent**, whose grants the kernel checks.

**Consequence:** "Off" is true of Solve's connector, not of the app's token. The UI must say so
(fixed in this slice), and the real fix is the pending security slice: resolve each app token to its
**own connection agent** (`20261110070000` already builds those agents), so reads are bounded by the
grants the person gave. That is a kernel change and needs the founder's approval for production.

## 7. The smallest capability contract

Different resources need context-appropriate actions without separate product architectures. The
smallest contract that does that, in product code over the kernel (the kernel stays the authority):

```ts
type Capability = {
  id: string;                         // "revise", "caption", "open-link", …
  label: string;                      // what the person sees
  appliesTo(resource): boolean;       // by kind: text, photo, link, typed record…
  requires: string;                   // the kernel capability it needs: "world.entity.write"
  provider: "solve" | string;         // "solve" today; "google-calendar", "github" later
};
actionsFor(resource, held: Set<string>): Capability[]   // what this person may do to this thing
```

The screen offers only what `actionsFor` returns; the server action re-checks nothing itself and lets
the kernel decide (`require_allowed`), returning the kernel's refusal honestly. The same list can be
handed to the connector so an outside AI sees the same actions — one contract, three surfaces (screen,
connector, later provider adapters). Consequential acts (pay, send, commit) use the existing
`propose_action` lifecycle rather than direct writes.

## 8. Traceability matrix (engineering)

| # | Reusable kernel function | Missing adapter | Exact UI interaction | Tests that prove it |
|---|---|---|---|---|
| 1 | `update_document_version`, invitations | **revise a piece** (this slice) | Space → piece → Edit → Save | acceptance `act`: vacation, editor revises, owner sees it; retry = one version |
| 2 | same + confirmations | revise; confirm (screen removed) | piece → Edit | `act` (shared); confirm: kernel-tested |
| 3 | `put_object`, `file_allowed` | non-photo files; viewer role invite | Add → file | storage attack tests (exist for photos) |
| 4 | `read_page`, page record | revise caption | piece → Edit; Share & publish | `act`: edit a published piece → public page shows new text; friend's edit drops it |
| 5 | look record; **presentation record** | Edit Space | Space → Edit Space | future `edit-space` scenario |
| 6 | `update_document_version`, viewer grant | revise; **viewer invite** (only editor invites exist) | piece → Edit (crew); client read-only | `act`: contractor; a non-member's revision refused |
| 7 | invitations, page record | revise; bulk invite | piece → Edit; Share | `act` + `page` |
| 8 | link entities | **Add → link**; provider OAuth | Add → Link | future |
| 9 | agent grants, `add_to_world` | per-app agent (security) | Your AI here; piece by AI → Edit | `apps` (preview); probe §6 |
| 10 | identity links, `export_mine` | recovery, claim | Your ID → Sign-in & recovery | future |

## 9. The slice chosen: revise a piece, through the capability contract

**Why this one.** "Act" is the only one of the five actions with no product path at all, and every
one of the ten lives needs it daily: dates change, a job's status moves, an AI's draft needs fixing.
It is vertically complete with no kernel change, and it exercises the whole loop at once —
capability contract → kernel permission → optimistic version (no lost updates) → idempotent retry →
history → **two presentations of one truth** (the Space and the public page) → the public boundary
(an edit by anyone but the owner withdraws that piece from the public page, by the kernel's existing
rule). Edit Space is next (§5), and builds on the same contract.

**Reuses:** `updateCreativeArtifact` / `update_document_version`, `loadCreativeWorld`, the Space page,
grants and invitations, `read_page`, the acceptance harness. **New code:** the contract
(`lib/product/capabilities.ts`), one server action, one inline editor, and an acceptance scenario.
