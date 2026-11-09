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
    return <div className="solve-ask-done" role="status" aria-live="polite">
      <p><strong>Your link is ready.</strong> Send it to the person you asked. Whoever holds it can see this one thing and answer — nothing else of yours.</p>
      <input readOnly value={link} aria-label="Confirmation link" className="solve-link-field" onFocus={event => event.currentTarget.select()} />
      <button type="button" className="solve-button" onClick={() => navigator.clipboard?.writeText(link).then(() => setCopied("copied"), () => setCopied("failed"))}>
        {copied === "copied" ? "Copied" : "Copy link"}
      </button>
      {copied === "failed" ? <p className="solve-muted">Couldn&apos;t copy automatically. Select the link above and copy it.</p> : null}
      <p className="solve-muted">This link is shown once and isn&apos;t stored anywhere. If you lose it, ask again.</p>
    </div>;
  }

  return <form action={action} className="solve-ask" aria-label="Ask someone to confirm this">
    <input type="hidden" name="worldId" value={worldId} />
    <input type="hidden" name="entityId" value={entityId} />
    <label className="solve-field-label">Who are you asking?
      <input name="askedOf" required maxLength={200} placeholder="Their name" autoComplete="off" />
    </label>
    <label className="solve-field-label">What should they confirm?
      <input name="question" maxLength={500} placeholder="That it happened as agreed" autoComplete="off" />
    </label>
    <button type="submit" className="solve-button" disabled={pending}>{pending ? "Recording…" : "Ask someone to confirm this"}</button>
    {state && !state.ok ? <p role="alert" className="solve-error">{state.error}</p> : null}
  </form>;
}
