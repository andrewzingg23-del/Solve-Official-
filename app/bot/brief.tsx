"use client";

import { useEffect, useState } from "react";
import { getBrief } from "./brief-actions";

export function WhileYouWereAway({ botName }: { botName: string }) {
  const [text, setText] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void getBrief().then((brief) => {
      if (alive) {
        setText(brief?.text ?? null);
        setDone(true);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!done) {
    return (
      <section aria-label="While you were away" className="rounded-md border border-line bg-surface/60 p-4 md:p-5">
        <p className="text-xs text-muted">{botName} is looking over your Worlds…</p>
      </section>
    );
  }
  if (!text) return null;
  return (
    <section aria-labelledby="away-heading" className="flex flex-col gap-2 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">While you were away</p>
      <h2 id="away-heading" className="sr-only">What {botName} noticed</h2>
      <p className="whitespace-pre-line text-sm leading-6">{text}</p>
    </section>
  );
}
