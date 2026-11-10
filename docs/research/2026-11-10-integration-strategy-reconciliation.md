# "Integrate what's already excellent" reconciled against what exists

A strategy document the founder shared on 2026-11-10 (it reads as a ChatGPT synthesis). The thesis: SOLVE is a personal control plane. It integrates the best existing tools, makes them work together around the person, and keeps every native vertical useful on its own.

## Already true, and the strongest part of it

The five things it says must never be outsourced already exist, or are planned, in the kernel:

| It says to own | Where it stands |
|---|---|
| Identity and experience | SOV ID, the card and its versioned look, and the environment derived from the card (rebuilt from zero, `solve/from-zero`) |
| The authority system | Grants, scopes, agents through `spawn_agent`, and revocation. The one known gap is that `resolve_caller` ignores `client_id` (Connect Increment 1) |
| The universal capability contract | Planned as the Connect manifest (`docs/plans/2026-11-10-solve-connect.md`, Increment 2). Not built |
| Personal context and relationship model | Entities, relations, types (`define_type`) and scopes |
| Action-and-evidence engine | Claim, proof and confirmation are distinct and enforced, and counterparty confirmation is verified on staging. External actions still need the same three states: requested, attempted, verified *by the provider*. That belongs in Connect |

Its central rule — the provider that holds a record is its source of truth, and SOLVE holds a reference to it — matches the existing canon "truth outward", where SOLVE never upgrades a claim by presenting it.

## Where it is out of date

It describes the repository as of before today. Since then:

- the experience was rebuilt from zero on the kernel;
- Control has a real export;
- **build something and invite your friends** works on staging, with an invite preview that doesn't consume the link, single-use links, and per-person attribution.

The last of these is People/Groves in miniature, and it already runs.

## Where to push back

1. **Breadth.** The tables name about 30 verticals and about 60 providers. The document calls this sequencing rather than parallel work, but without a gate it becomes the 39-branch problem again. Rule: one mechanism lands on `main` and gets used before the next one starts.
2. **Fun is missing.** The founder's point that tools must be culturally appealing and built for entertainment, not just for builders, appears only as "desirable". Its first priority (Studio + ID + MySpace) is right *because* it is the fun one. Keep making together and inviting friends at the centre of that slice, not beside it.
3. **Provider reality, per capability:**
   - **Google Drive:** use the `drive.file` scope with the Google Picker. The person explicitly chooses files, and the scope is non-sensitive, so no security assessment is needed. Broad Drive or Gmail read scopes are restricted and trigger one.
   - **Google Calendar:** event scopes are sensitive, so OAuth verification is needed before public use but no assessment.
   - **Canva Connect, Adobe Firefly Services and Figma's REST API:** each needs its own developer or partner approval and may carry per-call cost. Figma's REST API cannot edit design nodes; only plugins can.
   - These belong in each adapter's manifest. They should never be inferred from a logo.
4. **Files come first, but they are blocked.** Sequence step 1, secure files and the Vault, needs a storage bucket. Under the two-brothers plan the bucket is the brother's slice; no bucket exists yet.
5. **"Prompt-to-visual" needs a provider decision and a budget** before it can be honest: which model, who pays, and what happens when the provider is down. Canon requires honest unavailability, not fake success.

## Sequence, reconciled

| # | Slice | Proof | Status |
|---|---|---|---|
| 0 | Build together and invite friends | Three independent people on staging | **Done (staging)** |
| 1 | Vault: private files on the kernel's authority | Upload, reopen on a second device, share, revoke, delete | Blocked on the bucket |
| 2 | Connect Increment 1: connections plus `client_id` narrowing | An external app reads/writes only what was granted; disconnect stops it | Planned, ready |
| 3 | Studio: one real visual provider behind the card and MySpace | Generate → choose → applied to the real card; provider off → honest message | Needs a provider decision |
| 4 | Google Drive (`drive.file`) and Calendar adapters on the Connect contract | A chosen file or event linked; the provider stays the source of truth | After 2 |
| 5 | AI orchestration: request → approval → provider action → verified outcome | The kernel records all three states | After 2 and 4 |
| 6 | Myco pilot | A community activity yields a confirmed, attributable contribution | After 1 and the brother's map |

Every native feature must keep working with its integration disconnected. This document adds that as a check in each slice's acceptance scenario.
