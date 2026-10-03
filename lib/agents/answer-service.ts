// The delivery-woken answer service: an organization's agent, running wherever its operator runs
// it, answering the inquiries delivered to it through the one loop (lib/causal/exchange.ts), with
// its own session and its own authority. It holds no state the kernel does not: the inbox and the
// kernel's reply links say what is open, so a restarted service picks up exactly where the last
// one stopped.
//
// Woken by delivery, never driven by the asker. A wake carries no content, only "look": the agent
// then reads its own inbox. Wake sources are best effort (an in-process doorbell where the sender
// runs on the same device; a cheap inbox watch elsewhere); a slow safety-net pass covers a wake
// that never arrived.
//
// Retries and unknown outcomes. Every write in a pass is keyed: the selection by its route, the
// answer by its route and step, and an attempt already under way is continued rather than proposed
// again. So a pass that died after the kernel committed but before it heard back is simply run
// again; nothing is answered twice. A pass that fails is retried with exponential backoff. A
// refusal (the agent may not answer) is not retried on a timer, because asking again changes
// nothing; the next delivery or safety-net pass re-reads authority.
import { KernelError, type Kernel } from "../kernel/client";
import { answerInquiries, type Answerer } from "../causal/exchange";

export type Timers = {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
};

const realTimers: Timers = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export type InquiryOutcome = {
  inquiry: string;
  // answered: a completed reply exists. refused: the kernel would not let this agent answer, or
  // the step was denied or failed. unknown: the outcome is not known yet (retried).
  state: "answered" | "refused" | "unknown";
  detail: string;
  reply: string | null;
};

export type PassReport = {
  at: number;
  outcomes: InquiryOutcome[];
  // Set when the pass itself failed (the kernel was unreachable, or a reply was lost): retried.
  error: string | null;
};

export type ServiceStatus = {
  passes: number;
  failures: number; // consecutive failed passes
  nextRetryAt: number | null;
  last: PassReport | null;
  running: boolean;
};

export type AnswerServiceOptions = Answerer & {
  timers?: Timers;
  backoff?: { baseMs: number; maxMs: number };
  // How often to look even when no wake arrived. 0 disables the safety net.
  safetyNetMs?: number;
  log?(event: { at: number; kind: "pass" | "retry" | "error"; detail: string; report?: PassReport }): void;
};

export class AnswerService {
  private readonly timers: Timers;
  private readonly backoff: { baseMs: number; maxMs: number };
  private readonly safetyNetMs: number;
  private dirty = false;
  private draining: Promise<PassReport> | null = null;
  private timer: unknown = null;
  private started = false;
  private state: ServiceStatus = { passes: 0, failures: 0, nextRetryAt: null, last: null, running: false };

  constructor(private readonly options: AnswerServiceOptions) {
    this.timers = options.timers ?? realTimers;
    this.backoff = options.backoff ?? { baseMs: 1_000, maxMs: 300_000 };
    this.safetyNetMs = options.safetyNetMs ?? 60_000;
  }

  status(): ServiceStatus {
    return { ...this.state, running: this.draining !== null };
  }

  // A delivery (or anything else) says "look". Resolves with the report of a pass that started
  // after this wake: a wake during a pass is never lost, and wakes during one pass coalesce into
  // one more pass.
  wake(): Promise<PassReport> {
    this.dirty = true;
    this.draining ??= this.drain().finally(() => {
      this.draining = null;
      this.schedule();
    });
    return this.draining;
  }

  // Resolves once no pass is running (for a graceful stop, or to observe a timer-driven pass).
  async idle(): Promise<void> {
    while (this.draining) await this.draining;
  }

  // Runs on timers: retries after failures, and the safety-net pass.
  start() {
    this.started = true;
    this.schedule();
    return this;
  }

  stop() {
    this.started = false;
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
  }

  private async drain(): Promise<PassReport> {
    let report: PassReport | null = null;
    while (this.dirty) {
      this.dirty = false;
      report = await this.pass();
    }
    return report!;
  }

