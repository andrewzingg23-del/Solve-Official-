// The spend meter: how much AI a person has burned in the last hour, and
// whether they may burn more.
//
// The limiters in lib/bot/chat.ts keep their windows in a Map, in one server
// instance's memory. Their own comments call that v1, and it is honest for
// talk: every instance hands out its own budget, a restart clears it, and the
// worst case is a few cents. That stops being acceptable the moment a turn can
// run tools and a sandbox, so the durable count lives in the kernel
// (migration 20261111000000, kernel_api.read_ai_spend / record_ai_spend).
//
// Division of labour, deliberately:
//   - the kernel owns the COUNT. Durable, shared across instances, append-only.
//   - this module owns the POLICY. The threshold is app config, so it can be
//     tuned per surface without a migration.
//
// What this does not do: block. It reports. The caller decides what a verdict
// means for its surface — a chat turn refuses, a mission might queue instead.
//
// Guests: anonymous sessions cannot use the kernel at all (resolve_caller
// raises KA001), so a guest has no durable meter. `meterFor` says so in the
// verdict rather than pretending, and the caller keeps using the in-process
// limiter for them. That is a real gap, not an oversight: it is bounded by the
// guest's own IP limiter today, and closing it properly means giving guests a
// kernel actor.

import type { AiSpend } from "@/lib/kernel/client";

export const SPEND_WINDOW_SECONDS = 3600;

/** What kind of work spent the tokens. Kept short and lowercase for the kernel's check. */
export type SpendKind = "chat" | "draft" | "tool" | "mission";

export type SpendVerdict = {
  /** True when the person is over budget for this window. */
  blocked: boolean;
  /** Tokens spent in the window, as counted. 0 when nothing is known. */
  tokens: number;
  /** The ceiling the verdict was judged against. */
  limit: number;
  /**
   * Where the count came from. "kernel" is durable and shared. "process" is the
   * in-memory fallback — correct only for this instance. "unknown" means the
   * meter could not be read at all.
   */
  source: "kernel" | "process" | "unknown";
};

/** Tokens an actor may spend per window. Env overrides; same key chat.ts already uses. */
export const DEFAULT_TOKENS_PER_WINDOW = 150_000;
export function tokensPerWindow(env: Record<string, string | undefined> = process.env): number {
  const raw = Number(env.CHAT_MAX_TOKENS_PER_HOUR);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : DEFAULT_TOKENS_PER_WINDOW;
}

/** Judge a count against the limit. Pure, so the policy is testable on its own. */
export function judge(spend: AiSpend | null, limit = tokensPerWindow()): SpendVerdict {
  if (!spend) return { blocked: false, tokens: 0, limit, source: "unknown" };
  return { blocked: spend.tokens >= limit, tokens: spend.tokens, limit, source: "kernel" };
}

/** What remains in the window. Never negative. */
export function remaining(verdict: SpendVerdict): number {
  return Math.max(0, verdict.limit - verdict.tokens);
}

/**
 * The person's message when they are out of budget. Says what ran out and when
 * it returns — never "something went wrong".
 */
export function spentMessage(verdict: SpendVerdict): string {
  const minutes = Math.ceil(SPEND_WINDOW_SECONDS / 60);
  return `You've used this hour's AI budget (${verdict.tokens.toLocaleString()} of ${verdict.limit.toLocaleString()} tokens). It refills over the next ${minutes} minutes.`;
}

// The kernel shape this module needs — just the two meter calls, so a test can
// stand in for the kernel without building one.
export type SpendMeter = {
  readAiSpend: (windowSeconds?: number) => Promise<AiSpend>;
  recordAiSpend: (input: {
    tokens: number;
    kind: string;
    windowSeconds?: number;
    requestId?: string;
  }) => Promise<AiSpend>;
};

/**
 * Read the durable meter. A failure is never fatal — a meter that cannot be
 * read returns an "unknown" verdict, and the caller falls back to the process
 * limiter rather than locking the person out of their own workspace.
 */
export async function checkSpend(
  meter: SpendMeter | null,
  limit = tokensPerWindow(),
): Promise<SpendVerdict> {
  if (!meter) return { blocked: false, tokens: 0, limit, source: "unknown" };
  try {
    return judge(await meter.readAiSpend(SPEND_WINDOW_SECONDS), limit);
  } catch {
    return { blocked: false, tokens: 0, limit, source: "unknown" };
  }
}

/**
 * Charge a completed call and get the window back. `requestId` makes a retry
 * safe: the same request is recorded once and still reports the true total.
 * Recording must never break the turn the person just paid for, so a failure
 * returns an "unknown" verdict instead of throwing.
 */
export async function chargeSpend(
  meter: SpendMeter | null,
  input: { tokens: number; kind: SpendKind; requestId?: string },
  limit = tokensPerWindow(),
): Promise<SpendVerdict> {
  if (!meter || !Number.isFinite(input.tokens) || input.tokens <= 0)
    return { blocked: false, tokens: 0, limit, source: "unknown" };
  try {
    const spend = await meter.recordAiSpend({
      tokens: Math.ceil(input.tokens),
      kind: input.kind,
      windowSeconds: SPEND_WINDOW_SECONDS,
      requestId: input.requestId,
    });
    return judge(spend, limit);
  } catch {
    return { blocked: false, tokens: 0, limit, source: "unknown" };
  }
}
