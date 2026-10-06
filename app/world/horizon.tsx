"use client";

// Horizon: the universal intent surface. Language and selection go in; the World answers with a
// spatial consequence, one concise explanation and at most three next actions. Every statement
// carries its truth kind.
import { useEffect, useRef, useState } from "react";
import type { HorizonResult, ProposedAction } from "@/lib/world/presentation";

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
    <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 mx-auto flex max-w-2xl flex-col gap-2 md:bottom-6">
      <div aria-live="polite" className="flex flex-col gap-2">
        {result && (
          <div className="flex flex-col gap-2 rounded-md border border-line bg-surface/90 p-4 backdrop-blur-md">
            {result.statements.map((s, i) => (
              <p key={i} className="flex items-start gap-2 text-sm leading-6">
                <span className="mt-0.5 shrink-0 rounded-sm border border-line px-1.5 text-[10px] uppercase leading-5 tracking-[0.16em] text-muted">{s.truth}</span>
                <span>{s.text}</span>
              </p>
            ))}
            {result.actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {result.actions.map((a) => (
                  <button key={a.id} type="button" disabled={busy} title={a.consequence} onClick={() => onAction(a)} className="rounded-md border border-accent/60 px-3 py-1.5 text-xs uppercase tracking-[0.16em] text-accent transition-colors hover:bg-accent/10 disabled:opacity-50">
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
              <button key={s} type="button" onClick={() => submit(s)} className="rounded-full border border-line bg-surface/70 px-3 py-1 text-xs text-muted backdrop-blur hover:border-accent hover:text-accent">
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(text);
        }}
        className="flex items-center gap-2 rounded-md border border-line bg-surface/90 px-4 backdrop-blur-md focus-within:border-accent"
      >
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${busy ? "animate-pulse bg-accent" : "bg-accent/70"}`} />
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="What do you want to make real?"
          placeholder="What do you want to make real?"
          className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
          disabled={busy}
        />
        <kbd className="hidden rounded border border-line px-1.5 text-[10px] text-muted md:inline">/</kbd>
      </form>
      <p className="text-center text-[10px] uppercase tracking-[0.18em] text-muted/70">{provider}</p>
    </div>
  );
}
