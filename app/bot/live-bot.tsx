"use client";

// The bot as it is right now: its mood comes from what really happened (a memory an assistant just
// added, a new connection, a quiet week), refreshed while the page is visible. The numbers under it
// are counts of kernel records, not game stats.
import { useEffect, useState } from "react";
import { label } from "@/app/ui";
import type { Persona } from "@/lib/bot/persona";
import type { Pulse } from "@/lib/bot/pulse";
import { pulseAction } from "./actions";
import { BotCharacter } from "./character";

const REFRESH_MS = 15_000;

export function LiveBot({ persona, initial }: { persona: Persona; initial: Pulse }) {
  const [pulse, setPulse] = useState(initial);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const next = await pulseAction().catch(() => null);
      if (alive && next) setPulse(next);
    };
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);

  const { bond } = pulse;
  const stats: [string, string][] = [
    [String(bond.days), bond.days === 1 ? "day together" : "days together"],
    [bond.memories >= 200 ? "200+" : String(bond.memories), bond.memories === 1 ? "memory kept" : "memories kept"],
    [String(bond.assistants), bond.assistants === 1 ? "assistant connected" : "assistants connected"],
    [String(bond.versions), bond.versions === 1 ? "look" : "looks"],
  ];

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-surface p-5">
      <p className={label}>{persona.name} right now</p>
      <div className="flex items-center gap-4">
        <BotCharacter persona={persona} state={pulse.mood} size={120} className="shrink-0" />
        <div className="relative flex min-w-0 flex-col gap-1 rounded-md border border-line bg-background px-4 py-3">
          <span aria-hidden className="absolute -left-1.5 top-6 h-3 w-3 rotate-45 border-b border-l border-line bg-background" />
          <p className="text-sm leading-6" aria-live="polite">{pulse.line}</p>
          {pulse.latest ? <p className="text-xs text-muted">{pulse.latest.what} · {pulse.latest.at}</p> : null}
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(([value, name]) => (
          <div key={name} className="flex flex-col rounded-md border border-line px-3 py-2">
            <dt className="order-2 text-[11px] text-muted">{name}</dt>
            <dd className="order-1 text-lg font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
