// SOV improving SOV, the first creation loop, for Class A changes only:
//
//   build proposal (recorded with causal evidence)
//   → engineering task (inputs: the proposal, the paths it may touch)
//   → builder (agent, under a lease limited to that task) writes a change in an isolated workspace
//     and proposes its promotion; the promotion capability is chosen by the class of the change it
//     actually wrote, so a change that touches anything above Class A asks for a capability no
//     agent holds, and the kernel refuses it
//   → CI (a service) runs the change against a fresh Arcadia simulation and records what it saw
//   → reviewer (agent of a different party) re-derives the change, its class and the CI result, and
//     authorizes promotion
//   → promotion applies exactly the reviewed change to the target and records a receipt
//   → the promoted change runs against the live kernel; the observation is recorded and compared
//     with what the proposal expected; the reviewer closes the task
//
// This is not unrestricted self-modification: the classifier (changes.ts) is Class D, the builder
// cannot widen its lease, and anything above Class A stops at a human.
import type { Evidence, Kernel } from "../kernel/client";
import { sha256Hex } from "../money/settlement";
import { classifyChange, type ChangeClass } from "./changes";
import { OPS_SCOPE } from "./learning";
import { readTask } from "./reconcile";

export const ENGINEERING = {
  build: "engineering.build",
  review: "engineering.review",
  promote: (cls: ChangeClass) => `engineering.promote.${cls.toLowerCase()}`,
  kind: "change.promote",
} as const;

export type ChangeFile = { path: string; content: string };
export type ChangeSet = { files: ChangeFile[]; summary: string };

export type EngineeringInputs = {
  proposal_event_id: string;
  change_class: ChangeClass;
  allowed_paths: string[];
  signal: string;
  rail: string;
  expected: string;
};

// Where an isolated builder writes, and where promotion applies. Directories in tests; a branch and
// a pull request against the repository later. Same contract.
export interface Workspace {
  write(files: ChangeFile[]): Promise<void>;
  read(path: string): Promise<string | null>;
  // Runs a change's module (diagnostics export `diagnose(kernel, rail)`).
  load(path: string): Promise<{ diagnose(kernel: Kernel, rail: string): Promise<Record<string, unknown>> }>;
}

export type Observation = Record<string, unknown>;

export async function changeHash(files: ChangeFile[]) {
  const sorted = [...files].sort((a, b) => (a.path < b.path ? -1 : 1));
  return sha256Hex(sorted.map((f) => `${f.path}\n${f.content}`).join("\n\0\n"));
}

const artifact = async (description: string, facts: unknown): Promise<Evidence> => ({
  basis: "artifact",
  content_hash: `sha256:${await sha256Hex(JSON.stringify(facts))}`,
  description: description.slice(0, 500),
});

