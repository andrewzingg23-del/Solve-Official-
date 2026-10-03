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
// again; nothing is answered twice. Failed or unknown attempts are retried with capped
// exponential backoff, within a budget: an inquiry that exhausts its attempts is held as needing
// reconciliation and surfaced for review (status and log), and no timer touches it again until an
// operator releases it. A service whose passes keep failing outright stalls the same way: it stops
// retrying on timers and waits for a wake (a delivery, or the operator). A refusal (the agent may
// not answer) is never retried on a timer, because asking again changes nothing.
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
  // the step was denied or failed. unknown: the outcome is not known yet (retried within budget).
  // needs_reconciliation: the budget is spent; held for review, not retried.
  state: "answered" | "refused" | "unknown" | "needs_reconciliation";
  detail: string;
  reply: string | null;
  attempts: number;
};

export type PassReport = {
  at: number;
  outcomes: InquiryOutcome[];
  // Set when the pass itself failed before reaching any inquiry (the kernel was unreachable).
  error: string | null;
};

export type ReviewItem = { inquiry: string; attempts: number; since: number; detail: string };

export type ServiceStatus = {
  passes: number;
  failures: number; // consecutive passes that needed a retry
  nextRetryAt: number | null;
  last: PassReport | null;
  running: boolean;
  // Inquiries whose retry budget is spent: needing reconciliation, waiting for an operator.
  review: ReviewItem[];
  // Set when whole passes kept failing: no timer retries until a wake.
  stalled: { since: number; passes: number; detail: string } | null;
};

export type AnswerServiceOptions = Answerer & {
  timers?: Timers;
  // Backoff between retries, and how many failed or unknown attempts an inquiry (or how many
  // failed passes the service) may spend before it is held for review.
  backoff?: { baseMs: number; maxMs: number; maxAttempts?: number };
  // How often to look even when no wake arrived. 0 disables the safety net.
  safetyNetMs?: number;
  log?(event: { at: number; kind: "pass" | "retry" | "error" | "needs_review" | "stalled" | "released"; detail: string; report?: PassReport; inquiry?: string }): void;
};

export class AnswerService {
  private readonly timers: Timers;
  private readonly backoff: { baseMs: number; maxMs: number; maxAttempts: number };
  private readonly safetyNetMs: number;
  private dirty = false;
  private draining: Promise<PassReport> | null = null;
  private timer: unknown = null;
  private started = false;
  private readonly attempts = new Map<string, number>();
  private readonly review = new Map<string, ReviewItem>();
  private passFailures = 0;
  private state: Omit<ServiceStatus, "review" | "running"> = { passes: 0, failures: 0, nextRetryAt: null, last: null, stalled: null };

  constructor(private readonly options: AnswerServiceOptions) {
    this.timers = options.timers ?? realTimers;
    this.backoff = { baseMs: 1_000, maxMs: 300_000, maxAttempts: 5, ...options.backoff };
    this.safetyNetMs = options.safetyNetMs ?? 60_000;
  }

  status(): ServiceStatus {
    return { ...this.state, review: [...this.review.values()], running: this.draining !== null };
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

  // The operator has reconciled (or wants another try): the inquiry gets a fresh budget.
  release(inquiry: string): Promise<PassReport> {
    this.review.delete(inquiry);
    this.attempts.delete(inquiry);
    this.options.log?.({ at: this.timers.now(), kind: "released", detail: "released for another attempt", inquiry });
    return this.wake();
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

  // Counts a failed or unknown attempt against the inquiry's budget; at the limit it is held.
  private spend(inquiry: string, detail: string, at: number): InquiryOutcome {
    const attempts = (this.attempts.get(inquiry) ?? 0) + 1;
    this.attempts.set(inquiry, attempts);
    if (attempts < this.backoff.maxAttempts) return { inquiry, state: "unknown", detail, reply: null, attempts };
    this.review.set(inquiry, { inquiry, attempts, since: at, detail });
    this.options.log?.({ at, kind: "needs_review", detail: `retry budget spent after ${attempts} attempts: ${detail}`, inquiry });
    return { inquiry, state: "needs_reconciliation", detail, reply: null, attempts };
  }

  private async pass(): Promise<PassReport> {
    const at = this.timers.now();
    let report: PassReport;
    try {
      const answered = await answerInquiries(this.options, { exclude: new Set(this.review.keys()) });
      const outcomes = answered.map((a): InquiryOutcome => {
        const inquiry = a.goal.bind.inquiry;
        if (a.error) return this.spend(inquiry, a.error, at);
        if (!a.route || !a.route.executable) {
          this.attempts.delete(inquiry);
          return { inquiry, state: "refused", detail: a.route?.blockedBy.join("; ") || "no route to an answer", reply: null, attempts: 0 };
        }
        const last = a.outcomes.at(-1);
        if (last?.status === "completed") {
          this.attempts.delete(inquiry);
          return { inquiry, state: "answered", detail: last.detail, reply: last.actionId ? `action:${last.actionId}` : null, attempts: 0 };
        }
        if (!last || last.status === "unknown" || last.status === "blocked") return this.spend(inquiry, last?.detail ?? "no outcome", at);
        this.attempts.delete(inquiry);
        return { inquiry, state: "refused", detail: `${last.status.replace(/_/g, " ")}: ${last.detail}`, reply: null, attempts: 0 };
      });
      report = { at, outcomes, error: null };
      this.passFailures = 0;
      this.state.stalled = null;
    } catch (error) {
      // The kernel did not answer before any inquiry was reached: nothing is claimed about them.
      const detail = error instanceof KernelError ? `${error.name}: ${error.message}` : error instanceof Error ? error.message : String(error);
      report = { at, outcomes: [], error: detail };
      this.passFailures += 1;
      if (this.passFailures >= this.backoff.maxAttempts && !this.state.stalled) {
        this.state.stalled = { since: at, passes: this.passFailures, detail };
        this.options.log?.({ at, kind: "stalled", detail: `stopped retrying after ${this.passFailures} failed passes: ${detail}` });
      }
    }
    const retry = !this.state.stalled && (report.error !== null || report.outcomes.some((o) => o.state === "unknown"));
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
    // A stalled service waits for a wake; it does not poll a kernel that keeps failing.
    if (this.state.stalled) return;
    const now = this.timers.now();
    const due = [this.state.nextRetryAt !== null ? this.state.nextRetryAt - now : null, this.safetyNetMs > 0 ? this.safetyNetMs : null].filter((d): d is number => d !== null);
    if (!due.length) return;
    const ms = Math.max(0, Math.min(...due));
    this.timer = this.timers.setTimeout(() => {
      this.timer = null;
      this.options.log?.({ at: this.timers.now(), kind: "retry", detail: this.state.nextRetryAt !== null ? "retrying after a failed or unknown attempt" : "safety-net pass" });
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
