# SECURITY-INVARIANTS

Canon as executable checks. Each line names the test that fails if the invariant breaks. Run `npm test` (Node) and `npm run test:browser` (same kernel tests in Chromium).

| Invariant | Test |
|---|---|
| API roles never touch kernel tables; anon calls nothing | `tests/kernel/kernel.test.ts` access; `tests/kernel/payments.test.ts` reads and history |
| History is append-only, hash-chained, tamper-evident | `tests/kernel/kernel.test.ts` access, tamper evidence; `actions.test.ts` world graph |
| End users act only as themselves; the service key is never a human or the kernel | `tests/kernel/kernel.test.ts` identity |
| A delegated grant never exceeds its issuer; revocation and expiry cascade | `tests/kernel/kernel.test.ts` authority |
| Authority decides, never humanness; an agent without a grant is denied, with one it enacts | `tests/kernel/actions.test.ts` principals |
| Agents create agents only when granted; accountability follows ownership | `tests/kernel/actions.test.ts` principals |
| Child lease ⊆ parent lease (amount, counterparty, task) | `tests/kernel/actions.test.ts` leases |
| A limited lease is invisible to capability-only checks; it works only for the request it names | `tests/kernel/actions.test.ts` leases |
| Authority limited to a task ends with the task | `tests/e2e/self-operation.test.ts` |
| An operational consequence happens only for an action authorized by a distinct party, and only once, even across a crash | `tests/e2e/self-operation.test.ts` |
| A verifier never takes the worker's word: a finding that contradicts the chain is never authorized | `tests/e2e/self-operation.test.ts` |
| A build proposal's change class is computed from what it touches; the creation guardrails are Class D | `tests/ops/changes.test.ts` |
| Agents promote only Class A changes, only after CI and a distinct reviewer, only the exact reviewed change; anything above Class A escalates | `tests/e2e/creation.test.ts` |
| Quorum needs distinct parties; collectives can count actors when policy says so | `tests/kernel/actions.test.ts` governance |
| Multisig accepts only named signers; governed writes cannot bypass actions | `tests/kernel/actions.test.ts` governance |
| Timelocks and challenge windows hold enactment; revocation stops a pending action | `tests/kernel/actions.test.ts` governance |
| No principal expands its own authority; denied attempts are recorded | `tests/kernel/actions.test.ts` governance |
| Native action kinds require their own capability | `tests/kernel/actions.test.ts` governance |
| An action completes once; external completion needs evidence | `tests/kernel/actions.test.ts` governance |
| Agent message loops stop at depth 20; messages carry sender kind and principal | `tests/kernel/actions.test.ts` messages |
| Private entities never leak to members without `world.private.read`, through entities, events, evidence or proposals | `tests/kernel/actions.test.ts` world graph, `tests/e2e/arcadia.test.ts` |
| Arcadia is reproducible; its snapshot and the browser reproduce the kernel's semantic digest | `tests/e2e/arcadia.test.ts`, `npm run test:world` |
| Renderers receive only authorized, canonically identified, really located things; effects come only from kernel events | `tests/e2e/world-slice.test.ts`, `npm run test:world` |
| A worker cannot verify its own work; completion needs declared evidence | `tests/kernel/actions.test.ts` tasks |
| Avatar representation changes never change identity or authority; creation is idempotent | `tests/kernel/actions.test.ts` avatars |
| One obligation settles once; settlement ids derive from the obligation | `tests/kernel/money.test.ts`, `tests/e2e/proof-of-life.test.ts` |
| Ledger balances per asset; the kernel cannot create money | `tests/kernel/kernel.test.ts` ledger, `tests/kernel/money.test.ts` |
| A payment pays only the published recipient, within slippage, once | `tests/kernel/payments.test.ts`, `tests/e2e/send-bob.test.ts` |
| Venues never sign blind | `tests/e2e/send-bob.test.ts` |
| Model output never receives keys or mutates the scene directly | enforced by architecture (`DOMAIN-CONTRACTS.md` §2–3); tests arrive with Horizon |
