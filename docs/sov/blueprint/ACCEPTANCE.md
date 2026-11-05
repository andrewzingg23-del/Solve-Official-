# Staging verification and final personal acceptance

Founder instruction: use dedicated staging identities throughout engineering. Personal account claiming and second-device recovery belong only at the final pre-public acceptance gate. They do not block earlier implementation. The founder's invitation address remains in the private conversation, not the repository.

Continue the Foundation Release 1 dependency order, reusing verified existing code:

| Gate | Required result and evidence | Current evidence / remaining work |
|---|---|---|
| 0 Audit | Canonical systems, deployed baseline, seven approved visual references | Recorded in CURRENT-STATE.md and VISUAL-REFERENCES.json; production unchanged; PR #51 unmerged |
| 1 Identity and Projects | Dedicated staging accounts: same-owner claim, save/reopen, recovery, stale-account refusal, cross-user isolation | Real guest create/save/reopen/export/isolation passed; permanent test-account claim and second-device recovery still require live verification |
| 2 Operational Agent | One actual provider, persistent Agent state, bounded inference, usage attribution | Persona configuration persists; real inference and metering remain unverified; inspect existing multi-model branch before adding code |
| 3 Reliable execution | Authorized capability → durable task → actual result → evidence; retries, failure and revocation | Existing task/worker branch is reusable work, not proof of live dispatch; reconcile staging queue history and establish scoped runtime authority |
| 4 Creation and publication | Editable saved artifact; separate public Profile; selected publication and revocation without private leakage | Text editing/versioning/export verified; public Profile and publication remain unfinished |
| 5 External integration | One real scoped connector, consent, execution, evidence and revocation | Saved URLs and configured providers never count as authorized/live integrations; verify runtime permissions separately from developer connector access |
| 6 Collaboration | Invitations, membership and shared Project access with two staging users | Existing kernel/Communities preserved; complete actual multi-user positive and negative journeys |
| 7 Hardening | Integration/security/resilience tests, responsive screenshots, backup/restore, monitoring and staging validation | Current slice tests/build/mobile checks passed; full release security and recovery evidence remains outstanding |

Every milestone includes desktop/mobile screenshots compared with the seven selected mockups, affected tests, source/deployment identifiers and honest limitations. Resolve failures as they appear; do not postpone engineering verification until founder acceptance. Keep production data intact. No production merge, migration or deployment is authorized by this plan update.

Only after all engineering gates pass and the product is functionally ready, invite the founder to claim the SOV ID using the privately supplied address. Demonstrate the complete journey: onboarding → private Home → distinct social Profile → persistent Agent → Projects → authorized integrations → permissions → saved work → second-device recovery → public/private isolation. Resolve failures and repeat affected checks.

Then provide a final readiness report with evidence, known limitations, rollback/operating procedures and outstanding risks. Obtain explicit founder launch approval. Successful personal acceptance does not itself authorize public launch.
