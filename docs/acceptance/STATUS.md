# SOLVE — what actually works

Every capability, and how it was verified. A capability is complete only when its human action has
been executed, its result read back independently, its authority verified, and its failure modes
tested.

**Last full run:** see the newest `npm run test:acceptance` entry in `BUILD-STREAM.md` (all seven
scenarios — home, confirm, card, control, together, page, space — against **solve-staging**, on a side
branch; **not on `main`, not in production**).

**No capability is verified by a real person yet.** Automated runs prove behaviour and authority;
they can't show whether someone enjoys it. The first real test: `docs/acceptance/2026-11-10-first-real-experience.md`.

| Status | Means |
|---|---|
| **Verified automatically** | Done in a real browser against staging, read back through the kernel as that person, authority and failures tested |
| **Kernel-tested** | Proven against the real migrations, attacks included; no screen exercises it yet |
| **Unbuilt** | Nothing exists |

All acceptance identities are automated fixtures, labelled `[automated <run>]` in the kernel.

## Home — the doorway

| Capability | Status | Evidence |
|---|---|---|
| A visitor gets an identity with no sign-up; if the server can't, the browser makes one | **Verified automatically** | Session read back as a kernel actor; no sign-in screen is ever required to start |
| Start something and land in it | **Verified automatically** | The kernel holds exactly the person's words under their scope; its history is theirs |
| Unsent words survive a refresh and a lost connection | **Verified automatically** | Draft held on the device; the network drop is reported and the words stay |
| Three recent things to reopen | **Verified automatically** | Listed after a reload; a different browser doesn't see a guest's things |

## ID — the card

| Capability | Status | Evidence |
|---|---|---|
| Name the card, choose its look, undo, return to Base | **Verified automatically** | Saved as a versioned record and read back; contrast measured in the rendered browser |
| The look shapes the person's whole environment | **Verified automatically** | Every look keeps text ≥ 4.5:1 and the accent ≥ 3:1 |
| Identity recovery | **Unbuilt** | Decided (scoped); nothing built |

## Space — MySpace

| Capability | Status | Evidence |
|---|---|---|
| Share your Space: your card and your shared pages at one link | **Verified automatically** | A stranger with no account and no cookies opens it in the owner's colours, taps into a page and back, and gets no identity |
| A thing's public page, showing only what was ticked | **Verified automatically** | A friend's contribution is never offered or shown; links in words are tappable |
| Stop sharing | **Verified automatically, with a stated limit** | Offline at once; a photo link already issued lasts up to 10 minutes and saved copies can't be recalled, and the owner is told so |

## Bench — your things

| Capability | Status | Evidence |
|---|---|---|
| The one list of everything a person has made or joined | **Verified automatically** | The thing appears and opens; no word or id of ours |
| The six-part record of a thing | **Verified automatically** | All six parts, in order, with real names and no internal ids |
| Build with a friend from one link | **Verified automatically** | No sign-up to join; a link preview doesn't use the invite; a used link turns anyone else away; only the starter invites |
| Photos in a shared thing | **Verified automatically** | GPS removed; the stored bytes match what the kernel recorded; outsiders can't read, list or upload; a recorded photo can't be replaced |
| Ask someone to confirm; they answer from a link with no account | **Verified automatically** | Authored by the person asked; the owner can't confirm their own; a dispute sits beside the claim |
| Ways to make it, including a handoff to another tool | **Verified automatically** | Recommended from the person's needs alone; the handoff carries exactly the brief they edited |
| Remove someone from a thing | **Kernel-tested** | Their access, photos included, ends; no control on screen yet |
| Delete a photo so its bytes are gone; files other than photos | **Unbuilt** | |

## Control

| Capability | Status | Evidence |
|---|---|---|
| What you can reach, in plain words | **Verified automatically** | |
| Take everything with you (export) | **Verified automatically** | The download is read back |
| Connected apps: see them, disconnect them | **Kernel-tested; partly verified live** | A revoked app session is refused at once; the Disconnect button itself hasn't been pressed by the harness |

## My AI and connected apps

| Capability | Status | Evidence |
|---|---|---|
| Connect an AI app (Claude, ChatGPT…) to your SOLVE | **Partly verified** | The approval screen renders to standard; the full sign-in can't be automated and has not been done since it was rebuilt |
| A connected app reads, remembers when allowed, and adds only where you let your AI in | **Kernel-tested; verified live on staging** | Its direct write was refused and nothing was created |
| A connected app sees only what you choose, thing by thing | **Kernel-tested** | Built in the kernel; the connector hasn't moved onto it yet, so old-style connections can still read what you can |
| An AI inside the app itself | **Unbuilt** | |

## What needs the founder

1. **The real two-person test** (above). No automated run stands in for it.
2. **Production:** nothing from this work is in production; every database change needs your approval.
3. **Staging's anonymous sign-in limit** still interrupts automated runs from one machine.
4. **Rotate** the production secret key pasted in chat on 2026-11-09.
