# Approved Home interaction verification — 2026-11-04

Local production build: http://localhost:3103/sov-preview
Browser: in-app Chromium. Reference-size viewport 1672×546, ordinary desktop 1440×900, mobile 390×844.

| Check | Result | Evidence |
|---|---|---|
| Preview without applying | PASS | Creative preview changed presentation; Cancel returned to SOV Light. |
| Keyboard activation | PASS | Enter activated a theme and Apply in mobile native dialog. |
| Apply and refresh | PASS | SOV Dark + Studio restored after reload. |
| Undo | PASS | Returned to SOV Light + Simple. |
| Reset twice, refresh, Undo | PASS | Restored Creative + Canvas, preserving prior history. |
| Four themes × four layouts | PASS | All 16 combinations retained three Continue items; no horizontal overflow. See home-interaction-combinations.json. |
| Mobile dialog Escape + focus | PASS | Escape dismissed customization, focus returned to Make it yours. |
| AI panel accepts text | PASS | Entered intention; no model connected notice; kept as a local creation without AI response. |
| Editable creation refresh | PASS | New 'A quiet weekend' retained edited body after refresh. |
| Four primary spaces | PASS | Local My Space, Work, Create views and honest Family sharing-unavailable state. |
| External services | PASS | All three Unavailable buttons disabled. |
| Viewport fit | PASS | Reference viewport page width/height 1672×546; mobile no horizontal overflow. |
| Search / notifications / remaining navigation | PASS | Search found and opened persisted creation; notifications explicitly unavailable; Worlds, People and Control opened correct views. |
| Reduced motion | CSS support present | No ambient animation. OS media preference not emulated. |
| Cross-browser / assistive technology audit | NOT RUN | Chromium + keyboard verification only. |

The initial screenshot shows three editable local examples. Example labels intentionally replace invented timestamps and progress. This is not cloud identity, live AI or live collaboration.

Visual approval is pending the founder's screenshot review. No merge, push or deployment performed.
