"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type SyncState = "connecting" | "live" | "reconnecting";

export function WorldLiveSync({ worldId, authUserId }: { worldId: string; authUserId: string }) {
  const router = useRouter();
  const [state, setState] = useState<SyncState>("connecting");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`world-live:${authUserId}`, { config: { private: true } })
      .on("broadcast", { event: "world.changed" }, ({ payload }) => {
        if (payload?.world_id === worldId) router.refresh();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setState("live");
          // Revalidate after every successful reconnect to recover signals missed while offline.
          router.refresh();
        } else {
          setState("reconnecting");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [authUserId, router, worldId]);

  const label = state === "live" ? "Live sync" : state === "connecting" ? "Connecting…" : "Reconnecting…";
  const dot = state === "live" ? "bg-positive" : "bg-muted";
  return (
    <span aria-live="polite" className="inline-flex items-center gap-2" title="Saved changes sync from the World kernel">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
