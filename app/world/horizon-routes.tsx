"use client";

// The Horizon, made visible: reachable futures from the current World for the acting principal,
// computed by lib/causal (not by this component). Each step shows who would act, what the kernel
// decides for them now, the evidence that would show it happened, and what it would change. Doing
// a step runs it through the one pipeline; the World reloads and the Horizon re-plans from what
// actually happened.
import { useEffect, useState } from "react";
import type { Horizon, Route, RouteStep } from "@/lib/causal/types";
import type { WorldEngine, WorldModel } from "@/lib/world/engine";
import { label } from "@/app/ui";

const DECISION: Record<string, string> = {
  ALLOW: "allowed",
  DENY: "not allowed",
  REQUIRE_SECOND_AUTHORITY: "needs a second authority",
  REQUIRE_QUORUM: "needs a quorum",
  REQUIRE_MULTISIG: "needs signatures",
  REQUIRE_DELAY: "after a delay",
  REQUIRE_CHALLENGE_WINDOW: "after a challenge window",
};

function Step({ step, n, who, next, busy, onDo }: { step: RouteStep; n: number; who: string; next: boolean; busy: boolean; onDo(): void }) {
  const consequence = step.consequences[0];
  return (
    <li className="flex flex-col gap-1 rounded-md border border-line p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm">
          <span className="mr-2 font-mono text-xs text-muted">{n}</span>
          {step.title}
        </span>
        <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${step.authority.decision === "DENY" ? "text-negative" : "text-positive"}`}>
          {who} · {DECISION[step.authority.decision] ?? step.authority.decision}
        </span>
      </div>
      <p className="text-xs text-muted">
        Evidence: {step.expectedEvidence} Uncertainty: {step.uncertainty.level} ({step.uncertainty.because}).
        {consequence && consequence.op === "relation.create" ? ` Would record: ${consequence.kind} (${String(consequence.attributes?.status ?? "")}).` : ""}
      </p>
      {step.authority.decision === "DENY" && step.authority.reasons.length > 0 && <p className="text-xs text-negative">{step.authority.reasons.join("; ")}</p>}
      {next && (
        <button type="button" disabled={busy} onClick={onDo} className="mt-1 self-start rounded-md border border-accent px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent disabled:opacity-50">
          {busy ? "Working…" : "Do this"}
        </button>
      )}
    </li>
  );
}

export function HorizonRoutes({ engine, model, onChanged }: { engine: WorldEngine; model: WorldModel; onChanged(): Promise<unknown> }) {
  const companion = model.avatars.find((a) => a.avatar_type === "ai_companion") ?? model.avatars[0] ?? null;
  const actorId = companion?.agent_id ?? engine.manifest.you.actorId;
  const goal = engine.supplyGoal(model);
  const [horizon, setHorizon] = useState<Horizon | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    if (goal) void engine.horizon(actorId, goal).then((h) => live && setHorizon(h));
    return () => {
      live = false;
    };
    // The Horizon is a function of the World: recompute whenever the World reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, model.loadedAt, actorId]);

  if (!goal) return null;
  const name = (id: string) => (id === engine.manifest.you.actorId ? "You" : id === companion?.agent_id ? companion.name : "Another principal");
  const run = async (route: Route) => {
    setBusy(true);
    setNote(null);
    try {
      const plan = await engine.plan(route.orgRef, goal, actorId);
      const step = plan.recorded?.steps[0];
      const outcome = plan.recorded && step ? await engine.perform(plan.recorded, step.transition) : null;
      setNote(outcome ? `${step!.title}: ${outcome.status.replace(/_/g, " ")}${outcome.detail ? ` (${outcome.detail})` : ""}` : "This route changed; look again.");
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Horizon" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={label}>Horizon</p>
        <p className="text-xs text-muted">
          Toward {goal.title}, as {companion ? companion.name : "you"} can act now · ranked by {horizon?.policy ?? "…"}
        </p>
      </div>
      {!horizon && <p className="text-sm text-muted">Reading the World…</p>}
      {horizon?.satisfied && (
        <p className="text-sm text-positive">
          Reached: {model.nodes.get(horizon.satisfied.subject)?.title ?? horizon.satisfied.subject} supplies this World ({horizon.satisfied.status}, from action {horizon.satisfied.provenance.actions[0]?.slice(0, 8)}).
        </p>
      )}
      {horizon?.routes.map((route) => (
        <div key={route.id} className="flex flex-col gap-2">
          <p className="text-sm font-medium">
            {model.nodes.get(route.orgRef)?.title ?? route.orgRef}
            <span className="ml-2 text-xs text-muted">{route.executable ? (route.needsHuman ? "executable, needs you for some steps" : "executable") : `blocked: ${route.blockedBy.join("; ")}`}</span>
          </p>
          <ol className="flex flex-col gap-2">
            {route.steps.map((s, i) => (
              <Step key={i} step={s} n={i + 1} who={name(s.actorId)} next={i === 0 && route.executable} busy={busy} onDo={() => run(route)} />
            ))}
          </ol>
        </div>
      ))}
      {horizon && horizon.excluded.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className={label}>Not a route</p>
          {horizon.excluded.map((e) => (
            <p key={e.orgRef} className="text-xs text-muted">
              {e.title}: {e.reasons.join("; ")}
            </p>
          ))}
        </div>
      )}
      {note && (
        <p role="status" className="text-xs">
          {note}
        </p>
      )}
    </section>
  );
}
