"use client";

import { useActionState } from "react";
import { answerConfirmationAction, type AnswerResult } from "./actions";

export function AnswerForm({ token, askedBy }: { token: string; askedBy: string }) {
  const [state, action, pending] = useActionState<AnswerResult, FormData>(answerConfirmationAction, null);

  if (state?.ok) {
    return <div className="solve-answer-done" role="status" aria-live="polite">
      <p><strong>Your answer is recorded: {state.decision === "confirmed" ? "confirmed" : "disputed"}.</strong></p>
      <p className="solve-muted">{askedBy} can now see it, along with who answered and when. It can&apos;t be changed later, and it doesn&apos;t give you access to anything else of theirs.</p>
    </div>;
  }

  return <form action={action} className="solve-answer" aria-label="Answer this request">
    <input type="hidden" name="token" value={token} />
    <label className="solve-field-label">Anything to add? <span className="solve-muted">(optional)</span>
      <textarea name="note" maxLength={2000} rows={3} placeholder="Say what you saw, in your own words" />
    </label>
    <div className="solve-answer-actions">
      <button type="submit" name="decision" value="confirmed" className="solve-button" disabled={pending}>Confirm</button>
      <button type="submit" name="decision" value="disputed" className="solve-button solve-button-secondary" disabled={pending}>Dispute</button>
    </div>
    <p className="solve-muted">Your answer is recorded under your name and can&apos;t be changed afterwards. Answering gives you no access to anything else.</p>
    {state && !state.ok ? <p role="alert" className="solve-error">{state.error}</p> : null}
  </form>;
}
