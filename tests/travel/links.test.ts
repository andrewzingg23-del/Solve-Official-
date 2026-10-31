import assert from "node:assert/strict";
import { test } from "node:test";
import { airbnbSearchLink, nights, TravelInputError, uberRideLink } from "../../lib/travel/links";

test("an Uber link fills in the dropoff and uses the rider's location when there's no pickup", () => {
  const url = new URL(uberRideLink({ dropoff: { address: "Orlando International Airport, FL", nickname: "MCO" } }));
  assert.equal(url.origin + url.pathname, "https://m.uber.com/ul/");
  assert.equal(url.searchParams.get("action"), "setPickup");
  assert.equal(url.searchParams.get("pickup"), "my_location");
  assert.equal(url.searchParams.get("dropoff[formatted_address]"), "Orlando International Airport, FL");
  assert.equal(url.searchParams.get("dropoff[nickname]"), "MCO");
  assert.equal(url.searchParams.get("client_id"), null);
});

test("an Uber link carries a pickup, coordinates only in pairs, and the app's client id", () => {
  const url = new URL(
    uberRideLink({ pickup: { address: "Port Orange, FL" }, dropoff: { latitude: 28.43, longitude: -81.31, nickname: "Office" }, clientId: "abc" }),
  );
  assert.equal(url.searchParams.get("pickup[formatted_address]"), "Port Orange, FL");
  assert.equal(url.searchParams.get("dropoff[latitude]"), "28.43");
  assert.equal(url.searchParams.get("client_id"), "abc");
  const lone = new URL(uberRideLink({ dropoff: { latitude: 28.43, nickname: "Office" } }));
  assert.equal(lone.searchParams.get("dropoff[latitude]"), null);
});

test("a ride needs a destination", () => {
  assert.throws(() => uberRideLink({ dropoff: {} }), TravelInputError);
  assert.throws(() => uberRideLink({ dropoff: { address: "   ", latitude: 999, longitude: 0 } }), TravelInputError);
});

test("an Airbnb link searches the place with dates and guests", () => {
  const url = new URL(airbnbSearchLink({ where: "Nashville, TN", checkin: "2026-11-13", checkout: "2026-11-15", adults: 2, children: 1, maxPrice: 250 }));
  assert.equal(url.pathname, "/s/Nashville%2C%20TN/homes");
  assert.deepEqual(Object.fromEntries(url.searchParams), { checkin: "2026-11-13", checkout: "2026-11-15", adults: "2", children: "1", price_max: "250" });
  assert.equal(airbnbSearchLink({ where: "Austin" }), "https://www.airbnb.com/s/Austin/homes");
  assert.equal(nights("2026-11-13", "2026-11-15"), 2);
});

test("stay dates and guests are checked before any link is made", () => {
  assert.throws(() => airbnbSearchLink({ where: "" }), TravelInputError);
  assert.throws(() => airbnbSearchLink({ where: "Austin", checkin: "2026-11-13" }), /both/);
  assert.throws(() => airbnbSearchLink({ where: "Austin", checkin: "2026-11-15", checkout: "2026-11-13" }), /after/);
  assert.throws(() => airbnbSearchLink({ where: "Austin", checkin: "2026-02-30", checkout: "2026-03-02" }), /date/);
  assert.throws(() => airbnbSearchLink({ where: "Austin", adults: 0 }), /adults/);
  assert.throws(() => airbnbSearchLink({ where: "Austin", adults: 2.5 }), /adults/);
});

test("a place can't break out of the search path", () => {
  const url = new URL(airbnbSearchLink({ where: "../../account-settings?x=1" }));
  assert.equal(url.origin, "https://www.airbnb.com");
  assert.ok(url.pathname.startsWith("/s/") && url.pathname.endsWith("/homes"));
  assert.equal(url.search, "");
  assert.throws(() => airbnbSearchLink({ where: ".." }), TravelInputError);
  assert.throws(() => airbnbSearchLink({ where: ". ." }), TravelInputError);
});
