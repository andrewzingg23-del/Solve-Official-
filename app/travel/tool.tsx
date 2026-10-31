"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/app/product/icons";
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
    <div className="solve-two-columns">
      <section className="solve-panel solve-form" aria-labelledby="ride-title">
        <span className="solve-kicker">Uber</span>
        <h2 id="ride-title">Get a ride</h2>
        <label htmlFor="ride-to">Where to</label>
        <input id="ride-to" value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder="Orlando International Airport" maxLength={200} autoComplete="off" />
        <label htmlFor="ride-from">From (leave empty to start where you are)</label>
        <input id="ride-from" value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder="Current location" maxLength={200} autoComplete="off" />
        <Handoff built={ride} ready={dropoff.trim() !== ""} action="Open in Uber" note="Uber shows the price and the driver before you confirm." />
      </section>

      <section className="solve-panel solve-form" aria-labelledby="stay-title">
        <span className="solve-kicker">Airbnb</span>
        <h2 id="stay-title">Find a stay</h2>
        <label htmlFor="stay-where">Where</label>
        <input id="stay-where" value={where} onChange={(e) => setWhere(e.target.value)} placeholder="Nashville, TN" maxLength={200} autoComplete="off" />
        <label htmlFor="stay-in">Check in</label>
        <input id="stay-in" type="date" value={checkin} min={today()} onChange={(e) => setCheckin(e.target.value)} />
        <label htmlFor="stay-out">Check out</label>
        <input id="stay-out" type="date" value={checkout} min={checkin || today()} onChange={(e) => setCheckout(e.target.value)} />
        <label htmlFor="stay-guests">Guests</label>
        <input
          id="stay-guests"
          type="number"
          inputMode="numeric"
          value={adults}
          min={1}
          max={16}
          onChange={(e) => setAdults(Math.max(1, Math.min(16, Math.trunc(Number(e.target.value) || 1))))}
        />
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
  if (!ready) return <p className="solve-muted">{note}</p>;
  if (!built.url) return <p role="alert" className="solve-error">Check this: {built.problem}.</p>;
  return (
    <>
      <a className="solve-button" href={built.url} target="_blank" rel="noopener noreferrer">
        {action}
        <Icon name="arrow" width={16} />
      </a>
      <p className="solve-muted">{note}</p>
    </>
  );
}
