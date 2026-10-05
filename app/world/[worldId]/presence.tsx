"use client";

import { useEffect, useState } from "react";
import { presenceHeartbeat, presenceList, type PresentActor } from "./presence-actions";

const HEARTBEAT_MS = 30_000;
const POLL_MS = 15_000;

export function WorldPresence({ worldId }: { worldId: string }) {
  const [people, setPeople] = useState<PresentActor[] | null>(null);

  useEffect(() => {
    let alive = true;
    const beat = () => void presenceHeartbeat(worldId);
    const poll = async () => {
      const list = await presenceList(worldId);
      if (alive) setPeople(list);
    };
    beat();
    poll();
    const beatTimer = setInterval(beat, HEARTBEAT_MS);
    const pollTimer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(beatTimer);
      clearInterval(pollTimer);
    };
  }, [worldId]);

  if (!people || people.length === 0) return null;
  return (
    <p aria-live="polite" className="text-xs text-muted">
      Here now: {people.map((p) => p.label).join(", ")}
    </p>
  );
}
