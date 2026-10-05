"use client";

// The bot as it is right now: its mood comes from what really happened (a memory an assistant just
// added, a new connection, a quiet week), refreshed while the page is visible. While a connected
// assistant is using the bot, a private live signal shows who is doing what (never content). The
// numbers under it are counts of kernel records, not game stats.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { label } from "@/app/ui";
import type { Persona } from "@/lib/bot/persona";
import { describeActivity, PRESENCE_EVENT, presenceTopic } from "@/lib/bot/presence";
import type { Pulse } from "@/lib/bot/pulse";
import { createClient } from "@/lib/supabase/client";
import { pulseAction } from "./actions";
import { BotCharacter, type BotState } from "./character";

const REFRESH_MS = 15_000;
// How long the bot shows an assistant at work after its last call.
const WORKING_MS = 8_000;

export function LiveBot({ persona, initial, userId }: { persona: Persona; initial: Pulse; userId?: string }) {
  const [pulse, setPulse] = useState(initial);
  const [working, setWorking] = useState<{ line: string; state: BotState } | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    if (document.visibilityState !== "visible") return;
    const next = await pulseAction().catch(() => null);
    if (alive.current && next) setPulse(next);
  }, []);

  useEffect(() => {
    alive.current = true;
    const timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let done: ReturnType<typeof setTimeout> | undefined;
    let open = true;
    (async () => {
      // Private channels authorize with the person's own session.
      await supabase.realtime.setAuth();
      if (!open) return;
      channel = supabase
        .channel(presenceTopic(userId), { config: { private: true } })
        .on("broadcast", { event: PRESENCE_EVENT }, ({ payload }) => {
          const a = (payload ?? {}) as { tool?: unknown; client?: unknown };
          if (typeof a.tool !== "string" || typeof a.client !== "string") return;
          setWorking({ line: describeActivity({ tool: a.tool, client: a.client }, persona.name), state: a.tool === "remember" ? "working" : "thinking" });
          clearTimeout(done);
          done = setTimeout(() => {
            setWorking(null);
            void refresh();
          }, WORKING_MS);
        })
        .subscribe();
    })().catch(() => null);
    return () => {
      open = false;
      clearTimeout(done);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, persona.name, refresh]);

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
        <BotCharacter persona={persona} state={working?.state ?? pulse.mood} size={120} className="shrink-0" />
        <div className="relative flex min-w-0 flex-col gap-1 rounded-md border border-line bg-background px-4 py-3">
          <span aria-hidden className="absolute -left-1.5 top-6 h-3 w-3 rotate-45 border-b border-l border-line bg-background" />
          <p className="text-sm leading-6" aria-live="polite">{working ? `${working.line}…` : pulse.line}</p>
          {working ? <p className="text-xs text-accent">Live now</p> : pulse.latest ? <p className="text-xs text-muted">{pulse.latest.what} · {pulse.latest.at}</p> : null}
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
