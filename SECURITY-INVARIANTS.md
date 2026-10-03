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
| Declared consequences need write authority at proposal, land atomically with completion, once, never on failure, and roll the completion back if they cannot land | `tests/kernel/actions.test.ts` declared consequences |
| The loop: context and Horizon from the actor's own authority; refusals recorded with no consequence; evidence settles before consequence; repeats, reloads, a crash between evidence and settlement, and concurrent runs yield one consequence; steps keep causal order | `tests/e2e/loop.test.ts` |
| Providers are replaceable without changing routes or rewriting history; planning and re-ranking write nothing | `tests/e2e/loop.test.ts` |
| Perception, planning and rendering never write; the browser's kernel survives reload with identical canonical state | `tests/e2e/loop.test.ts`, `npm run test:world` |
| Guards: a failing precondition is not an action; a lapsed guard fails enactment; an effect landed under a lapsed guard needs reconciliation and yields no consequence | `tests/kernel/actions.test.ts` guards, `tests/e2e/loop.test.ts` |
| A step's consequences are fixed from the World at proposal; a World-extended transition plans and executes through the unchanged core; verification changes a claim's status only by a service's evidence | `tests/e2e/loop.test.ts` |
| Money under the loop: lease budgets refuse amounts beyond them; a lost reply yields no consequence until reconciled; the recipient is paid exactly once across unknown outcomes and repeats; a browser without a chain reports the missing provider | `tests/e2e/loop.test.ts`, `npm run test:world` |
| A step whose answer has not arrived yields no consequence; one action asks one question however many runs; the answer's provenance is the counterparty's own action; a verification settles only on the verifier's own evidence | `tests/e2e/providers.test.ts` |
| The other side runs the same loop: an inquiry is a fact only of the World of the actor it was delivered to; the answer is a kernel action under the answerer's own authority, bound to the inquiry, once per inquiry however many passes; an organization that was not asked has nothing to answer | `tests/e2e/exchange.test.ts` |
| HTTP counterparties are reached only at the endpoint the organization's record publishes (never one in a payload), only over TLS or loopback, with the action id as the idempotency key; the answer as received is the hashed evidence; a refusal fails the step with nothing canonical | `tests/e2e/providers.test.ts` |
| An organization's agent sees only what its owner delegated, runs its goal alone with provenance naming agent and principal, and cannot spawn, commit or grant beyond that | `tests/e2e/organization.test.ts` |
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
