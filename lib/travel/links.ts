// Travel pack: rides and stays your AI plans and you book. Uber lets outside apps open its app
// with a ride already filled in (universal link), but not order one for you; Airbnb has no public
// API (its partner program is closed to new requests). So solve builds the exact link and the
// person confirms and pays inside Uber or Airbnb. Nothing here books, charges or signs in.
// Safe to import from client components.

export class TravelInputError extends Error {}

export type Place = { address?: string; nickname?: string; latitude?: number; longitude?: number };

const UBER_UL = "https://m.uber.com/ul/";
const AIRBNB = "https://www.airbnb.com";
const MAX_TEXT = 200;

const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "");
const coord = (v: unknown, limit: number) => (typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= limit ? v : undefined);

function place(raw: Place | undefined): Required<Pick<Place, "address" | "nickname">> & Pick<Place, "latitude" | "longitude"> {
  const latitude = coord(raw?.latitude, 90);
  const longitude = coord(raw?.longitude, 180);
  const both = latitude !== undefined && longitude !== undefined;
  return { address: clean(raw?.address), nickname: clean(raw?.nickname), latitude: both ? latitude : undefined, longitude: both ? longitude : undefined };
}

/**
 * Opens Uber with the ride filled in. With no pickup, Uber uses the rider's current location.
 * A place needs an address, a name or both coordinates.
 */
export function uberRideLink(input: { dropoff: Place; pickup?: Place; clientId?: string }): string {
  const dropoff = place(input.dropoff);
  if (!dropoff.address && !dropoff.nickname && dropoff.latitude === undefined) throw new TravelInputError("say where the ride goes");
  const q = new URLSearchParams();
  const id = clean(input.clientId);
  if (id) q.set("client_id", id);
  q.set("action", "setPickup");
  const pickup = input.pickup ? place(input.pickup) : null;
  if (pickup && (pickup.address || pickup.nickname || pickup.latitude !== undefined)) {
    setPlace(q, "pickup", pickup);
  } else {
    q.set("pickup", "my_location");
  }
  setPlace(q, "dropoff", dropoff);
  return `${UBER_UL}?${q.toString()}`;
}

function setPlace(q: URLSearchParams, key: "pickup" | "dropoff", p: ReturnType<typeof place>) {
  if (p.latitude !== undefined && p.longitude !== undefined) {
    q.set(`${key}[latitude]`, String(p.latitude));
    q.set(`${key}[longitude]`, String(p.longitude));
  }
  if (p.nickname) q.set(`${key}[nickname]`, p.nickname);
  if (p.address) q.set(`${key}[formatted_address]`, p.address);
}

export type StayInput = { where: string; checkin?: string; checkout?: string; adults?: number; children?: number; maxPrice?: number };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

function day(v: string | undefined, name: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  if (!ISO_DAY.test(v) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw new TravelInputError(`${name} must be a date like 2026-11-14`);
  return v;
}

const count = (v: number | undefined, min: number, max: number, what: string) => {
  if (v === undefined) return undefined;
  if (!Number.isInteger(v) || v < min || v > max) throw new TravelInputError(`${what} must be a whole number from ${min} to ${max}`);
  return v;
};

/** Opens Airbnb on a search for the place, dates and guests. Dates are optional but go together. */
export function airbnbSearchLink(input: StayInput): string {
  const where = clean(input.where);
  // "." or ".." would be read as a path step and leave the search page.
  if (!where || /^[.\s]+$/.test(where)) throw new TravelInputError("say where you want to stay");
  const checkin = day(input.checkin, "check-in");
  const checkout = day(input.checkout, "check-out");
  if (!checkin !== !checkout) throw new TravelInputError("give both check-in and check-out, or neither");
  if (checkin && checkout && checkout <= checkin) throw new TravelInputError("check-out must be after check-in");
  const adults = count(input.adults, 1, 16, "adults");
  const children = count(input.children, 0, 15, "children");
  const maxPrice = count(input.maxPrice, 10, 100000, "the nightly price limit");

  const q = new URLSearchParams();
  if (checkin && checkout) {
    q.set("checkin", checkin);
    q.set("checkout", checkout);
  }
  if (adults) q.set("adults", String(adults));
  if (children) q.set("children", String(children));
  if (maxPrice) q.set("price_max", String(maxPrice));
  const qs = q.toString();
  return `${AIRBNB}/s/${encodeURIComponent(where.replace(/\//g, " "))}/homes${qs ? `?${qs}` : ""}`;
}

/** Nights between two ISO days, for the summary line. */
export function nights(checkin: string, checkout: string): number {
  return Math.round((Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) / 86_400_000);
}
