"use client";

import { useState } from "react";

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

export function SovCard({ name, sovId }: { name: string; sovId: string }) {
  const [face, setFace] = useState<Face>("business");
  const [revealed, setRevealed] = useState(false);
  const shortId = sovId.length > 13 ? `${sovId.slice(0, 8)}…${sovId.slice(-4)}` : sovId;
  const flip = () => setFace((f) => (f === "business" ? "spend" : "business"));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2" role="tablist" aria-label="Card faces">
        {(["business", "spend"] as Face[]).map((f) => (
          <button key={f} role="tab" aria-selected={face === f} onClick={() => setFace(f)}
            className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${
              face === f ? "bg-accent text-background" : "border border-line text-muted hover:text-foreground"
            }`}>
            {f === "business" ? "Business card" : "Spend card"}
          </button>
        ))}
        <span className="ml-1 text-[10px] uppercase tracking-[0.14em] text-muted">tap the card to flip</span>
      </div>

      <div className="[perspective:1200px]">
        <button onClick={flip} aria-label={`Flip card — currently showing ${face} face`}
          className="relative block aspect-[8/5] w-full max-w-md cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-accent">
          <div className={`relative h-full w-full transition-transform duration-700 [transform-style:preserve-3d] ${
            face === "spend" ? "[transform:rotateY(180deg)]" : ""
          }`}>
            {/* Business face — public, light, open */}
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a2636] via-[#0a1220] to-[#04070d] p-6 text-[#f2f7fb] [backface-visibility:hidden]">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#22d3ee]/15 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.03] to-white/[0.07]" />
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
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-[#22d3ee]/20 bg-gradient-to-br from-[#04070d] via-[#060b14] to-[#0a1220] p-6 text-[#f2f7fb] [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <div className="absolute -left-20 -bottom-20 h-56 w-56 rounded-full bg-[#22d3ee]/10 blur-3xl" />
              <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-white/[0.02] to-white/[0.05]" />
              <div className="relative flex h-full flex-col justify-between">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#22d3ee]">Solve</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRevealed((r) => !r); }}
                    aria-label={revealed ? "Hide card number" : "Reveal card number"}
                    className="rounded-full border border-white/15 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/60 hover:text-white">
                    {revealed ? "Hide" : "Reveal"}
                  </button>
                </div>
                <div>
                  <p className="font-mono text-[22px] tabular-nums tracking-[0.12em] [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                    {revealed ? "4111 ···· ···· 1777" : "···· ···· ···· 1777"}
                  </p>
                  <p className="mt-1.5 text-xs text-white/50">Private spend · only you see this face</p>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#22d3ee]/70">Settles on Solana</p>
                </div>
              </div>
            </div>
          </div>
        </button>
      </div>

      <p className="max-w-md text-xs leading-5 text-muted">
        One card, two faces. The business side is public — your name, your verified identity. Flip it over and it is
        private: your spend, your money, visible only to you.
      </p>
    </div>
  );
}
