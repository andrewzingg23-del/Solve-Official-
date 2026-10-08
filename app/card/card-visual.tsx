"use client";

import { useEffect, useRef, useState } from "react";

type Face = "business" | "spend";

function Chip() {
  return (
    <svg width="44" height="34" viewBox="0 0 44 34" aria-hidden="true" className="opacity-80">
      <rect x="1" y="1" width="42" height="32" rx="6" fill="none" stroke="#c8d4dc" strokeWidth="1.5" />
      <line x1="1" y1="12" x2="43" y2="12" stroke="#c8d4dc" strokeWidth="1" />
      <line x1="1" y1="22" x2="43" y2="22" stroke="#c8d4dc" strokeWidth="1" />
      <line x1="15" y1="1" x2="15" y2="12" stroke="#c8d4dc" strokeWidth="1" />
      <line x1="29" y1="1" x2="29" y2="12" stroke="#c8d4dc" strokeWidth="1" />
      <line x1="15" y1="22" x2="15" y2="33" stroke="#c8d4dc" strokeWidth="1" />
      <line x1="29" y1="22" x2="29" y2="33" stroke="#c8d4dc" strokeWidth="1" />
    </svg>
  );
}

// Springy flip easing — slight overshoot on the rotateY so the card
// lands like a physical object, not a CSS default.
const FLIP_EASE = "cubic-bezier(0.34, 1.25, 0.64, 1)";

