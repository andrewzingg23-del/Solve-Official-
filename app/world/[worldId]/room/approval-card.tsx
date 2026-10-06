// The gate's face, client side. Nothing consequential runs from Talk without
// passing lib/packs/panels' gate first: the world's panel is registered once
// at import, gateAction is consulted before the card ever shows, and only the
// person's explicit approve fires the real action. Deny just closes the card.
"use client";

import { gateAction, registerPanel, type GateDecision } from "@/lib/packs/panels";

registerPanel({
  packId: "world",
  title: "World",
  actions: [
    {
      id: "build_venture",
      label: "Build this way",
      level: "approval",
      reason: "Creating a venture world writes milestones to your world record.",
    },
  ],
});

/** Consult the gate before showing the approval card. Closed by default. */
export function worldBuildGate(): GateDecision {
  return gateAction("world", "build_venture");
}

export type ApprovalCardProps = {
  title: string;
  /** One plain line each for what approving really does. */
  whatItDoes: string[];
  /** Plain words, never a fake number: estimates labelled, nothing moved. */
  cost: string;
  /** The gate's own reason, passed through. */
  reason: string;
  note?: string;
  onApprove: () => void;
  onDeny: () => void;
};

export function ApprovalCard({ title, whatItDoes, cost, reason, note, onApprove, onDeny }: ApprovalCardProps) {
  return (
    <section
      aria-label="Approval needed"
      className="flex flex-col gap-3 rounded-xl border border-accent/30 bg-surface/55 p-4 backdrop-blur-md"
    >
      <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted">Needs your word</h2>
      <p className="text-sm font-medium leading-6 text-foreground">{title}</p>
      <ul className="flex flex-col gap-1.5">
        {whatItDoes.map((line, i) => (
          <li key={i} className="flex gap-2 text-sm leading-6 text-foreground">
            <span aria-hidden className="text-accent">·</span>
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-5 text-muted">{cost}</p>
      <p className="text-xs leading-5 text-muted">{reason}</p>
      {note ? <p className="text-xs leading-5 text-muted">{note}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onApprove}
          className="h-11 rounded-md border border-accent/50 px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent hover:bg-accent/10"
        >
          Build this way
        </button>
        <button
          type="button"
          onClick={onDeny}
          className="h-11 rounded-md border border-line px-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted hover:text-foreground"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
