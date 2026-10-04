"use client";

// The bot's stage: a HUD around the character, with the brand's vignette and grain and a plain
// readout of its state and build. The HUD is interface, so it keeps the brand's single cyan; the
// character inside keeps its own colors.
import type { Persona } from "@/lib/bot/persona";
import { BotCharacter, STATE_LABELS, type BotState } from "./character";

const GRAIN = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='.55'/></svg>")`;

const QUIET: BotState[] = ["unavailable", "sleeping"];

export function AgentStage({ persona, state, size = 260, note }: { persona: Persona; state: BotState; size?: number; note?: string }) {
  const ticks = Array.from({ length: 72 }, (_, i) => i);
  const live = !QUIET.includes(state);
  return (
    <div className="relative isolate flex flex-col items-center overflow-hidden rounded-md border border-line bg-[#03060b] px-4 pb-5 pt-12">
      <style>{`
        .sovstage-spin{animation:sovstage-spin 40s linear infinite;transform-origin:50% 50%}
        .sovstage-spin-r{animation:sovstage-spin 64s linear infinite reverse;transform-origin:50% 50%}
        .sovstage-sweep{animation:sovstage-spin 9s linear infinite;transform-origin:50% 50%}
        @keyframes sovstage-spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion: reduce){.sovstage-spin,.sovstage-spin-r,.sovstage-sweep{animation:none}}
      `}</style>
      {/* Character glow, vignette and grain. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: `radial-gradient(55% 50% at 50% 46%, ${persona.palette.glow}2e, transparent 72%)` }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: "radial-gradient(85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,.72) 100%)" }} />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 opacity-[0.07] mix-blend-overlay" style={{ backgroundImage: GRAIN }} />

      {/* Corner brackets. */}
      {["left-3 top-3 border-l border-t", "right-3 top-3 border-r border-t", "left-3 bottom-3 border-l border-b", "right-3 bottom-3 border-r border-b"].map((c) => (
        <span key={c} aria-hidden className={`pointer-events-none absolute h-5 w-5 border-accent/50 ${c}`} />
      ))}

      {/* Readouts. */}
      <div className="absolute inset-x-6 top-5 flex items-center justify-between gap-3 text-[10px] font-medium uppercase tracking-[0.28em]">
        <span className="min-w-0 truncate text-muted">Agent · {persona.name}</span>
        <span className={`flex shrink-0 items-center gap-2 text-right ${live ? "text-accent" : "text-muted"}`}>
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${live ? "bg-accent" : "bg-muted"}`} />
          {STATE_LABELS[state]}
        </span>
      </div>

      <div className="relative grid aspect-square w-full place-items-center" style={{ maxWidth: size * 1.28 }}>
        <svg aria-hidden viewBox="0 0 200 200" className="absolute inset-0 h-full w-full">
          <g className="sovstage-spin" stroke="var(--accent)" fill="none">
            {ticks.map((i) => (
              <line key={i} x1="100" y1="3" x2="100" y2={i % 6 === 0 ? 10 : 6} strokeOpacity={i % 6 === 0 ? 0.45 : 0.18} strokeWidth={i % 6 === 0 ? 0.8 : 0.5} transform={`rotate(${i * 5} 100 100)`} />
            ))}
          </g>
          <circle cx="100" cy="100" r="86" fill="none" stroke="var(--accent)" strokeOpacity={0.14} strokeWidth={0.6} strokeDasharray="1 3" className="sovstage-spin-r" />
          <circle cx="100" cy="100" r="78" fill="none" stroke="var(--line)" strokeWidth={0.6} />
          {live && (
            <g className="sovstage-sweep">
              <path d="M100 22 A78 78 0 0 1 155 45" fill="none" stroke="var(--accent)" strokeOpacity={0.6} strokeWidth={1.2} strokeLinecap="round" />
            </g>
          )}
        </svg>
        <BotCharacter persona={persona} state={state} size={size} className="relative h-auto w-[78%]" />
      </div>

      <div className="mt-1 grid w-full max-w-md grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line text-center text-[10px] uppercase tracking-[0.22em]">
        {[
          ["Finish", persona.material],
          ["Motion", persona.motion.idle],
          ["Energy", String(persona.motion.energy)],
        ].map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col gap-1 bg-[#03060b] px-2 py-2">
            <span className="truncate text-muted">{k}</span>
            <span className="truncate tabular-nums text-foreground">{v}</span>
          </div>
        ))}
      </div>
      {note ? <p className="mt-3 text-center text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}
