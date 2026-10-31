"use client";

import { useMemo, useState } from "react";
import { field, glassCard, label, primaryAction } from "@/app/ui";
import { airbnbSearchLink, nights, TravelInputError, uberRideLink } from "@/lib/travel/links";

type Built = { url: string | null; problem: string | null };

function build(make: () => string): Built {
  try {
    return { url: make(), problem: null };
  } catch (error) {
    return { url: null, problem: error instanceof TravelInputError ? error.message : "that didn't work" };
  }
}

const today = () => new Date().toISOString().slice(0, 10);

export function TravelTool({ uberClientId }: { uberClientId: string | null }) {
  const [dropoff, setDropoff] = useState("");
  const [pickup, setPickup] = useState("");
  const [where, setWhere] = useState("");
  const [checkin, setCheckin] = useState("");
  const [checkout, setCheckout] = useState("");
  const [adults, setAdults] = useState(1);

  const ride = useMemo(
    () => build(() => uberRideLink({ dropoff: { address: dropoff }, pickup: pickup.trim() ? { address: pickup } : undefined, clientId: uberClientId ?? undefined })),
    [dropoff, pickup, uberClientId],
  );
  const stay = useMemo(
    () => build(() => airbnbSearchLink({ where, checkin: checkin || undefined, checkout: checkout || undefined, adults })),
    [where, checkin, checkout, adults],
  );
  const stayNights = checkin && checkout && stay.url ? nights(checkin, checkout) : 0;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section className={`${glassCard} flex flex-col gap-4`} aria-labelledby="ride-title">
        <p className={label}>Uber</p>
        <h2 id="ride-title" className="text-xl font-medium tracking-tight">Get a ride</h2>
        <label className="flex flex-col gap-2 text-sm">
          Where to
          <input className={field} value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Orlando International Airport" maxLength={200} />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          From <span className="text-xs text-muted">Leave empty to start where you are</span>
          <input className={field} value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Current location" maxLength={200} />
        </label>
        <Handoff built={ride} ready={dropoff.trim() !== ""} action="Open in Uber" note="Uber shows the price and the driver before you confirm." />
      </section>

      <section className={`${glassCard} flex flex-col gap-4`} aria-labelledby="stay-title">
        <p className={label}>Airbnb</p>
        <h2 id="stay-title" className="text-xl font-medium tracking-tight">Find a stay</h2>
        <label className="flex flex-col gap-2 text-sm">
          Where
          <input className={field} value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Nashville, TN" maxLength={200} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-2 text-sm">
            Check in
            <input type="date" className={field} value={checkin} min={today()} onChange={(e) => setCheckin(e.target.value)} />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Check out
            <input type="date" className={field} value={checkout} min={checkin || today()} onChange={(e) => setCheckout(e.target.value)} />
          </label>
        </div>
        <label className="flex flex-col gap-2 text-sm">
          Guests
          <input type="number" inputMode="numeric" className={field} value={adults} min={1} max={16} onChange={(e) => setAdults(Math.max(1, Math.min(16, Math.trunc(Number(e.target.value) || 1))))} />
        </label>
        <Handoff
          built={stay}
          ready={where.trim() !== ""}
          action="Search on Airbnb"
          note={stayNights > 0 ? `${stayNights} night${stayNights === 1 ? "" : "s"}, ${adults} guest${adults === 1 ? "" : "s"}. Pick a place and book on Airbnb.` : "Add dates to see real prices."}
        />
      </section>
    </div>
  );
}

function Handoff({ built, ready, action, note }: { built: Built; ready: boolean; action: string; note: string }) {
  if (!ready) return <p className="mt-auto text-xs leading-6 text-muted">{note}</p>;
  if (!built.url) return <p role="alert" className="mt-auto text-xs leading-6 text-rose-300">Check this: {built.problem}.</p>;
  return (
    <div className="mt-auto flex flex-col gap-3">
      <a className={primaryAction} href={built.url} target="_blank" rel="noopener noreferrer">
        {action}
      </a>
      <p className="text-xs leading-6 text-muted">{note}</p>
    </div>
  );
}
