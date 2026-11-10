# SOLVE — Founding Documents and Brother Collaboration Handoff

**Captured:** 2026-11-08 founder discussion  
**Status:** Proposed documents for review, not automatically ratified changes to `VISION-CANON.md` or `DIRECTIVES.md`.  
**Branch:** `docs/solve-first-principles-20261108`

## Read in this order

1. [Founding Doctrine](./2026-11-08-SOLVE-FOUNDING-DOCTRINE.md) — the full reasoning: human reality, sovereignty, art, SOLVE, the programmable Card, AI, cooperation, crypto-native optionality, and the right to continue without the original company.
2. [Capability Atlas](./2026-11-08-SOLVE-CAPABILITY-ATLAS.md) — proposed capabilities in ordinary language, underlying mechanisms, and how each connects to the other domains.
3. [Existing Vision Canon](../../VISION-CANON.md), [Build Charter](../../BUILD-CHARTER.md), and [Directives](../../DIRECTIVES.md) — already authoritative boundaries that this new discussion must be reconciled against.
4. [Approved Experience Contract](../design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md) — exact visual plus operational acceptance requirements.
5. [Issue #67 — Development Control Room](https://github.com/andrewzingg23-del/Solve-Official-/issues/67) — coordination index and evidence, not a source of invented results.

## What these documents add

- **Art and individual expression are foundational:** a person should want their own Page even without AI, Project, or wallet.
- **The Card is a programmable, portable presentation of real resources and capabilities, not a generic data model.**
- **Sovereignty and SOLVE are complementary:** authority/portability vs useful action; both bounded by human reality.
- **Crypto-native ≠ mandatory token:** wallet/account separation, independent signatures, optional on-chain exchange, no keys held by AI.
- **The company should be replaceable:** make export, recovery, compatible hosting and gradual offline support deliberate long-term requirements.
- **Creation and social interaction converge on persistent resources:** shared context and access rules, rather than independent mock or chat-only versions.

## How two humans safely work in the same GitHub repository

A GitHub repository does **not** automatically synchronize to someone else's private account or computer merely because the founder pushed a branch.

1. The brother must have a specific GitHub username and appropriate **collaborator access** to `andrewzingg23-del/Solve-Official-` (or an intentionally approved fork arrangement).
2. The brother accepts any invitation and clones the canonical repository on his computer using his own account. No sharing private account passwords or access tokens.
3. Both people fetch `main` and review the same task record in issue #67 before starting work.
4. Each person creates their own short-lived feature branch from the agreed base. Do not both modify the same files concurrently without coordination.
5. They commit and push their branches, open PRs, and review each other's changes. Work becomes available to everyone with repo access immediately on push; it becomes part of `main` only after an approved merge.
6. GitHub PRs and issues are shared coordination; **the brother's local Mac requires a `git pull` / `git fetch`** or a GitHub client operation to receive changes. No unrequested remote desktop control is implied.

### Initial work ownership

- **Founder:** final approval of identity, art direction, doctrine and user acceptance.
- **Brother:** choose a concrete engineering/design test after inspecting `ACTIVE-WORK.md`, issue #67, and open PRs; own one non-overlapping path.
- **AI collaborators:** bounded tasks on their own branches with exact commits and evidence. A GitHub issue assignment is not proof an agent is running.

## Safe review request

Review the Founding Doctrine and Capability Atlas for:
- conceptual contradictions with existing canon or founder directives;
- decisions that are settled vs aspirational;
- surface-level visual inconsistency with approved targets;
- duplicate features already under active implementation;
- the smallest completed user journey that proves identity + expression + persistence + collaboration;
- security boundary violations, especially private/public separation and AI authority.

Make any approved changes through a separately tracked PR. This docs PR does not change app code, dependencies, database schemas, production, or financial systems.

## What is NOT synced by this PR

- It does **not** include an exported verbatim conversation transcript.
- It does **not** transfer all open PR changes onto `main`.
- It does **not** grant new GitHub access without the brother's actual GitHub account.
- It does **not** operate the brother's Mac or deploy staging/production.
- It does **not** establish that any target feature is already functional.

The docs are a durable shared *product specification and collaboration reference*, separate from evidence about code or deployments.