  private async pass(): Promise<PassReport> {
    const at = this.timers.now();
    let report: PassReport;
    try {
      const answered = await answerInquiries(this.options);
      const outcomes = answered.map((a): InquiryOutcome => {
        const inquiry = a.goal.bind.inquiry;
        if (!a.route || !a.route.executable) {
          return { inquiry, state: "refused", detail: a.route?.blockedBy.join("; ") || "no route to an answer", reply: null };
        }
        const last = a.outcomes.at(-1);
        if (last?.status === "completed") return { inquiry, state: "answered", detail: last.detail, reply: last.actionId ? `action:${last.actionId}` : null };
        if (!last || last.status === "unknown" || last.status === "blocked") return { inquiry, state: "unknown", detail: last?.detail ?? "no outcome", reply: null };
        return { inquiry, state: "refused", detail: `${last.status.replace(/_/g, " ")}: ${last.detail}`, reply: null };
      });
      report = { at, outcomes, error: null };
    } catch (error) {
      // The kernel did not answer, or answered and the reply was lost: either way the outcome of
      // the last write is unknown. Keys make running the pass again safe.
      const detail = error instanceof KernelError ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      report = { at, outcomes: [], error: detail };
    }
    const retry = report.error !== null || report.outcomes.some((o) => o.state === "unknown");
    this.state.passes += 1;
    this.state.failures = retry ? this.state.failures + 1 : 0;
    this.state.nextRetryAt = retry ? at + Math.min(this.backoff.baseMs * 2 ** (this.state.failures - 1), this.backoff.maxMs) : null;
    this.state.last = report;
    this.options.log?.({ at, kind: report.error ? "error" : "pass", detail: report.error ?? `${report.outcomes.length} inquiries`, report });
    return report;
  }

  private schedule() {
    if (!this.started) return;
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    const now = this.timers.now();
    const due = [this.state.nextRetryAt !== null ? this.state.nextRetryAt - now : null, this.safetyNetMs > 0 ? this.safetyNetMs : null].filter((d): d is number => d !== null);
    if (!due.length) return;
    const ms = Math.max(0, Math.min(...due));
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      this.options.log?.({ at: this.timers.now(), kind: "retry", detail: this.state.nextRetryAt !== null ? "retrying after a failed or unknown pass" : "safety-net pass" });
      void this.wake();
    }, ms);
  }
}

// Delivery signals. A doorbell is rung where the sender runs on the same device (the sandbox):
// it carries only the recipient, never content.
export class Doorbells {
  private readonly listeners = new Map<string, Set<() => Promise<unknown> | void>>();
  on(actorId: string, listener: () => Promise<unknown> | void) {
    const set = this.listeners.get(actorId) ?? new Set();
    set.add(listener);
    this.listeners.set(actorId, set);
    return () => set.delete(listener);
  }
  async ring(actorId: string) {
    await Promise.all([...(this.listeners.get(actorId) ?? [])].map((l) => l()));
  }
}

// Where no push reaches the agent's process, it watches its own inbox: one cheap read per interval,
// a wake only when a message it has not seen was delivered. The first look counts everything
// already delivered as new, so a restarted service re-checks what may still be open.
export function watchInbox(input: { kernel: Kernel; onDelivery(): Promise<unknown> | void; intervalMs?: number; timers?: Timers; onError?(error: unknown): void }) {
  const timers = input.timers ?? realTimers;
  const seen = new Set<string>();
  let handle: unknown = null;
  let stopped = false;
  const look = async () => {
    try {
      const fresh = (await input.kernel.inbox()).filter((m) => !seen.has(m.action_id));
      for (const m of fresh) seen.add(m.action_id);
      if (fresh.length) await input.onDelivery();
      return fresh.length;
    } catch (error) {
      input.onError?.(error);
      return 0;
    }
  };
  const loop = () => {
    if (stopped) return;
    handle = timers.setTimeout(async () => {
      await look();
      loop();
    }, input.intervalMs ?? 5_000);
  };
  return {
    look,
    start() {
      stopped = false;
      void look().then(loop);
      return this;
    },
    stop() {
      stopped = true;
      if (handle !== null) timers.clearTimeout(handle);
    },
  };
}
