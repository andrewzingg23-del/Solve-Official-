"use client";

// Horizon: the universal intent surface. Language and selection go in; the World answers with a
// spatial consequence, one concise explanation and at most three next actions. Every statement
// carries its truth kind.
//
// The ask bar is the one primary action of the home screen: a single glowing pill.
import { useEffect, useRef, useState } from "react";
import type { HorizonResult, ProposedAction } from "@/lib/world/presentation";
import { glassCard } from "@/app/ui";

const SUGGESTIONS = [
  "Help me launch my insurance agency with the least upfront capital possible",
  "Where did my money go?",
  "Is my DEV-SOLVE real?",
];

export function Horizon(props: {
  busy: boolean;
  result: HorizonResult | null;
  provider: string;
  onSubmit(text: string): void;
  onAction(action: ProposedAction): void;
}) {
  const { busy, result, provider, onSubmit, onAction } = props;
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const submit = (value: string) => {
    if (!value.trim() || busy) return;
    onSubmit(value.trim());
    setText("");
  };

  return (
    <div className="pointer-events-auto flex w-full flex-col gap-2.5">
      <div aria-live="polite" className="flex flex-col gap-2">
        {result && (
          <div className={`${glassCard} flex flex-col gap-2 p-4`}>
            {result.statements.map((s, i) => (
              <p key={i} className="flex items-start gap-2 text-sm leading-6">
                <span className="mt-0.5 shrink-0 rounded-sm border border-line px-1.5 text-[10px] uppercase leading-5 tracking-[0.16em] text-muted">{s.truth}</span>
                <span>{s.text}</span>
              </p>
            ))}
            {result.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {result.actions.map((a) => (
                  <button key={a.id} type="button" disabled={busy} title={a.consequence} onClick={() => onAction(a)} className="rounded-full border border-accent/60 px-4 py-2 text-xs uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50">
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {!result && !busy && (
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => submit(s)} className="max-w-full truncate rounded-full border border-line bg-surface/70 px-3 py-1.5 text-xs text-muted backdrop-blur hover:border-accent hover:text-accent">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      {/* The one primary action: a single glowing pill. */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-center gap-2 rounded-full border border-accent/40 bg-surface/85 py-2 pl-5 pr-2 shadow-[0_0_40px_rgb(34_211_238/0.18)] backdrop-blur-xl transition-shadow duration-300 ease-calm focus-within:border-accent focus-within:shadow-[0_0_56px_rgb(34_211_238/0.32)]"
      >
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${busy ? "animate-pulse bg-accent" : "bg-accent/70"}`} />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="What do you want to make real?"
          placeholder="What do you want to make real?"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-faint"
          disabled={busy}
        />
        <button
          type="submit"
          aria-label="Ask"
          disabled={busy}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent text-xl font-bold text-accent-ink shadow-[0_0_24px_rgb(34_211_238/0.45)] transition-all duration-300 ease-calm hover:brightness-110 active:scale-95 disabled:opacity-50"
        >
          <span aria-hidden="true">→</span>
        </button>
      </form>
      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted/70">{provider}</p>
    </div>
  );
}
