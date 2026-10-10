"use client";

// "What I already know about you": the avatar's first-minute moment, under the hero.
//
// Before it has much to go on, it asks for what you've told your other AIs: ChatGPT history and
// connected assistants feed one memory. Once it has enough, one tap and it reads it all and says
// back what matters, one line at a time, its ring filling as it goes. Every line shows where it was
// learned; tap a source to see the words and open the memory.
//
// Style and ergonomics: one primary action, full width under the thumb on a phone; targets at
// least 44px; a readable measure; motion is assembly, and it stops for reduced motion; the list is
// announced politely and focus moves to it, so it works without seeing the animation.
import { useEffect, useRef, useState } from "react";
import { eyebrow, primaryAction, secondaryAction } from "@/app/ui";
import type { KnownFact } from "@/lib/bot/knowing";

type Usage = { modelLabel?: string; estimatedCostUsd?: number };
type Result = { facts: KnownFact[]; read: number; total: number; usage: Usage | null };

const REVEAL_CSS = `
.knows-ring{--p:0;background:conic-gradient(var(--accent) calc(var(--p)*1%),rgb(242 247 251/.08) 0);transition:--p .6s var(--ease-calm)}
@property --p{syntax:'<number>';inherits:false;initial-value:0}
.knows-line{animation:knows-in .5s var(--ease-calm) both}
@keyframes knows-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.knows-shimmer{background:linear-gradient(90deg,rgb(242 247 251/.05),rgb(242 247 251/.12),rgb(242 247 251/.05));background-size:200% 100%;animation:knows-shimmer 1.4s linear infinite}
@keyframes knows-shimmer{to{background-position:-200% 0}}
@media (prefers-reduced-motion:reduce){.knows-line,.knows-shimmer{animation:none}.knows-ring{transition:none}}
`;

const money = (usd?: number) => (typeof usd === "number" && usd > 0 ? (usd < 0.01 ? "under 1¢" : `about ${Math.round(usd * 100)}¢`) : null);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(q.matches);
    update();
    q.addEventListener("change", update);
    return () => q.removeEventListener("change", update);
  }, []);
  return reduced;
}

function Brains({ brains }: { brains: { label: string; count: number }[] }) {
  if (!brains.length) return null;
  return (
    <ul aria-label="What feeds it" className="flex flex-wrap gap-2">
      {brains.slice(0, 5).map((b) => (
        <li key={b.label} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-line bg-surface/60 px-3 text-xs text-muted">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent/70" />
          <span className="text-foreground">{b.label}</span>
          <span className="tabular-nums">{b.count}</span>
        </li>
      ))}
    </ul>
  );
}

function Fact({ fact, onDismiss }: { fact: KnownFact; onDismiss: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const source = fact.sources.find((s) => s.id === open) ?? null;
  return (
    <li className="knows-line flex flex-col gap-3 rounded-2xl border border-line bg-background/55 p-4 md:p-5">
      <p className="text-base leading-7 text-foreground">{fact.text}</p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">Learned from</span>
        {fact.sources.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-expanded={open === s.id}
            onClick={() => setOpen(open === s.id ? null : s.id)}
            className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-xs transition-colors duration-300 ease-calm ${open === s.id ? "border-accent text-accent" : "border-line text-muted hover:border-accent hover:text-accent"}`}
          >
            {s.label}
          </button>
        ))}
        <button type="button" onClick={onDismiss} className="ml-auto inline-flex min-h-11 items-center px-2 text-xs text-faint transition-colors hover:text-foreground">
          Not quite
        </button>
      </div>
      {source ? (
        <div className="flex flex-col gap-2 border-l-2 border-accent/50 pl-3">
          <p className="text-sm leading-6 text-muted">“{source.excerpt}”</p>
          <a href={`#memory-${source.id}`} className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Open this memory</a>
        </div>
      ) : null}
    </li>
  );
}

