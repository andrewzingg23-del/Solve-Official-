"use client";

import { useState } from "react";
import { askRoom } from "./room-ai-actions";
import { ASK_QUESTION_MAX } from "@/lib/community/room-ai";

const ERRORS: Record<string, string> = {
  join: "Join this community to ask the room.",
  noconfig: "The room AI isn't connected on this deployment yet.",
  model: "That didn't come through. Try again in a moment.",
  unavailable: "The room's discussion isn't reachable right now.",
  missing: "This community is gone.",
  empty: "Ask something first.",
  long: `Keep it under ${ASK_QUESTION_MAX} characters.`,
};

const input =
  "h-11 rounded-md border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent";

// Ask the room: answers drawn only from the room's own discussion, every claim
// attributed to the member who said it.
export function AskRoom({ id }: { id: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await askRoom(id, question);
      if ("answer" in res) {
        setAnswer(res.answer);
      } else {
        setError(ERRORS[res.error] ?? ERRORS.model);
      }
    } catch {
      setError(ERRORS.model);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="ask-room-heading" className="flex flex-col gap-3 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Ask the room</p>
      <h2 id="ask-room-heading" className="sr-only">Ask the room</h2>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor="ask-room-input" className="sr-only">Your question</label>
        <input
          id="ask-room-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={ASK_QUESTION_MAX}
          placeholder="What did the room conclude about…?"
          className={input}
          disabled={busy}
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-semibold text-background transition-opacity disabled:opacity-40"
        >
          {busy ? "Asking…" : "Ask"}
        </button>
      </form>
      {error ? (
        <p role="alert" className="text-sm leading-6 text-negative">{error}</p>
      ) : null}
      {answer ? (
        <div className="border-t border-line-soft pt-3">
          <p className="whitespace-pre-line text-sm leading-6">{answer}</p>
          <p className="mt-2 text-xs leading-5 text-faint">From the room&apos;s own discussion — check the notes below for full context.</p>
        </div>
      ) : null}
    </section>
  );
}
