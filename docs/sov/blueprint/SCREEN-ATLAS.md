# Screen atlas — current integration

| Atlas | Route / behavior | Current state and owner |
|---|---|---|
| S01 Personal Space | / | Canonical owned/authorized Project reads, true empty state, shared shell; app/page.tsx |
| S02 Shared activity | Contextual future Space view | Not implemented here; no invented activity |
| S03 Public visitor | Separate future Profile route | Not implemented; never derive from private Home data |
| S04 Discover | Contextual future view | No catalog availability invented |
| S05 Create | /projects/new | Existing account-scoped draft, createProject and kernel World ownership |
| S06 Connect | /bot?section=connections | Existing assistant/MCP configuration; not arbitrary provider OAuth |
| S07 Projects | /projects | Existing authorized World list; canonical Project links |
| S08 Workbench | /projects/[worldId] | Versioned text editor reuses World artifacts, account guard, optimistic concurrency and idempotency; interactive-page builder remains later |
| S09 Agent | /bot, persistent shortcut | Existing persona, memory and access configuration; no live execution claim |
| S10 Approvals | Existing kernel/task paths | New operational flow is not implemented here |
| S11 Machines | Future contextual view | Not a fifth destination; not implemented here |
| S12 People | Existing Project Room | Existing controlled access; no global People destination |
| S13 Communities | /communities | Existing membership functionality preserved in common shell; no simulated counts or feed |
| S14 Publish | Future separate publication flow | Not implemented; /saved receipts are not revocable page publication |
| S15 Control | /control | Real current identity state, account/Agent/access links, clear unavailable execution state |
| S16 Customize | Existing isolated /sov-preview | Preserved reference only; operational Home customization is not fabricated |

Common navigation: four destinations; account preferences are private Control, not a public Profile. Empty, denied and backend-error states never substitute invented records.
