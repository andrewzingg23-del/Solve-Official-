# App usefulness implementation plan

Spec: ../specs/2026-11-02-app-usefulness-design.md
Goal: complete every audited improvement and an honest development handoff workflow.
Architecture: extend existing server actions, World entities and source-backed GitHub views. Split independent surfaces across workers; integrate and verify together.

Global constraints: preserve RLS, no-login guests, canonical kernel API, founder content, approval boundaries and existing visual language. Do not edit applied migrations. Do not grant new third-party permissions automatically.

Review focus: Markdown XSS; incomplete/empty AI results; retry duplication; stale account writes; forged build/deploy claims.

- [ ] 1 AI: reproduce formatting/truncation issues; fix prompt/context/output handling and safe rendering; focused tests.
- [ ] 2 Projects: returning work and next-action summaries; persistent editable starter plans; unified project navigation and activity; focused tests.
- [ ] 3 Profile/AI/community: simplify identity, canonical portrait, work-first AI, save status, connections/knowledge, reversible directory visibility; focused tests.
- [ ] 4 Development: persist proposals and explicit review/approval, concrete copyable handoff, actual GitHub evidence and configured-worker boundary; authority/idempotency tests.
- [ ] 5 Integrate all branches, verify full tests/typecheck/lint/build, independent review and browser desktop/phone tests; fix findings.
- [ ] 6 Commit, release, verify live workflows, safely unlist only the known verification fixture through its owner UI if accessible, document remaining external binding limitations.
