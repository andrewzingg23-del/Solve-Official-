"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Ambient bot companion — floats around the viewport edge, never the center.
 * Pulses when there's something new (unread brief). Tap to talk.
 * Respects prefers-reduced-motion: renders static in the corner instead.
 */
export function BotCompanion({ portraitUrl, hasUnread }: { portraitUrl: string | null; hasUnread: boolean }) {
  const router = useRouter();
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return (
    <button
      onClick={() => router.push("/bot")}
      aria-label={hasUnread ? "Your bot has something new — tap to talk" : "Tap to talk to your bot"}
      className={`fixed z-40 ${reduced ? "bottom-6 right-6" : "bot-wander"}`}
      style={{ width: 56, height: 56 }}
    >
      <span className="relative block h-full w-full">
        {portraitUrl ? (
          <img src={portraitUrl} alt="" className="h-full w-full rounded-full border border-accent/40 object-cover shadow-lg" />
        ) : (
          <span className="block h-full w-full rounded-full bg-gradient-to-br from-[#22d3ee]/80 to-[#0a4a5a] shadow-lg shadow-accent/20" aria-hidden="true" />
        )}
        {/* breathing glow */}
        <span className={`absolute inset-0 rounded-full ${reduced ? "" : "bot-breathe"}`} aria-hidden="true"
          style={{ boxShadow: "0 0 24px 4px rgba(34,211,238,0.35)" }} />
        {hasUnread && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4" aria-hidden="true">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-4 w-4 rounded-full border-2 border-background bg-accent" />
          </span>
        )}
      </span>
      <style jsx>{`
        @keyframes wander {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-6vw, -10vh); }
          40% { transform: translate(4vw, -22vh); }
          60% { transform: translate(-4vw, -34vh); }
          80% { transform: translate(5vw, -14vh); }
        }
        @keyframes breathe {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.06); }
        }
        .bot-wander {
          bottom: 6vh;
          right: 5vw;
          animation: wander 36s ease-in-out infinite;
        }
        .bot-breathe {
          animation: breathe 4s ease-in-out infinite;
        }
        @media (max-width: 640px) {
          .bot-wander { bottom: 4vh; right: 4vw; }
        }
      `}</style>
    </button>
  );
}