export function KnowsYou({ botName, face, memoryCount, brains }: { botName: string; face: string; memoryCount: number; brains: { label: string; count: number }[] }) {
  const [state, setState] = useState<"idle" | "reading" | "done" | "error">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(0);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const listRef = useRef<HTMLHeadingElement>(null);
  const reduced = useReducedMotion();
  const ready = memoryCount >= 3;

  // Lines land one at a time, and the ring fills with them. With reduced motion they're all there.
  useEffect(() => {
    if (state !== "done" || !result || reduced) return;
    const timers = result.facts.map((_, i) => window.setTimeout(() => setShown(i + 1), 420 * (i + 1)));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [state, result, reduced]);

  useEffect(() => {
    if (state === "done") listRef.current?.focus();
  }, [state]);

  async function read() {
    setState("reading");
    setError(null);
    setShown(0);
    setDismissed(new Set());
    try {
      const res = await fetch("/api/bot/know", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ botName }) });
      const data = (await res.json()) as Partial<Result> & { error?: string; needMore?: boolean };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "It couldn't read just now.");
      if (data.needMore) throw new Error("It needs a little more to go on first. Bring your ChatGPT history or connect an assistant.");
      setResult({ facts: data.facts ?? [], read: data.read ?? 0, total: data.total ?? memoryCount, usage: data.usage ?? null });
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "It couldn't read just now.");
      setState("error");
    }
  }

  const facts = result?.facts ?? [];
  const visible = reduced ? facts.length : Math.min(shown, facts.length);
  const progress = state === "done" ? Math.round((visible / (facts.length || 1)) * 100) : state === "reading" ? 12 : ready ? 6 : 0;
  const cost = money(result?.usage?.estimatedCostUsd);

  return (
    <section aria-labelledby="knows-heading" className="glass relative overflow-hidden p-5 md:p-8">
      <style>{REVEAL_CSS}</style>
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
        <div className="flex items-center gap-4 md:flex-col md:items-center md:pt-1">
          <div aria-hidden className="knows-ring grid h-20 w-20 shrink-0 place-items-center rounded-full p-[3px] md:h-28 md:w-28" style={{ ["--p" as string]: progress }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={face} alt="" className="h-full w-full rounded-full bg-background object-cover" />
          </div>
          <p className={`${eyebrow} md:text-center`}>What {botName} knows</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {!ready ? (
            <>
              <h2 id="knows-heading" className="max-w-xl text-2xl font-semibold leading-tight tracking-tight md:text-3xl">Bring me what you&apos;ve told your other AIs.</h2>
              <p className="max-w-prose text-sm leading-6 text-muted">
                Your ChatGPT history and any assistant you connect feed one memory, so I&apos;m the same whichever AI is thinking for me. It&apos;s sealed, it&apos;s yours, and you can erase any of it.
              </p>
              <Brains brains={brains} />
              <div className="flex flex-col gap-3 sm:flex-row">
                <a href="#bring-history" className={`${primaryAction} w-full sm:w-auto`}>Bring ChatGPT history</a>
                <a href="#connect-ai" className={`${secondaryAction} w-full sm:w-auto`}>Connect another AI</a>
              </div>
            </>
          ) : state === "done" ? (
            <>
              <h2 id="knows-heading" ref={listRef} tabIndex={-1} className="max-w-xl text-2xl font-semibold leading-tight tracking-tight outline-none md:text-3xl">
                {facts.length ? "Here's what I already know about you." : "I couldn't say anything I'd stand behind yet."}
              </h2>
              {facts.length ? (
                <ol aria-live="polite" className="flex max-w-2xl flex-col gap-3">
                  {facts.slice(0, visible).map((f, i) => (dismissed.has(i) ? null : <Fact key={i} fact={f} onDismiss={() => setDismissed(new Set(dismissed).add(i))} />))}
                </ol>
              ) : (
                <p className="max-w-prose text-sm leading-6 text-muted">Bring more of your history, or tell me about what you&apos;re working on in Talk, and ask again.</p>
              )}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button type="button" onClick={read} className={`${secondaryAction} w-full sm:w-auto`}>Read again</button>
                <p className="text-xs leading-5 text-faint tabular-nums">
                  Read {result?.read ?? 0} of {result?.total ?? memoryCount} memories{result?.usage?.modelLabel ? ` · ${result.usage.modelLabel}` : ""}{cost ? ` · ${cost}` : ""}. Nothing here is saved.
                </p>
              </div>
            </>
          ) : (
            <>
              <h2 id="knows-heading" className="max-w-xl text-2xl font-semibold leading-tight tracking-tight md:text-3xl">What I already know about you.</h2>
              <p className="max-w-prose text-sm leading-6 text-muted">
                I&apos;ll read the {memoryCount >= 200 ? "200+" : memoryCount.toLocaleString("en-US")} things you and your AIs have told me and say back what matters. Every line shows where I learned it.
              </p>
              <Brains brains={brains} />
              {state === "reading" ? (
                <div aria-live="polite" className="flex max-w-2xl flex-col gap-3">
                  <p className="text-sm text-muted">Reading…</p>
                  {[0, 1, 2].map((i) => <div key={i} aria-hidden className="knows-shimmer h-16 rounded-2xl" />)}
                </div>
              ) : (
                <button type="button" onClick={read} className={`${primaryAction} w-full sm:w-auto sm:self-start`}>Show me</button>
              )}
              {error ? <p role="alert" className="max-w-prose text-sm leading-6 text-negative">{error}</p> : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
