// A visitor owns what they record before they sign in. These tests hold the line that the
// interface says so accurately, and never claims an anonymous identity reaches further than it does.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { custodyOf, custodyNotice, connectionNotice } from "../../lib/product/custody";

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

it("tells a guest on Apps that what they connect belongs to this browser alone", () => {
  const browser = connectionNotice("browser");
  assert.match(browser, /guest/i, "it names what they are");
  assert.match(browser, /this browser/, "and where the connection lives");
  assert.match(browser, /another browser/i, "and that a different browser is a different person");
  assert.ok(!/every device/i.test(browser), "a guest is never told their connections follow them");

  const durable = connectionNotice("durable");
  assert.match(durable, /every device you sign in on/);

  const device = connectionNotice("device");
  assert.match(device, /Sign in/, "with no identity, connecting is not offered as if it would work");
});

it("says so where the person connects things", () => {
  const apps = readFileSync(new URL("../../app/apps/page.tsx", import.meta.url), "utf8");
  assert.match(apps, /connectionNotice\(custody\)/, "Apps carries the notice, not its own wording");
  assert.match(apps, /data-custody=\{custody\}/, "and a check can read which of the three it is");
});
