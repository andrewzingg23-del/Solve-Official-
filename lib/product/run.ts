// Running a capability: one path for a person on a screen and an AI through the connector.
//
//   validate input → create (or resume) a kernel task → claim it (the kernel authorizes) →
//   execute through a provider adapter, retrying ordinary transient failures →
//   save the result as a resource in the Space → complete the task with its result and evidence,
//   or fail it and say why.
//
// No new runtime and no new store: a run *is* a kernel task (create_task / transition_task), so it
// has the kernel's authority checks at every step (switching an app Off stops a run in flight), an
// idempotency key (the same request resumes or returns the same result instead of running twice),
// history, and evidence. The actor is whoever's kernel this is — a person, or an app as its own agent.
import { createHash } from "node:crypto";
import { KernelError, type Kernel, type Task } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";

/**
 * A provider adapter: one real operation, its input check, and how its result becomes a resource.
 * Kernel idempotency covers Solve's own records, not the provider's side effects: an adapter that
 * writes outside Solve must use the provider's idempotency key or check the provider's state before
 * a retry (docs/architecture/2026-11-10-reusable-foundation.md §10). Read-only adapters are safe to retry.
 */
export type Adapter<In, Out> = {
  id: string;                         // "link.capture"
  /** Who performs it and what one call costs, for metering. 0 when the provider doesn't charge. */
  provider: string;
  costPerCallUsd: number;
  title: (input: In) => string;       // what the task is called in the Space's history
  validate: (raw: unknown) => { ok: true; input: In } | { ok: false; error: string };
  execute: (input: In, attempt: number) => Promise<Out>;
  /** Whether a failure is worth retrying (a network blip, a 5xx), or final (a 404, a refusal). */
  transient: (error: unknown) => boolean;
  /** The bytes or facts the evidence fingerprints, so the record shows what was actually received. */
  fingerprint: (output: Out) => { contentHash: `sha256:${string}`; uri?: string; mediaType?: string };
  /** Save the result as a resource in the Space; returns its entity id. Idempotent on `key`. */
  persist: (kernel: Kernel, world: { worldId: string; scope: string; entityId: string }, output: Out, key: string) => Promise<string>;
};

export type RunResult =
  | { ok: true; taskId: string; entityId: string; resumed: boolean }
  | { ok: false; taskId: string | null; error: string; retryable: boolean };

const MAX_ATTEMPTS = 3;
const pause = (ms: number) => new Promise(r => setTimeout(r, ms));
const refusal = (e: unknown) => e instanceof KernelError && ["forbidden", "unauthenticated"].includes(e.name);

export async function runCapability<In, Out>(
  kernel: Kernel,
  adapter: Adapter<In, Out>,
  worldId: string,
  raw: unknown,
  requestKey: string,
): Promise<RunResult> {
  const checked = adapter.validate(raw);
  if (!checked.ok) return { ok: false, taskId: null, error: checked.error, retryable: false };
  let world: { worldId: string; scope: string; entityId: string };
  try {
    world = (await loadCreativeWorld(kernel, worldId)).world;
  } catch (e) {
    return { ok: false, taskId: null, error: refusal(e) || e instanceof KernelError ? "This isn't allowed in that Space." : "That Space can't be reached right now.", retryable: !(e instanceof KernelError) };
  }
  const key = createHash("sha256").update(`${adapter.id}|${world.worldId}|${requestKey}`).digest("hex").slice(0, 48);

  // The task is the run. The same key returns the same task, so an interrupted run resumes.
  let taskId: string;
  try {
    taskId = await kernel.createTask({
      scope: world.scope, title: adapter.title(checked.input).slice(0, 160), requiredCapability: "world.entity.write",
      objective: adapter.id, inputs: { capability: adapter.id, input: checked.input as unknown as Record<string, unknown> },
      evidenceBases: ["artifact"], idempotencyKey: `run:${key}`,
    });
  } catch (e) {
    return { ok: false, taskId: null, error: refusal(e) ? "Not allowed: this needs Add access to the Space." : "The run couldn't be started.", retryable: !refusal(e) };
  }
  const current = (await kernel.readTasks(world.scope).catch(() => [] as Task[])).find(t => t.task_id === taskId);
  if (current?.status === "completed" && typeof current.result?.entity_id === "string") {
    return { ok: true, taskId, entityId: current.result.entity_id, resumed: true };
  }
  if (current?.status === "failed" || current?.status === "cancelled") {
    return { ok: false, taskId, error: current.detail || "This run already failed.", retryable: false };
  }

  // Walk the task forward from wherever it stopped; each step is authorized by the kernel.
  const order = ["created", "ready", "claimed", "in_progress"] as const;
  try {
    for (let i = Math.max(0, order.indexOf((current?.status ?? "created") as (typeof order)[number])) + 1; i < order.length; i++) {
      await kernel.transitionTask({ taskId, status: order[i] });
    }
  } catch (e) {
    return { ok: false, taskId, error: refusal(e) ? "Not allowed: this needs Add access to the Space." : "The run couldn't be claimed.", retryable: !refusal(e) };
  }

  // Execute, retrying only what is worth retrying. Metered from the first call: provider, attempts,
  // time, bytes received and estimated cost go onto the task, success or not.
  let output: Out | null = null;
  let last: unknown = null;
  let attempts = 0;
  const started = Date.now();
  for (let attempt = 1; attempt <= MAX_ATTEMPTS && output === null; attempt++) {
    attempts = attempt;
    try { output = await adapter.execute(checked.input, attempt); }
    catch (e) { last = e; if (!adapter.transient(e) || attempt === MAX_ATTEMPTS) break; await pause(300 * attempt); }
  }
  const metering = {
    provider: adapter.provider, attempts, ms: Date.now() - started,
    bytes: output === null ? 0 : Buffer.byteLength(JSON.stringify(output)),
    estimated_cost_usd: Number((attempts * adapter.costPerCallUsd).toFixed(6)),
  };
  if (output === null) {
    const why = last instanceof Error ? last.message : "the provider didn't answer";
    await kernel.transitionTask({ taskId, status: "failed", detail: why.slice(0, 500), result: { capability: adapter.id, outcome: "failed", metering } }).catch(() => {});
    return { ok: false, taskId, error: why, retryable: adapter.transient(last) };
  }

  // Preserve the result in the Space, then complete the task with it and its evidence.
  try {
    const entityId = await adapter.persist(kernel, world, output, key);
    const print = adapter.fingerprint(output);
    await kernel.transitionTask({
      taskId, status: "completed", result: { entity_id: entityId, capability: adapter.id, outcome: "completed", metering },
      evidence: [{ basis: "artifact", content_hash: print.contentHash, uri: print.uri, media_type: print.mediaType, description: `Received by ${adapter.id}` }],
    });
    return { ok: true, taskId, entityId, resumed: false };
  } catch (e) {
    // The kernel re-checks authority here: an app switched Off mid-run is stopped at this step.
    await kernel.transitionTask({ taskId, status: "failed", detail: refusal(e) ? "Access was withdrawn during the run." : "The result couldn't be saved." }).catch(() => {});
    return { ok: false, taskId, error: refusal(e) ? "Access was withdrawn during the run; nothing was saved." : "The result couldn't be saved.", retryable: !refusal(e) };
  }
}
