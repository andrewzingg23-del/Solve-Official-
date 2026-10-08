"use client";

import { useEffect, useState } from "react";
import { getRoomBrief } from "./room-ai-actions";

const ERRORS: Record<string, string> = {
  join: "Join this community and your bot will brief you on the room.",
  noconfig: "The room AI isn't connected on this deployment yet.",
  model: "The brief didn't come through. Try again in a moment.",
  unavailable: "The room's activity isn't reachable right now.",
  missing: "This community is gone.",
};

// The bot's brief on the room: what happened since your last visit, who's
// saying what matters, open questions. Cached 30 minutes per reader.
export function RoomBrief({ id, botName }: { id: string; botName: string }) {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    void getRoomBrief(id).then((res) => {
      if (!alive) return;
      if ("brief" in res) setText(res.brief.text);
      else setError(ERRORS[res.error] ?? ERRORS.model);
      setDone(true);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  if (!done) {
    return (
      <section aria-label="Room brief" className="rounded-md border border-line bg-surface/60 p-4 md:p-5">
        <p className="text-xs text-muted">{botName} is reading the room…</p>
      </section>
    );
  }
  if (error || !text) return null;
  return (
    <section aria-labelledby="room-brief-heading" className="flex flex-col gap-2 rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">
        {botName} on this room
      </p>
      <h2 id="room-brief-heading" className="sr-only">Room brief</h2>
      <p className="whitespace-pre-line text-sm leading-6">{text}</p>
    </section>
  );
}
