// The room's wayfinder routes, client side. Renders the RoutePlan the chat
// endpoint derives from a way-ask: two real routes (primary + alternative),
// every number labelled an estimate. It shows — it never invents.
"use client";

import { ventureTitle, type RoutePlan } from "@/lib/world/wayfinder";

const heading = "text-[10px] font-semibold uppercase tracking-[0.22em] text-muted";
const card =
  "flex flex-col gap-3 rounded-xl border border-line bg-surface/55 p-4 backdrop-blur-md";

function est(usd: number): string {
  return `$${usd.toLocaleString("en-US")} est.`;
}

export function WayPlanCard({ plan, onBuild }: { plan: RoutePlan; onBuild?: () => void }) {
  const altLine =
    plan.alternative.strategy === "funded"
      ? "The funded path buys speed at higher upfront cost."
      : "The lean path avoids the largest upfront cost.";
  return (
    <section aria-label="Ways forward" className={card}>
      <h2 className={heading}>Ways forward</h2>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-foreground">{ventureTitle(plan.title)}</p>
        <p className="text-2xl font-bold tabular-nums text-foreground">{est(plan.capitalUsd)}</p>
        <p className="text-xs text-muted">All numbers are planner estimates, not quotes.</p>
      </div>
      <ol className="flex flex-col gap-2">
        {plan.milestones.map((m) => (
          <li key={m.key} className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">{m.title}</p>
              <p className="text-xs leading-5 text-muted">{m.summary}</p>
            </div>
            <p className="shrink-0 text-xs tabular-nums text-muted">{est(m.capitalUsd)}</p>
          </li>
        ))}
      </ol>
      <p className="text-xs leading-5 text-muted">{plan.explanation}</p>
      <div className="rounded-lg border border-line bg-background/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
          Alternative · {plan.alternative.strategy} path
        </p>
        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">
          {est(plan.alternative.capitalUsd)}
        </p>
        <p className="text-xs leading-5 text-muted">{altLine}</p>
      </div>
      {onBuild ? (
        <button
          type="button"
          onClick={onBuild}
          className="h-10 rounded-md border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.2em] hover:border-accent hover:text-accent"
        >
          Build this way
        </button>
      ) : null}
    </section>
  );
}
