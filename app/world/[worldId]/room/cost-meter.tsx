// The trust layer's spend readout, client side. After each bot reply, one
// quiet line: what the reply cost in plain words, how much of the hour's
// token budget is spent, and a thin bar. No jargon — tokens are counted,
// dollars are only an estimate, and the cap is the enforcement.
"use client";

import { DEFAULT_MAX_TOKENS_PER_HOUR } from "@/lib/bot/chat";

export type TalkUsage = {
  estimatedCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  tokensSpentThisHour: number;
};

const num = (n: number) => Math.max(0, Math.round(n)).toLocaleString("en-US");

// Dollars in plain words. Estimates only — the price table drifts, so the
// token cap above is the enforcement and this is the readout.
function plainCost(usd: number): string {
  if (!Number.isFinite(usd) || usd <= 0) return "About nothing";
  if (usd < 0.0001) return "Less than a hundredth of a cent";
  if (usd < 0.001) return "About a tenth of a cent";
  if (usd < 0.01) return "Under a cent";
  if (usd < 0.1) {
    const cents = Math.max(1, Math.round(usd * 100));
    return `About ${cents} cent${cents === 1 ? "" : "s"}`;
  }
  return `About $${usd.toFixed(2)}`;
}

export function CostMeter({ usage }: { usage: TalkUsage }) {
  const cap = DEFAULT_MAX_TOKENS_PER_HOUR;
  const spent = Math.max(0, Math.round(usage.tokensSpentThisHour));
  const pct = Math.min(100, Math.max(0, (spent / cap) * 100));
  const warm = spent >= cap * 0.75;
  return (
    <div className="flex flex-col gap-1.5 self-start px-1" aria-label="Cost of this reply">
      <p className="text-[11px] leading-4 text-muted tabular-nums">
        {plainCost(usage.estimatedCostUsd)} · {num(spent)} of {num(cap)} tokens this hour
      </p>
      <div aria-hidden className="h-1 w-40 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-accent/60" style={{ width: `${pct}%` }} />
      </div>
      {warm ? (
        <p className="text-[11px] leading-4 text-muted">Running warm — the hour resets soon.</p>
      ) : null}
    </div>
  );
}
