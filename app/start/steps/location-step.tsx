"use client";

import { useState, useTransition } from "react";
import { saveHomeNode } from "@/app/avatar/actions";
import { primaryAction, secondaryAction, glassCard } from "@/app/ui";

// Step 5: location → node on the map. Permission-gated, skippable.
export function LocationStep({ signedIn, onNext }: { signedIn: boolean; onNext: () => void }) {
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [locating, setLocating] = useState(false);
  const [, startTransition] = useTransition();

  const locate = () => {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("This device doesn't share location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setCoords({ lat, lng });
        if (!signedIn) return;
        startTransition(async () => {
          const result = await saveHomeNode(lat, lng);
          if (result.ok) setSaved(true);
          else setError(result.error ?? "Couldn't save. Try again.");
        });
      },
      () => {
        setLocating(false);
        setError("Location was blocked. You can skip this — your node waits.");
      },
      { timeout: 15000 },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm leading-6 text-muted">
        Your world starts where you stand. Place your node and the map grows around it.
      </p>

      {!coords ? (
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          className={`${primaryAction} w-full disabled:opacity-60`}
        >
          {locating ? "Finding you…" : "Use my location"}
        </button>
      ) : (
        <div className={`${glassCard} relative flex flex-col items-center gap-4 overflow-hidden p-8`}>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(circle at 50% 50%, rgb(34 211 238/0.25) 0, transparent 60%), repeating-radial-gradient(circle at 50% 50%, rgb(34 211 238/0.12) 0 1px, transparent 1px 24px)",
            }}
          />
          <div aria-hidden className="relative h-4 w-4 rounded-full bg-accent shadow-[0_0_32px_rgb(34_211_238/0.9)]" />
          <p className="relative text-lg font-medium tracking-tight">This is your node.</p>
          <p className="relative font-mono text-xs text-muted tabular-nums">
            {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
          </p>
          {saved ? <p className="relative text-xs text-positive">Placed.</p> : null}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}

      <button type="button" onClick={onNext} className={secondaryAction}>
        {coords ? "Continue" : "Skip for now"}
      </button>
    </div>
  );
}
