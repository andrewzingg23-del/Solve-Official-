"use client";

// The steward projection: SOV operating SOV, read with the steward's authority. What needs a
// human comes first, then the work itself (who worked, who verified, what the kernel decided, what
// happened), what was learned and proposed, and what is not built yet. Same kernel records as
// everything else; no summary that flatters.
import { useEffect, useState } from "react";
import type { OperationsView } from "@/lib/world/operations";
import { label, quietLink } from "@/app/ui";

export function StewardPanel({ load, onClose }: { load: () => Promise<OperationsView> | null; onClose(): void }) {
  const [view, setView] = useState<OperationsView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const pending = load();
    if (!pending) {
      queueMicrotask(() => live && setError("No steward runs on this device."));
    } else {
      pending.then((v) => live && setView(v)).catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    }
    return () => {
      live = false;
    };
  }, [load]);

  return (
    <section
      aria-label="Steward view"
      className="pointer-events-auto absolute inset-x-3 top-[6.75rem] z-20 mx-auto max-h-[calc(100dvh-16rem)] max-w-4xl overflow-y-auto rounded-md border border-line bg-surface/90 p-5 backdrop-blur-md md:inset-x-8 md:top-24"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className={label}>Steward view</p>
          <h2 className="text-xl font-semibold tracking-tight">SOV operating SOV</h2>
          <p className="text-xs text-muted">Read with the Arcadia steward&rsquo;s authority. In this sandbox every principal runs in your browser; You alone cannot read these records.</p>
        </div>
        <button type="button" className={quietLink} onClick={onClose}>
          Close
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-4 text-sm text-negative">
          {error}
        </p>
      )}
      {!view && !error && <p className="mt-4 text-sm text-muted">Reading the kernel…</p>}
      {view && (
        <div className="mt-5 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <p className={label}>Needs you</p>
            {view.needsYou.length === 0 ? <p className="text-sm text-muted">Nothing waits on a human right now.</p> : view.needsYou.map((n) => <p key={n} className="text-sm">{n}</p>)}
          </div>

          <div className="flex flex-col gap-2">
            <p className={label}>Operations on {view.rail}</p>
            <ul className="flex flex-col gap-3">
              {view.tasks.map((t) => (
                <li key={t.taskId} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-semibold">{t.title}</span>
                    <span className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${t.status === "completed" ? "text-positive" : "text-accent"}`}>{t.status}</span>
                  </div>
                  <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-xs">
                    <dt className="text-muted">Worked by</dt>
                    <dd>{t.worker ?? "unclaimed"}</dd>
                    <dt className="text-muted">Verified by</dt>
                    <dd>{t.verifier ?? `pending (${t.verification.replace("_", " ")})`}</dd>
                    <dt className="text-muted">Kernel decision</dt>
                    <dd>{t.decision ? `${t.decision.replace(/_/g, " ").toLowerCase()} → ${t.actionStatus}` : "nothing proposed"}</dd>
                    <dt className="text-muted">Consequence</dt>
                    <dd>{t.outcome ?? "none yet"}</dd>
                  </dl>
                  {t.detail && <p className="mt-2 text-xs text-muted">{t.detail}</p>}
                </li>
              ))}
              {view.tasks.length === 0 && <li className="text-sm text-muted">No operational tasks on this rail.</li>}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <p className={label}>Learned</p>
            {view.learning.length === 0 ? <p className="text-sm text-muted">Nothing recorded yet.</p> : view.learning.map((l) => <p key={l.eventId} className="text-sm">{l.observation}</p>)}
          </div>

          <div className="flex flex-col gap-2">
            <p className={label}>Build proposals</p>
            {view.proposals.map((p) => (
              <div key={p.eventId} className="rounded-md border border-line p-3">
                <p className="text-sm">
                  <span className="mr-2 rounded border border-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent">CLASS {p.changeClass}</span>
                  {p.problem}
                </p>
                <p className="mt-1 text-xs text-muted">Expected: {p.expected}</p>
                <p className="mt-1 text-xs text-muted">
                  {p.reuse ? `Reuse: ${p.reuse}. ` : ""}Evidence: {p.evidence} records. Promotion: {p.promotion}. Status: {p.status}.
                </p>
              </div>
            ))}
            {view.proposals.length === 0 && <p className="text-sm text-muted">No proposals.</p>}
          </div>

          {view.notBuilt.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className={label}>Not built yet</p>
              {view.notBuilt.map((n) => (
                <p key={n} className="text-sm text-muted">
                  {n}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
