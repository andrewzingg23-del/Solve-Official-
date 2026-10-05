"use client";

// Who is working with your bot right now, from the private presence signal (never content). Shows
// for a few seconds after each call, then goes quiet.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { describeActivity, PRESENCE_EVENT, presenceTopic } from "@/lib/bot/presence";
import { createClient } from "@/lib/supabase/client";

const SHOW_MS = 8_000;

export function LiveLine({ userId, botName }: { userId: string; botName: string }) {
  const [line, setLine] = useState<string | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | null = null;
    let quiet: ReturnType<typeof setTimeout> | undefined;
    let open = true;
    (async () => {
      await supabase.realtime.setAuth();
      if (!open) return;
      channel = supabase
        .channel(presenceTopic(userId), { config: { private: true } })
        .on("broadcast", { event: PRESENCE_EVENT }, ({ payload }) => {
          const a = (payload ?? {}) as { tool?: unknown; client?: unknown };
          if (typeof a.tool !== "string" || typeof a.client !== "string") return;
          setLine(describeActivity({ tool: a.tool, client: a.client }, botName));
          clearTimeout(quiet);
          quiet = setTimeout(() => setLine(null), SHOW_MS);
        })
        .subscribe();
    })().catch(() => null);
    return () => {
      open = false;
      clearTimeout(quiet);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId, botName]);
  return (
    <p aria-live="polite" className="text-xs leading-5 text-muted">
      {line ? <span className="text-foreground">Now: {line}</span> : "Quiet right now."}
    </p>
  );
}