export function SovCard({
  name,
  sovId,
  lastFour,
}: {
  name: string;
  sovId: string;
  lastFour: string | null;
}) {
  const [face, setFace] = useState<Face>("business");
  const [revealed, setRevealed] = useState(false);
  const mountRef = useRef<HTMLDivElement>(null);
  const tiltRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);

  const shortId = sovId.length > 13 ? `${sovId.slice(0, 8)}…${sovId.slice(-4)}` : sovId;
  const flip = () => setFace((f) => (f === "business" ? "spend" : "business"));
  const pan = lastFour ? `···· ···· ···· ${lastFour}` : "···· ···· ···· ····";

  // Card reveal: rises, settles, straightens — one confident motion.
  useEffect(() => {
    const el = mountRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const anim = el.animate(
      [
        { opacity: 0, transform: "translateY(52px) scale(0.93) rotateX(12deg)" },
        { opacity: 1, transform: "translateY(0) scale(1) rotateX(0deg)" },
      ],
      { duration: 1150, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards", delay: 120 },
    );
    return () => {
      anim.cancel();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Pointer-driven tilt + holographic glint, rAF-throttled, no re-renders.
  const onPointerMove = (e: React.PointerEvent) => {
    const el = tiltRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transition = "transform 120ms ease-out";
      el.style.transform = `rotateX(${(-py * 9).toFixed(2)}deg) rotateY(${(px * 11).toFixed(2)}deg)`;
      el.style.setProperty("--mx", `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty("--my", `${((py + 0.5) * 100).toFixed(1)}%`);
    });
  };
  const onPointerLeave = () => {
    const el = tiltRef.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    el.style.transition = "transform 750ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "rotateX(0deg) rotateY(0deg)";
  };

  const onFlipKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  };

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-5">
      <style>{`
        @property --sov-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes sov-beam-spin {
          to { --sov-angle: 360deg; }
        }
        .sov-beam {
          background: conic-gradient(
            from var(--sov-angle),
            transparent 0deg,
            transparent 245deg,
            rgba(34, 211, 238, 0.85) 305deg,
            rgba(242, 247, 251, 0.5) 320deg,
            transparent 360deg
          );
          animation: sov-beam-spin 5.5s linear infinite;
        }
        @keyframes sov-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes sov-sheen {
          0% { transform: translateX(-140%) skewX(-14deg); }
          55%, 100% { transform: translateX(340%) skewX(-14deg); }
        }
        .sov-float { animation: sov-float 7s ease-in-out infinite; }
        .sov-sheen { animation: sov-sheen 6.5s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        @keyframes card-ui-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-ui {
          opacity: 0;
          animation: card-ui-rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .sov-float, .sov-sheen, .sov-beam { animation: none; }
          .card-ui { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="card-ui flex items-center gap-2" role="tablist" aria-label="Card faces" style={{ animationDelay: "420ms" }}>
        {(["business", "spend"] as Face[]).map((f) => (
          <button
            key={f}
            role="tab"
            aria-selected={face === f}
            onClick={() => setFace(f)}
            className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-all duration-300 active:scale-95 ${
              face === f
                ? "bg-accent text-accent-ink shadow-[0_0_24px_rgb(34_211_238/0.35)]"
                : "border border-line text-muted hover:border-accent/50 hover:text-foreground"
            }`}
          >
            {f === "business" ? "Business card" : "Spend card"}
          </button>
        ))}
      </div>

      <div ref={mountRef} className="relative w-full [perspective:1600px]">
        {/* cyan aura the card floats on */}
        <div aria-hidden="true" className="absolute -inset-8 top-10 rounded-[2.5rem] bg-accent/[0.08] blur-3xl" />
        {/* tracing border beam — 1px conic ring orbiting the card */}
        <div className="sov-beam relative rounded-2xl p-px">
          <div
            ref={tiltRef}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            className="group relative will-change-transform"
          >
            <div className="sov-float relative">
              <div
                role="button"
                tabIndex={0}
                onClick={flip}
                onKeyDown={onFlipKey}
                aria-label={`Flip card — currently showing ${face} face`}
                className="relative block aspect-[8/5] w-full cursor-pointer rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <div
                  className={`relative h-full w-full [transform-style:preserve-3d] ${
                    face === "spend" ? "[transform:rotateY(180deg)]" : ""
                  }`}
                  style={{ transition: `transform 900ms ${FLIP_EASE}` }}
                >
                  {/* Business face — public, open */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a2636] via-[#0a1220] to-[#04070d] p-6 text-[#f2f7fb] shadow-[0_36px_90px_rgb(0_0_0/0.6),0_0_70px_rgb(34_211_238/0.1)] [backface-visibility:hidden] md:p-8">
                    <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#22d3ee]/20 blur-3xl" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.09]" />
                    {/* cursor-tracked holographic glint */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(440px circle at var(--mx, 50%) var(--my, 30%), rgba(255,255,255,0.16), transparent 60%)",
                      }}
                    />
                    <div aria-hidden="true" className="sov-sheen pointer-events-none absolute inset-y-[-30%] left-0 w-1/4 bg-gradient-to-r from-transparent via-white/[0.12] to-transparent" />
                    <div className="relative flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22d3ee]">Solve</p>
                        <Chip />
                      </div>
                      <div>
                        <p className="text-2xl font-medium tracking-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">{name}</p>
                        <p className="mt-1.5 font-mono text-[11px] tracking-[0.08em] text-white/60">{shortId}</p>
                        <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-white/40">Verified human · hand it out</p>
                      </div>
                    </div>
                  </div>
                  {/* Spend face — private, dark, secure */}
                  <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-[#04070d] via-[#060b14] to-[#0a1220] p-6 text-[#f2f7fb] shadow-[0_36px_90px_rgb(0_0_0/0.6),0_0_70px_rgb(34_211_238/0.08)] [backface-visibility:hidden] [transform:rotateY(180deg)] md:p-8">
                    <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-[#22d3ee]/10 blur-3xl" />
                    <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/[0.02] to-white/[0.06]" />
                    {/* cursor-tracked holographic glint */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 opacity-70 transition-opacity duration-300 group-hover:opacity-100"
                      style={{
                        background:
                          "radial-gradient(440px circle at var(--mx, 50%) var(--my, 30%), rgba(34,211,238,0.14), transparent 60%)",
                      }}
                    />
                    <div aria-hidden="true" className="sov-sheen pointer-events-none absolute inset-y-[-30%] left-0 w-1/4 bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
                    <div className="relative flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22d3ee]">Solve</p>
                        {lastFour && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRevealed((r) => !r);
                            }}
                            aria-label={revealed ? "Hide card number" : "Reveal card number"}
                            className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60 transition-colors hover:border-accent/60 hover:text-white active:scale-95"
                          >
                            {revealed ? "Hide" : "Reveal"}
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="font-mono text-[22px] tabular-nums tracking-[0.12em] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                          {revealed ? pan : "···· ···· ···· ····"}
                        </p>
                        <p className="mt-1.5 text-xs text-white/50">Private spend · only you see this face</p>
                        <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#22d3ee]/70">Settles on Solana</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="card-ui text-[10px] uppercase tracking-[0.18em] text-faint" style={{ animationDelay: "560ms" }}>
        Tap the card to flip
      </p>
    </div>
  );
}
