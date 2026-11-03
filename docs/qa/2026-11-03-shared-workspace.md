# Shared workspace QA — 2026-11-03

## What this checkpoint proves

- A user cannot create a project or save/revise shared work without a verified external assistant or a personal model connection.
- A deployment OpenRouter, Anthropic or AI Gateway credential cannot silently activate product intelligence.
- Personal provider credentials are encrypted, kernel-sealed, actor-isolated, replaceable and destructively revocable.
- An owner and collaborator require separate connections; write authority and connection state are both enforced server-side.
- Documents retain versions, conflicts preserve the local draft, and stale AI revisions are refused before inference.
- Provider failure or concurrent human work never produces a false saved revision.
- Existing work remains readable and exportable after a provider disconnect.
- Generated HTML is shown only through the existing scriptless, subresource-blocking preview.

## Automated evidence

- `npm test`: 543 tests discovered; 542 passed, 1 intentionally skipped, 0 failed.
- `tests/e2e/providers.test.ts`: 4/4 passed with its temporary localhost server permitted.
- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 9 pre-existing `img`/unused warnings.
- `npm run build`: passed; 47/47 static pages generated.
- `git diff --check`: passed.

## Not yet claimed

- A real magic-link email was not received in this run.
- No personal OpenRouter key was supplied, stored or used for inference.
- No external assistant OAuth grant was created in this run.
- The owner/brother journey has not yet been exercised with two real accounts in a deployed preview.
- No production deployment, database migration or paid model activation occurred.
