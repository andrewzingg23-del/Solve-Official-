# SOLVE audit fixes and useful work loop

User authorization: after the November 2 live review and follow-up findings, the founder said “fix all of this.” The audit and concrete recommendations are the accepted requirements; continue implementation without repeating design approval.

Goal: let the founder build real projects, including SOLVE, through clear next steps and persistent, private work.

Approach: improve the existing application and kernel contracts in place. Retain the current visual language, no-login guest access, RLS and grants. A wholesale redesign would discard working flows; cosmetic-only fixes would leave the usefulness gap. These choices are implementation judgments under the founder's instruction.

Required outcomes:
- AI: safe readable Markdown, concise answers, source details behind disclosures, internal IDs omitted from prompt-facing content, explicit incomplete-answer handling. Preserve source provenance, leases, retries and authority checks.
- Projects: returning work first, truthful recent progress and next actions, first-plan actions and concrete starter workflows, editable saved next steps, meaningful activity rather than technical heartbeats.
- Navigation: coherent project shell for conversation/documents/people; consistent buttons and terms; simple invitation links with IDs under advanced controls.
- Identity/AI: clearly identify browser-bound guest access, truthful save/error feedback and recoverable drafts; one canonical AI appearance; useful AI work before customization; plain connection setup and capability tests without granting access implicitly; knowledge before optional integrations, reviewed import boundaries.
- Communities: reversible visibility controls to remove verification fixtures from discovery; owner/activity/benefit information without leaking member data. Do not remove real communities or data.
- Phone: one primary reading scroll, reachable composer, legible helpers, keyboard/focus access.
- Development: persist proposed changes, explicit human review/approval and handoff; show actual repository/CI/release evidence. Use existing kernel entities/events. Never claim code execution or deployment from an approval alone. If a configured external worker is absent, provide a complete handoff and report the missing binding rather than fabricate execution. No secrets in client code; no arbitrary outbound destinations.

Verification: focused authority/retry/XSS/guest/account tests, full suite, typecheck, lint, build, independent review and desktop/phone browser journeys. Commit and release passing coherent work under the prior deployment authorization. No changes to founder canon, applied migrations, financial gates or existing account access.