// What a diagnostic may not do: write anything, or reach outside the kernel it is handed.
const WRITES = /\.(record|create|issue|propose|enact|begin|settle|transition|upsert|relate|end|post|revoke|approve|challenge|cancel|claim|spawn|set|link|define|register|attach)[A-Z]?\w*\s*\(/;
const REACHES = /\bimport\b|\brequire\s*\(|\bfetch\s*\(|\bprocess\.|\bglobalThis\b|\beval\s*\(|\bFunction\s*\(/;

export function readOnlyProblems(content: string) {
  const problems: string[] = [];
  if (WRITES.test(content)) problems.push("it calls a kernel write");
  if (REACHES.test(content)) problems.push("it reaches outside the kernel it is given");
  return problems;
}

// The steward-side step: a recorded Class A proposal becomes an engineering task.
export async function openEngineeringTask(ops: Kernel, proposalEventId: string) {
  const proposal = (await ops.readEvents(OPS_SCOPE, { limit: 500 })).find((e) => e.id === proposalEventId && e.type === "ops.build_proposal.proposed");
  if (!proposal) throw new Error("no such build proposal");
  const p = proposal.payload as { change_class: ChangeClass; affected: { paths: string[] }; expected_outcome: string; problem: string };
  if (p.change_class !== "A") throw new Error(`Class ${p.change_class} proposals are not built autonomously`);
  const learning = (await ops.readEvents(OPS_SCOPE, { limit: 500 })).find((e) => e.id === (proposal.payload as { learning_event_id?: string }).learning_event_id);
  const inputs: EngineeringInputs = {
    proposal_event_id: proposalEventId,
    change_class: "A",
    allowed_paths: p.affected.paths,
    signal: String(learning?.payload.signal ?? "payment.lost_response"),
    rail: String(learning?.payload.rail ?? "system/chain:litesvm"),
    expected: p.expected_outcome,
  };
  const taskId = await ops.createTask({
    scope: OPS_SCOPE,
    title: `Build: ${p.problem}`.slice(0, 200),
    objective: p.expected_outcome,
    causeRef: `event:${proposalEventId}`,
    requiredCapability: ENGINEERING.build,
    risk: "low",
    reversible: true,
    // CI's system_observed evidence lives on its own record (only a service may attach it); the
    // reviewer requires that record before authorizing promotion.
    evidenceBases: ["artifact"],
    verification: "distinct_party",
    inputs,
    idempotencyKey: `build:${proposalEventId}`,
  });
  await ops.transitionTask({ taskId, status: "ready", detail: "opened from a Class A build proposal" });
  return taskId;
}

// The least-powerful builder that suffices: deterministic code generation for one shape of change,
// a read-only diagnostic for a recorded signal. It writes only into its isolated workspace.
export function diagnosticFor(inputs: EngineeringInputs): ChangeSet {
  const path = inputs.allowed_paths.find((p) => p.startsWith("scripts/diagnostics/")) ?? "scripts/diagnostics/diagnostic.ts";
  const content = `// Generated by SOV's builder from build proposal ${inputs.proposal_event_id}.
// Read-only: it reads kernel records through the client it is handed and writes nothing.
// Reports how often ${inputs.signal} needed reconciliation on a rail.
export const signal = ${JSON.stringify(inputs.signal)};

export async function diagnose(kernel, rail) {
  const tasks = await kernel.readTasks(rail);
  const matching = tasks.filter((t) => t.required_capability === "payment.reconcile" && /outcome unknown/.test(String((t.inputs || {}).signal || "")));
  return { rail, signal, reconciliations: matching.length, open: matching.filter((t) => t.status !== "completed").length };
}
`;
  return { files: [{ path, content }], summary: `Read-only diagnostic for ${inputs.signal} at ${path}` };
}

export type BuildStep = { taskId: string; actionId: string | null; decision: string | null; changeClass: ChangeClass; hash: string; waiting?: string };

// The builder agent: claims, writes the change into its workspace, and proposes promotion under
// the capability its actual change requires. A change above Class A cannot be promoted by an
// agent: the task escalates to a human with the reasons.
export async function runBuilder(builder: Kernel, input: { taskId: string; workspace: Workspace; build?: (inputs: EngineeringInputs) => ChangeSet }): Promise<BuildStep> {
  const { taskId } = input;
  let task = await readTask(builder, OPS_SCOPE, taskId);
  if (task.status === "ready") {
    await builder.transitionTask({ taskId, status: "claimed", detail: "claimed by the builder" });
    await builder.transitionTask({ taskId, status: "in_progress", detail: "writing the change in an isolated workspace" });
    task = await readTask(builder, OPS_SCOPE, taskId);
  }
  const inputs = task.inputs as EngineeringInputs;
  const change = (input.build ?? diagnosticFor)(inputs);
  await input.workspace.write(change.files);
  const hash = await changeHash(change.files);
  const paths = change.files.map((f) => f.path);
  const { cls, reasons } = classifyChange({ paths });
  const outside = paths.filter((p) => !inputs.allowed_paths.includes(p));

  const actionId = await builder.proposeAction({
    kind: ENGINEERING.kind,
    capability: ENGINEERING.promote(cls),
    scope: OPS_SCOPE,
    taskRef: `task:${taskId}`,
    payload: { change_hash: hash, paths, change_class: cls, class_reasons: reasons, summary: change.summary, outside_allowed: outside },
    idempotencyKey: `promote:${taskId}:${hash}`,
  });
  const action = await builder.readAction(actionId);
  if (action.decision === "DENY") {
    await builder.transitionTask({
      taskId,
      status: "escalated",
      detail: `the change is Class ${cls}; promoting it needs ${ENGINEERING.promote(cls)}, which no agent holds`,
      result: { change_hash: hash, paths, change_class: cls, class_reasons: reasons },
    });
    return { taskId, actionId, decision: action.decision, changeClass: cls, hash, waiting: "a human" };
  }
  return { taskId, actionId, decision: action.decision, changeClass: cls, hash, waiting: "CI and review" };
}

// CI: a service runs the change against a fresh Arcadia simulation and records what it observed.
// Only a service may claim system_observed evidence.
export async function runCi(ci: Kernel, input: { taskId: string; workspace: Workspace; simulate: () => Promise<Kernel> }) {
  const task = await readTask(ci, OPS_SCOPE, input.taskId);
  const inputs = task.inputs as EngineeringInputs;
  const action = (await ci.readActions(OPS_SCOPE, 500)).find((a) => a.kind === ENGINEERING.kind && a.task_ref === `task:${input.taskId}`);
  if (!action) throw new Error("nothing to test");
  const payload = action.payload as { change_hash: string; paths: string[] };
  const files: ChangeFile[] = [];
  for (const path of payload.paths) files.push({ path, content: (await input.workspace.read(path)) ?? "" });
  const hash = await changeHash(files);
  const problems: string[] = [];
  if (hash !== payload.change_hash) problems.push("the workspace differs from the proposed change");
  for (const f of files) problems.push(...readOnlyProblems(f.content).map((p) => `${f.path}: ${p}`));
  let observed: Observation | null = null;
  if (problems.length === 0) {
    const diagnostic = payload.paths.find((p) => p.startsWith("scripts/diagnostics/"));
    if (diagnostic) {
      const simulation = await input.simulate();
      observed = await (await input.workspace.load(diagnostic)).diagnose(simulation, inputs.rail);
      if (typeof observed.reconciliations !== "number" || observed.reconciliations < 1) problems.push("the diagnostic did not see the recorded friction in the simulation");
    }
  }
  const passed = problems.length === 0;
  const facts = { task: input.taskId, change_hash: hash, passed, observed, problems };
  const eventId = await ci.recordEvent({
    type: "ops.ci.completed",
    scope: OPS_SCOPE,
    payload: facts,
    evidence: [{ basis: "system_observed", content_hash: `sha256:${await sha256Hex(JSON.stringify(facts))}`, description: `CI on a fresh Arcadia simulation: ${passed ? "passed" : problems.join("; ")}` }],
  });
  return { eventId, passed, observed, problems };
}

export type Review = { approved: boolean; closed: boolean; reasons: string[] };

// The reviewer: a different party, trusting nothing it did not re-derive. Before promotion it checks
// the change against the proposal's allowed paths, its own classification, the read-only rule and
// a passing CI record for exactly this change; after, that the target holds exactly that change and
// that the observed consequence matches.
export async function runReviewer(reviewer: Kernel, input: { taskId: string; workspace: Workspace; target: Workspace }): Promise<Review> {
  const task = await readTask(reviewer, OPS_SCOPE, input.taskId);
  const inputs = task.inputs as EngineeringInputs;
  const action = (await reviewer.readActions(OPS_SCOPE, 500)).find((a) => a.kind === ENGINEERING.kind && a.task_ref === `task:${input.taskId}`);
  const reasons: string[] = [];
  if (!action) return { approved: false, closed: false, reasons: ["nothing proposed"] };
  const full = await reviewer.readAction(action.action_id);
  const payload = full.payload as { change_hash: string; paths: string[]; change_class: ChangeClass };
  const events = await reviewer.readEvents(OPS_SCOPE, { limit: 500 });

  if (full.status === "proposed") {
    if (full.proposer_id !== task.worker_id) reasons.push("the proposal does not come from the task's builder");
    const { cls } = classifyChange({ paths: payload.paths });
    if (cls !== "A" || full.capability !== ENGINEERING.promote("A")) reasons.push(`the change is Class ${cls}`);
    const outside = payload.paths.filter((p) => !inputs.allowed_paths.includes(p));
    if (outside.length) reasons.push(`outside the proposal's paths: ${outside.join(", ")}`);
    const files: ChangeFile[] = [];
    for (const path of payload.paths) files.push({ path, content: (await input.workspace.read(path)) ?? "" });
    if ((await changeHash(files)) !== payload.change_hash) reasons.push("the workspace differs from the proposed change");
    for (const f of files) reasons.push(...readOnlyProblems(f.content).map((p) => `${f.path}: ${p}`));
    const ci = events.filter((e) => e.type === "ops.ci.completed" && e.payload.task === input.taskId && e.payload.change_hash === payload.change_hash).at(-1);
    if (!ci) reasons.push("no CI record for this change");
    else if (!ci.payload.passed) reasons.push(`CI failed: ${(ci.payload.problems as string[]).join("; ")}`);
    if (reasons.length) return { approved: false, closed: false, reasons };
    await reviewer.approveAction(full.action_id);
    return { approved: true, closed: false, reasons };
  }

  if (task.status !== "verifying") return { approved: false, closed: false, reasons: [`the task is ${task.status}`] };
  if (full.status !== "completed") reasons.push(`promotion is ${full.status}`);
  const promoted: ChangeFile[] = [];
  for (const path of payload.paths) promoted.push({ path, content: (await input.target.read(path)) ?? "" });
  if ((await changeHash(promoted)) !== payload.change_hash) reasons.push("the target does not hold exactly the reviewed change");
  const observation = events.filter((e) => e.type === "ops.observation.recorded" && e.payload.task === input.taskId).at(-1);
  if (!observation) reasons.push("no observation of the promoted change");
  else if (!observation.payload.matches) reasons.push("the observed consequence does not match the expectation");
  if (reasons.length) return { approved: false, closed: false, reasons };
  await reviewer.transitionTask({
    taskId: input.taskId,
    status: "completed",
    detail: "reviewed, promoted and observed",
    result: { change_hash: payload.change_hash, observation: observation!.id },
    evidence: [await artifact("Review of the promoted change against its observation", { hash: payload.change_hash, observation: observation!.id })],
  });
  return { approved: false, closed: true, reasons };
}

// Promotion and observation, by the builder that proposed it: apply exactly the reviewed change,
// run it against the live kernel, record what it saw against the proposal's expectation.
export async function promoteAndObserve(builder: Kernel, input: { taskId: string; workspace: Workspace; target: Workspace; live: Kernel }) {
  const task = await readTask(builder, OPS_SCOPE, input.taskId);
  const inputs = task.inputs as EngineeringInputs;
  const action = (await builder.readActions(OPS_SCOPE, 500)).find((a) => a.kind === ENGINEERING.kind && a.task_ref === `task:${input.taskId}`);
  if (!action) throw new Error("nothing to promote");
  let full = await builder.readAction(action.action_id);
  const payload = full.payload as { change_hash: string; paths: string[] };
  if (full.status === "authorized") {
    await builder.beginAction(full.action_id, "applying the reviewed change to the target");
    full = await builder.readAction(full.action_id);
  }
  if (full.status === "enacting") {
    const files: ChangeFile[] = [];
    for (const path of payload.paths) files.push({ path, content: (await input.workspace.read(path)) ?? "" });
    if ((await changeHash(files)) !== payload.change_hash) {
      await builder.settleAction({ actionId: full.action_id, status: "failed", detail: "the workspace no longer holds the reviewed change" });
      throw new Error("the workspace changed after review");
    }
    await input.target.write(files);
    await builder.settleAction({
      actionId: full.action_id,
      status: "completed",
      result: { change_hash: payload.change_hash, paths: payload.paths },
      detail: "promoted",
      evidence: [await artifact(`Promoted ${payload.paths.join(", ")}`, payload)],
    });
  }

  const diagnostic = payload.paths.find((p) => p.startsWith("scripts/diagnostics/"));
  const observed = diagnostic ? await (await input.target.load(diagnostic)).diagnose(input.live, inputs.rail) : {};
  const matches = typeof observed.reconciliations === "number";
  await builder.recordEvent({
    type: "ops.observation.recorded",
    scope: OPS_SCOPE,
    payload: { task: input.taskId, proposal_event_id: inputs.proposal_event_id, expected: inputs.expected, observed, matches },
    evidence: [await artifact("Promoted diagnostic run against the live kernel", observed)],
  });
  if ((await readTask(builder, OPS_SCOPE, input.taskId)).status === "in_progress") {
    await builder.transitionTask({ taskId: input.taskId, status: "verifying", detail: "promoted and observed; awaiting review", result: { observed } });
  }
  return { observed, matches };
}

// The steward installs the creation loop: who may open, build, test, review and promote.
export async function installCreation(steward: Kernel, input: { opsService: string; trustService: string; as(actorId: string): Kernel; read: string[] }) {
  await steward.issueGrant({ grantee: input.opsService, capability: "task.create", scope: OPS_SCOPE });
  for (const capability of [ENGINEERING.build, ENGINEERING.promote("A"), "kernel.grant.issue", "ops.*"]) {
    await steward.issueGrant({ grantee: input.opsService, capability, scope: OPS_SCOPE });
  }
  await steward.issueGrant({ grantee: input.opsService, capability: "kernel.actor.create", scope: `actor:${input.opsService}` });
  for (const capability of ["task.verify", ENGINEERING.review, "kernel.read", "kernel.grant.issue"]) {
    await steward.issueGrant({ grantee: input.trustService, capability, scope: OPS_SCOPE });
  }
  const ciService = await steward.createServiceActor("SOV CI");
  await steward.issueGrant({ grantee: ciService, capability: "ops.ci.completed", scope: OPS_SCOPE });
  await steward.issueGrant({ grantee: ciService, capability: "kernel.read", scope: OPS_SCOPE });
  // The scopes the loop observes: CI reads them in simulation; the ops service may lend its read
  // of them to its builder for the observation after promotion.
  for (const scope of input.read) {
    await steward.issueGrant({ grantee: ciService, capability: "kernel.read", scope });
    await steward.issueGrant({ grantee: input.opsService, capability: "kernel.grant.issue", scope });
  }
  // Promotion of Class A needs the reviewer party; nothing grants agents promotion above Class A.
  await steward.setActionPolicy({ scope: OPS_SCOPE, capability: ENGINEERING.promote("A"), requirement: "second_authority", approverCapability: ENGINEERING.review, distinctBy: "party" });

  const builderId = await input.as(input.opsService).spawnAgent({ label: "Builder", role: "engineering_agent", idempotencyKey: "builder" });
  const reviewerId = await input.as(input.trustService).spawnAgent({ label: "Reviewer", role: "engineering_agent", idempotencyKey: "reviewer" });
  return { ciService, builderId, reviewerId };
}

// Leases for one engineering task: the builder may build and propose Class A promotion for this
// task only; the reviewer may review and verify this task only; both may read the ops scope.
export async function leaseEngineering(ops: Kernel, trust: Kernel, input: { taskId: string; builderId: string; reviewerId: string; rail: string; ttlMs?: number }) {
  const expiresAt = new Date(Date.now() + (input.ttlMs ?? 30 * 60_000));
  const taskRef = `task:${input.taskId}`;
  for (const capability of [ENGINEERING.build, ENGINEERING.promote("A")]) {
    await ops.issueLease({ grantee: input.builderId, capability, scope: OPS_SCOPE, taskRef, expiresAt });
  }
  await ops.issueLease({ grantee: input.builderId, capability: "ops.observation.recorded", scope: OPS_SCOPE, expiresAt });
  // Reads cannot be limited to a task: the builder reads the ops scope and the rail it observes.
  await ops.issueLease({ grantee: input.builderId, capability: "kernel.read", scope: OPS_SCOPE, expiresAt });
  await ops.issueLease({ grantee: input.builderId, capability: "kernel.read", scope: input.rail, expiresAt });
  for (const capability of ["task.verify", ENGINEERING.review]) {
    await trust.issueLease({ grantee: input.reviewerId, capability, scope: OPS_SCOPE, taskRef, expiresAt });
  }
  await trust.issueLease({ grantee: input.reviewerId, capability: "kernel.read", scope: OPS_SCOPE, expiresAt });
}
