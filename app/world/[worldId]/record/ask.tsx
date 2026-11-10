"use client";

import { useActionState, useState } from "react";
import { askForConfirmation, type AskResult } from "./actions";

// The owner asks one named person to confirm this thing, and gets a link to send them.
// Placeholders are deliberately general: the product supplies no vocabulary from any one trade.
export function AskForConfirmation({ worldId, entityId }: { worldId: string; entityId: string }) {
  const [state, action, pending] = useActionState<AskResult, FormData>(askForConfirmation, null);
  const [copied, setCopied] = useState<"idle" | "copied" | "failed">("idle");

  if (state?.ok) {
    const link = typeof window === "undefined" ? state.path : window.location.origin + state.path;
    return <div className="s-stack" role="status" aria-live="polite" data-ask-done>
      <p><strong>Your link is ready.</strong> Send it to the person you asked. Whoever holds it can see this one thing and answer — nothing else of yours.</p>
      <input readOnly value={link} aria-label="Confirmation link" className="s-input" onFocus={event => event.currentTarget.select()} />
      <div><button type="button" className="s-button" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied("copied"), () => setCopied("failed"))}>
        {copied === "copied" ? "Copied" : "Copy link"}
      </button></div>
      {copied === "failed" ? <p className="s-muted s-small">Couldn&apos;t copy automatically. Select the link above and copy it.</p> : null}
      <p className="s-muted s-small">This link is shown once and isn&apos;t stored anywhere. If you lose it, ask again.</p>
    </div>;
  }

  return <form action={action} className="s-stack" aria-label="Ask someone to confirm this">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="entityId" value={entityId} />
    <p className="s-muted">Ask someone other than you to say whether this happened. Their answer is theirs, so it means something to anyone.</p>
    <label className="s-stack" style={{ "--gap": "8px" } as React.CSSProperties}><span className="s-small">Who are you asking?</span>
      <input name="askedOf" required maxLength={200} placeholder="Their name" autoComplete="off" className="s-input" />
    </label>
    <label className="s-stack" style={{ "--gap": "8px" } as React.CSSProperties}><span className="s-small">What should they confirm?</span>
      <input name="question" maxLength={500} placeholder="That it happened as agreed" autoComplete="off" className="s-input" />
    </label>
    <div><button type="submit" className="s-button" disabled={pending}>{pending ? "Recording…" : "Ask someone to confirm this"}</button></div>
    {state && !state.ok ? <p role="alert" className="s-error">{state.error}</p> : null}
  </form>;
}
