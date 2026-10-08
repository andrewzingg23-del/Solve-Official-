"use client";

import { useState, useTransition } from "react";
import { saveKnowYou } from "../actions";
import { Reveal } from "../fx";
import { primaryAction, glassCard } from "@/app/ui";

// Step 6: the assistant gets to know you. Scripted questions in a
// conversational shape — real questions, real saved answers, never fake replies.
// Until the chat key is live, the honest "waking up" state shows instead.
const QUESTIONS = [
  { id: "name", ask: "What should I call you?" },
  { id: "building", ask: "What are you building right now?" },
  { id: "push", ask: "How do you want to be pushed — gentle nudge or hard truth?" },
  { id: "win", ask: "What does a win look like for you this month?" },
];

export function KnowYouStep({ signedIn, chatReady }: { signedIn: boolean; chatReady: boolean }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  if (!chatReady) {
    return (
      <Reveal>
        <div className={`${glassCard} fx-stamp fx-card flex flex-col items-center gap-4 p-8 text-center`}>
          <div aria-hidden className="h-8 w-8 animate-pulse rounded-full bg-accent/30" />
          <p className="text-lg font-medium tracking-tight">Your assistant is still waking up.</p>
          <p className="text-sm leading-6 text-muted">
            This conversation unlocks when it does. Everything else you shaped is saved.
          </p>
          <a href="/avatar" className={primaryAction}>
            Meet your bot
          </a>
        </div>
      </Reveal>
    );
  }

  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await saveKnowYou(answers);
      if (result.ok) setDone(true);
      else setError(result.error ?? "Couldn't save. Try again.");
    });
  };

  if (done) {
    return (
      <Reveal>
        <div className={`${glassCard} fx-card flex flex-col items-center gap-4 p-8 text-center`}>
          <p className="text-lg font-medium tracking-tight">Noted. I&apos;ll remember this.</p>
          <a href="/avatar" className={primaryAction}>
            Meet your bot
          </a>
        </div>
      </Reveal>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {QUESTIONS.map((q, i) => (
        <Reveal key={q.id} delay={40 + i * 80}>
          <div className="flex flex-col gap-2">
            <p className="text-sm leading-6">
              <span className="text-faint tabular-nums">{i + 1}. </span>
              {q.ask}
            </p>
            <input
              type="text"
              value={answers[q.id] ?? ""}
              onChange={(e) => set(q.id, e.target.value)}
              disabled={!signedIn}
              maxLength={500}
              className="fx-field h-12 rounded-2xl border border-line bg-surface px-4 text-sm outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60"
            />
          </div>
        </Reveal>
      ))}
      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      {!signedIn ? (
        <Reveal delay={360}>
          <p className="text-xs text-faint">Sign in to let your bot remember your answers.</p>
        </Reveal>
      ) : (
        <Reveal delay={360}>
          <button type="button" onClick={finish} disabled={busy} className={`${primaryAction} w-full disabled:opacity-60`}>
            {busy ? "Saving…" : "That's me"}
          </button>
        </Reveal>
      )}
    </div>
  );
}
