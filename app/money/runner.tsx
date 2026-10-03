"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { label, primaryAction } from "@/app/ui";
import { proofOfLife, sendBob, type Outcome } from "./actions";

function Panel<T>({
  title,
  summary,
  action,
  children,
}: {
  title: string;
  summary: string;
  action: () => Promise<Outcome<T>>;
  children: (data: T) => ReactNode;
}) {
  const [outcome, run, pending] = useActionState(action, null);
  return (
    <section className="flex flex-col gap-5 rounded-md border border-line bg-surface/60 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex max-w-md flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <p className="text-sm leading-6 text-muted">{summary}</p>
        </div>
        <button type="button" disabled={pending} onClick={() => startTransition(run)} className={`${primaryAction} disabled:opacity-50`}>
          {pending ? "Running…" : outcome ? "Run again" : "Run"}
        </button>
      </div>
      <div aria-live="polite">
        {pending && <p className="text-sm text-muted">Starting a kernel and a chain from nothing…</p>}
        {!pending && outcome && !outcome.ok && (
          <p role="alert" className="text-sm text-negative">
            The run failed: {outcome.error}
          </p>
        )}
        {!pending && outcome?.ok && (
          <div className="flex flex-col gap-4">
            {children(outcome.data)}
            <p className="text-xs text-muted">Ran in {(outcome.ms / 1000).toFixed(1)} s.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function Verdict({ pass, children }: { pass: boolean; children: ReactNode }) {
  return (
    <p className={`rounded-md border p-3 text-sm ${pass ? "border-positive/30 bg-positive/10" : "border-negative/30 bg-negative/10"}`}>
      <strong className={pass ? "text-positive" : "text-negative"}>{pass ? "PASS" : "FAIL"}</strong> {children}
    </p>
  );
}

const mono = "break-all font-mono text-xs leading-5 text-muted";

export function ProofOfLife() {
  return (
    <Panel
      title="Proof of life"
      summary="A verified outcome becomes an entitlement, the Earn Vault releases DEV-SOLVE exactly once, and the new owner sends some on. Kernel and chain reconcile."
      action={proofOfLife}
    >
      {(data) => (
        <>
          <ol className="flex flex-col divide-y divide-line">
            {data.steps.map((s) => (
              <li key={s.n} className="grid grid-cols-[2rem_1fr] gap-x-3 py-2 sm:grid-cols-[2rem_11rem_1fr]">
                <span className="font-mono text-xs text-accent">{String(s.n).padStart(2, "0")}</span>
                <span className="text-sm font-medium">{s.title}</span>
                <span className={`${mono} col-start-2 sm:col-start-3`}>{s.detail}</span>
              </li>
            ))}
          </ol>
          <Verdict pass={data.pass}>
            settlement <span className="break-all font-mono text-xs">{data.settlementId}</span>
          </Verdict>
        </>
      )}
    </Panel>
  );
}

export function SendBob() {
  return (
    <Panel
      title="Send Bob $10"
      summary="Alice holds ARC and DEV-SOLVE; Bob only accepts DEV-USDC. The router compares every route, picks the cheapest, and pays in one all-or-nothing transaction."
      action={sendBob}
    >
      {(data) => (
        <>
          <p className="text-sm text-muted">{data.setup}</p>
          <div className="flex flex-col gap-2">
            <p className={label}>{data.routes.length} routes compared</p>
            <ul className="flex flex-col divide-y divide-line">
              {data.routes.map((r) => (
                <li key={r.label} className="flex flex-col gap-1 py-2 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className={`font-mono text-xs ${r.best ? "text-accent" : "text-foreground"}`}>
                    {r.best ? "● " : "○ "}
                    {r.label}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-muted">
                    {r.input} · cost <span className={r.best ? "text-accent" : "text-foreground"}>{r.cost}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-1">
            <p className={label}>Chosen route</p>
            {data.legs.map((l) => (
              <p key={l.venue} className={mono}>
                {l.venue} ({l.kind}, {l.operator}): spot {l.spot}, TWAP {l.twap}, depth {l.depth}
              </p>
            ))}
            <p className={mono}>{data.identity}</p>
            <p className={mono}>network {data.network}</p>
          </div>
          <div className="flex flex-col gap-1">
            <p className={label}>Result</p>
            <p className="text-sm">
              {data.status}: Alice paid {data.alicePaid} (limit {data.limit}); Bob holds {data.bob}, read from chain.
            </p>
            <p className={mono}>transaction {data.signature}</p>
            <p className={mono}>
              payment marker on chain: {String(data.marker)} · kernel: {data.kernelStatus} · retry: {data.retry} · history {data.history}
            </p>
          </div>
          <Verdict pass={data.pass}>
            payment <span className="break-all font-mono text-xs">{data.paymentId}</span>
          </Verdict>
        </>
      )}
    </Panel>
  );
}
