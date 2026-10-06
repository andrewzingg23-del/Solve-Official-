"use client";

import { useEffect, useState } from "react";

// Bot presence bound to the real chat backend. The chat route is
// POST-only, so GET returning 405 proves it is alive; anything else
// (network error, other status) = unreachable. The dot pulses only
// when the backend is actually reachable — never animated fake activity.
export function BotPulse() {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/bot/chat", { method: "GET" })
      .then((res) => {
        if (!cancelled) setOnline(res.status === 405);
      })
      .catch(() => {
        if (!cancelled) setOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span
        aria-hidden="true"
        className={
          online === true
            ? "h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
            : "h-1.5 w-1.5 rounded-full bg-current opacity-30"
        }
      />
      {online === null ? "Checking bot…" : online ? "Bot online" : "Bot unreachable"}
    </span>
  );
}
