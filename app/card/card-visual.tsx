"use client";

import { useState } from "react";

type Face = "business" | "spend";

export function SovCard({ name, sovId }: { name: string; sovId: string }) {
  const [face, setFace] = useState<Face>("business");
  const shortId = sovId.length > 13 ? `${sovId.slice(0, 8)}…${sovId.slice(-4)}` : sovId;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2" role="tablist" aria-label="Card faces">
        {(["business", "spend"] as Face[]).map((f) => (
          <button key={f} role="tab" aria-selected={face === f} onClick={() => setFace(f)}
            className={`rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              face === f ? "bg-accent text-background" : "border border-line text-muted"
            }`}>
            {f === "business" ? "Business card" : "Spend card"}
          </button>
        ))}
      </div>

      <div className="relative aspect-[8/5] w-full max-w-md overflow-hidden rounded-2xl border border-line bg-gradient-to-br from-[#0a1220] to-[#04070d] p-6 text-[#f2f7fb]"
        role="img" aria-label={face === "business" ? "SOV ID business card" : "SOV ID private spend card"}>
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#22d3ee]/10 blur-2xl" />
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#22d3ee]">Solve</p>
            <p className="font-mono text-[10px] text-muted">{shortId}</p>
          </div>
          {face === "business" ? (
            <div>
              <p className="text-xl font-medium">{name}</p>
              <p className="mt-1 text-xs text-muted">Verified human · SOV ID holder</p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted">Hand it out — this face is public</p>
            </div>
          ) : (
            <div>
              <p className="font-mono text-2xl tabular-nums">···· ···· ···· ····</p>
              <p className="mt-1 text-xs text-muted">Private spend · only you see this face</p>
              <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted">Settles on Solana · issuer plugs in here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
