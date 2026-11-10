"use client";

import { useActionState } from "react";
import { answerConfirmationAction, type AnswerResult } from "./actions";

export function AnswerForm({ token, askedBy }: { token: string; askedBy: string }) {
  const [state, action, pending] = useActionState<AnswerResult, FormData>(answerConfirmationAction, null);

  if (state?.ok) {
    return <div className="s-stack" role="status" aria-live="polite" data-answer-done>
      <p><strong>Your answer is recorded: {state.decision === "confirmed" ? "confirmed" : "disputed"}.</strong></p>
      <p className="s-muted">{askedBy} can now see it, along with who answered and when. It can&apos;t be changed later, and it doesn&apos;t give you access to anything else of theirs.</p>
    </div>;
  }

  return <form action={action} className="s-stack" aria-label="Answer this request">
    <input type="hidden" name="token" value={token} />
    <label className="s-stack" style={{ "--gap": "8px" } as React.CSSProperties}><span className="s-small">Anything to add? <span className="s-muted">(optional)</span></span>
      <textarea name="note" maxLength={2000} rows={3} placeholder="Say what you saw, in your own words" className="s-textarea" />
    </label>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      <button type="submit" name="decision" value="confirmed" className="s-button" disabled={pending}>Confirm</button>
      <button type="submit" name="decision" value="disputed" className="s-button" data-variant="quiet" disabled={pending}>Dispute</button>
    </div>
    <p className="s-muted s-small">Your answer is recorded under your name and can&apos;t be changed afterwards. Answering gives you no access to anything else.</p>
    {state && !state.ok ? <p role="alert" className="s-error">{state.error}</p> : null}
  </form>;
}
