# SOLVE — what actually works

Every capability, and how it was verified. A capability is complete only when its human action has
been executed, its result read back independently, its authority verified, and its failure modes
tested.

**Last full run:** `acc-202611101243-pzpy` — six scenarios (home, card, control, together, page,
space), **197/197**, against **solve-staging**, on branch `solve/shell-truth`. Connector scenario
(`apps`) against this branch's deployed preview: `acc-202611101250-tuwj`, **20/28** — every failure
traces to one missing setting (below). **Not on `main`, not in production.**

**No capability is verified by a real person yet.** Automated runs prove behaviour and authority;
they can't show whether someone enjoys it. The first real test: `docs/acceptance/2026-11-10-first-real-experience.md`.

| Status | Means |
|---|---|
| **Verified automatically** | Done in a real browser against staging, read back through the kernel as that person, authority and failures tested |
| **Kernel-tested** | Proven against the real migrations, attacks included; no screen exercises it yet |
| **UI only** | The screen exists and is honest about its limits; nothing deeper is claimed |
| **Unbuilt** | Nothing exists |

All acceptance identities are automated fixtures, labelled `[automated <run>]` in the kernel.

## The shell

| Capability | Status | Evidence |
|---|---|---|
| The approved shell: Space · People · Apps · Control; Search, Add, AI, visibility, Your ID | **Verified automatically** (no database) | `test:product` at 320/390/1440 and keyboard; `test:compare` against the reference image (mean difference 7.2/255) |
| Start as a guest with no sign-up | **Verified automatically** | Session read back as a kernel actor |

## Space

| Capability | Status | Evidence |
|---|---|---|
| Make a Space from your words and land in it | **Verified automatically** | The kernel holds exactly the words under the person's scope; its history is theirs |
| Unsent words survive a refresh and a lost connection | **Verified automatically** | Draft held on the device; the network drop is reported and the words stay |
| The Space switcher lists every Space you made or joined | **Verified automatically** | A different browser doesn't see a guest's Spaces |
| Add words and photos to a Space | **Verified automatically** | GPS removed; stored bytes match the kernel's record; outsiders can't read, list or upload |
| A Space shows who can see it (Private, Shared, Public) | **Verified automatically** | Private when made; Shared once a friend joins |
| The full record of a Space | **Verified automatically** | Six parts, in order, with real names and no internal ids |
| Search | **Verified automatically**, names and descriptions only | Finds by words; says so when nothing matches; a stranger finds nothing |
| Edit Space (layout, components) | **Unbuilt** | Only colours change today (Your ID) |
| Versions and restore of a Space | **Unbuilt** | History is recorded; there is no restore control |

## People

| Capability | Status | Evidence |
|---|---|---|
| Invite a friend by link; they join with no sign-up | **Verified automatically** | A link preview doesn't use the invite; a used link turns anyone else away; only the starter invites |
| People lists everyone you share a Space with | **Verified automatically** | Each side sees the other, with the Space they share |
| Remove someone from a Space | **Kernel-tested** | Their access, photos included, ends; no control on screen yet |
| Person profile, Connect, Message | **Unbuilt** | |

## Apps and your AI

| Capability | Status | Evidence |
|---|---|---|
| Connect an outside AI app (OAuth 2.1, PKCE, consent) | **Verified against the deployed preview** | Registers, is sent to consent, a wrong verifier gets nothing, the code becomes a token, no token gets 401 |
| Let your AI into one Space: Off, Read or Add, from the Space | **Verified against the deployed preview** | Off by default; the choice is written as kernel grants; switched off, the app is refused at once (on permission) |
| It reads and adds drafts where you let it in | **Blocked** | The preview now has a staging service key, but staging rejects it ("Invalid API key"): the value must be re-entered |
| A connected app creates a Space | **Removed** | Its token can change nothing (connector containment), so `start_world` could never work; the person starts the Space and lets their AI in |
| Disconnect it in Apps; it stops at once | **Verified against the deployed preview** | The token is refused immediately; refresh fails |
| Discover apps; app detail | **Unbuilt** | Apps says there is no catalogue yet |
| An AI inside Solve | **Not planned** | Solve runs no model of its own (DECISIONS.md, 2026-11-10) |

## Control and Your ID

| Capability | Status | Evidence |
|---|---|---|
| Your ID card, your name, your colours; undo; Return to Base | **Verified automatically** | Saved as a versioned record and read back; contrast measured as rendered; nobody else can read or forge it |
| What you can reach, in plain words | **Verified automatically** | |
| Take everything with you (export) | **Verified automatically** | The download is read back |
| Identity recovery; claiming a guest's work on a second device | **Unbuilt** | Decided (scoped); nothing built |
| A guest keeps their work when they sign in (new email) | **Built, never walked by a person** | Deployed 2026-11-11 and unit-tested including the attack case; no human has signed in as a guest with an unused address, so the live path is unproven. Founder chose to skip the walkthrough |
| A guest signing in with an email that already has an account | **Refused, by design** | `updateUser` cannot attach a taken address. The person is told the cost and pointed at sharing instead; ownership never moves. The founder's own identity is split this way |
| Moving a guest's Spaces and grants into an existing account | **Unbuilt** | Re-scoping across actors in an append-only kernel; touches identity and authority, so it needs its own slice and attack tests |

## Share and publish

| Capability | Status | Evidence |
|---|---|---|
| Publish chosen pieces as a page; a stranger opens it with no account | **Verified automatically** | A friend's contribution is never offered or shown |
| Share your Space at one link | **Verified automatically** | The stranger gets no identity; the kernel answers them nothing beyond what was shared |
| Stop sharing | **Verified automatically, with a stated limit** | Offline at once; a photo link already issued lasts up to 10 minutes and saved copies can't be recalled, and the owner is told so |

## What needs the founder

1. **Guest continuity is unproven live.** One deliberate run settles it: a fresh browser, type something so a guest owns work, then sign in with an address that has no account. Skipped on 2026-11-11 by the founder's choice; until someone walks it, it is built, not verified.
2. **Staging service key for previews.** It exists only for the retired `claude/keen-cerf-tpd7io` branch. Add `SUPABASE_STAGING_SECRET_KEY` (the staging project's secret key) for Preview in Vercel; then rerun `node scripts/acceptance/run.mjs --base=<preview> apps`.
3. **Staging Auth Site URL** sends people approving an app to that retired preview. Point it at this branch's preview (or a stable alias) in Supabase → Authentication → URL Configuration.
4. **The real two-person test** (above). No automated run stands in for it.
5. **Production:** nothing from this work is in production; every database change needs your approval.
6. **Rotate** the production secret key pasted in chat on 2026-11-09.
