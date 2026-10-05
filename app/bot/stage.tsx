"use client";

// The bot's stage: a quiet room with a lit floor, the construct that a World assembles on. The
// character stands on it; a plain Character | Reach switch shows what the bot can reach instead,
// from real records. No HUD: the brand is the person and the world, not interface chrome.
import { useState } from "react";
import type { MachineData } from "@/lib/bot/machine";
import type { Persona } from "@/lib/bot/persona";
import { BotCharacter, STATE_LABELS, type BotState } from "./character";
import { MachineReadouts, MachineView } from "./machine-view";

const QUIET: BotState[] = ["unavailable", "sleeping"];
const VIEWS = [
  ["character", "Character"],
  ["reach", "Reach"],
] as const;

export function AgentStage({ persona, state, size = 260, note, machine }: { persona: Persona; state: BotState; size?: number; note?: string; machine?: MachineData }) {
  const live = !QUIET.includes(state);
  const [view, setView] = useState<(typeof VIEWS)[number][0]>("character");
  const showReach = view === "reach" && machine;
  return (
    <div className="relative isolate flex flex-col items-center overflow-hidden rounded-md border border-line bg-[#05080e] px-5 pb-5 pt-5">
      {/* The floor: a horizon and a soft pool of light where the character stands. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 top-[58%] -z-10 border-t border-line bg-gradient-to-b from-[#0a1019] to-[#05080e]" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[50%] -z-10 mx-auto h-[22%] w-[70%] rounded-[50%] bg-white/[0.035] blur-2xl" />

      <div className="flex w-full items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-medium">{persona.name}</span>
        <span className={`flex shrink-0 items-center gap-2 text-[11px] uppercase tracking-[0.2em] ${live ? "text-foreground" : "text-muted"}`}>
          {live ? <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}
          {STATE_LABELS[state]}
        </span>
      </div>

      {showReach ? (
        <MachineView persona={persona} state={state} machine={machine} size={size} />
      ) : (
        <div className="relative grid aspect-square w-full place-items-center" style={{ maxWidth: size * 1.2 }}>
          <BotCharacter persona={persona} state={state} size={size} className="relative h-auto w-[82%]" />
        </div>
      )}

      <div className="flex w-full flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        {machine ? (
          <div className="flex gap-4 text-[11px] uppercase tracking-[0.2em]" role="group" aria-label="Stage view">
            {VIEWS.map(([v, name]) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`border-b pb-0.5 uppercase tracking-[0.2em] transition-colors duration-300 ease-calm ${view === v ? "border-foreground text-foreground" : "border-transparent text-muted hover:text-foreground"}`}
              >
                {name}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        {!showReach ? (
          <span className="text-[11px] capitalize text-muted">
            {persona.material} · {persona.motion.idle} · energy {persona.motion.energy}
          </span>
        ) : null}
      </div>
      {showReach ? <MachineReadouts machine={machine} /> : null}
      {note ? <p className="mt-3 text-center text-[11px] text-muted">{note}</p> : null}
    </div>
  );
}
