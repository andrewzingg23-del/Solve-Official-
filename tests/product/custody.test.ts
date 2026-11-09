// A visitor owns what they record before they sign in. These tests hold the line that the
// interface says so accurately, and never claims an anonymous identity reaches further than it does.
import assert from "node:assert/strict";
import { it } from "node:test";
import { custodyOf, custodyNotice, openWorldHref, openWorldLabel } from "../../lib/product/custody";

it("distinguishes no identity, an anonymous one, and a signed-in account", () => {
  assert.equal(custodyOf(null, false), "device", "nothing is recorded without an identity");
  assert.equal(custodyOf("actor-1", false), "browser", "an anonymous identity still owns the thing");
  assert.equal(custodyOf("actor-1", true), "durable");
  // A signed-in account is durable whatever else is true; the two flags cannot disagree.
  assert.equal(custodyOf(null, true), "durable");
});

it("never tells a guest their work reaches further than this browser", () => {
  const browser = custodyNotice("browser");
  assert.match(browser, /Yours/, "it is genuinely theirs, and says so");
  assert.match(browser, /another browser/, "and says plainly what signing in actually buys");
  assert.ok(!/device/i.test(browser), "it is recorded, not merely held on the device");

  const device = custodyNotice("device");
  assert.match(device, /this device/, "with no identity, only the device is holding it");
  assert.ok(!/[Yy]ours/.test(device), "nothing unrecorded may be called theirs");

  assert.match(custodyNotice("durable"), /Private/);
});

it("sends a person without a durable account to sign in for the thing they asked for", () => {
  assert.equal(openWorldHref("w1", true), "/world/w1/workbench");
  assert.equal(
    openWorldHref("w1", false),
    "/login?next=%2Fworld%2Fw1%2Fworkbench",
    "the destination is carried through sign-in rather than lost",
  );
  assert.equal(openWorldLabel(false), "Sign in to open", "no dead end is presented as an open door");
  assert.equal(openWorldLabel(true), "Private workspace");
});

it("encodes a world id that would otherwise break the path", () => {
  const nasty = "a/b?c#d";
  assert.equal(openWorldHref(nasty, true), "/world/a%2Fb%3Fc%23d/workbench");
  assert.ok(
    openWorldHref(nasty, false).startsWith("/login?next=%2Fworld%2Fa%252Fb"),
    "double-encoded once as a path segment and once as a query value",
  );
});
