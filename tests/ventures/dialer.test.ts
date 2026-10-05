// The insurance dialer's automations: each outcome sets the next steps, inside calling hours, texts
// only with consent, and do-not-call ends everything.
import assert from "node:assert/strict";
import { it } from "node:test";
import { atLocal, callableNow, inCallingHours, localHour, nextSteps } from "../../lib/insurance/dialer";

const NY = "America/New_York";
const CHI = "America/Chicago";
// 2026-10-05 is in daylight time: New York is UTC-4, Chicago UTC-5.
const noon = new Date("2026-10-05T16:00:00Z"); // 12:00 in New York

it("keeps calls inside 8am to 9pm in the lead's own time zone", () => {
  assert.equal(localHour(NY, noon), 12);
  assert.equal(callableNow(NY, noon), true);
  const late = new Date("2026-10-06T01:30:00Z"); // 21:30 New York, 20:30 Chicago
  assert.equal(callableNow(NY, late), false);
  assert.equal(callableNow(CHI, late), true, "the lead's zone decides, not the agent's");
  assert.equal(inCallingHours(NY, late).toISOString(), "2026-10-06T12:00:00.000Z", "moved to 8am the next morning");
  const early = new Date("2026-10-05T10:00:00Z"); // 06:00 New York
  assert.equal(inCallingHours(NY, early).toISOString(), "2026-10-05T12:00:00.000Z", "moved to 8am the same morning");
  assert.equal(atLocal(CHI, noon, 1, 18).toISOString(), "2026-10-06T23:00:00.000Z");
});

it("retries a missed call twice, texts only with consent, then stops calling", () => {
  const first = nextSteps("no_answer", { attempts: 0, timeZone: NY, textConsent: true }, noon);
  assert.deepEqual(first.map((a) => [a.kind, a.at]), [["text", noon.toISOString()], ["call", "2026-10-05T18:00:00.000Z"]]);
  const noConsent = nextSteps("no_answer", { attempts: 0, timeZone: NY, textConsent: false }, noon);
  assert.deepEqual(noConsent.map((a) => a.kind), ["call"], "no text without consent");
  const second = nextSteps("voicemail", { attempts: 1, timeZone: NY, textConsent: false }, noon);
  assert.equal(second[0].at, "2026-10-06T22:00:00.000Z", "next day at 6pm local");
  const last = nextSteps("no_answer", { attempts: 2, timeZone: NY, textConsent: true }, noon);
  assert.deepEqual(last.map((a) => a.kind), ["email"], "after three attempts, no more calls");
});

it("confirms and reminds appointments, onboards a sale, and honors do-not-call", () => {
  const appt = new Date("2026-10-07T22:00:00Z"); // 6pm New York
  const a = nextSteps("appointment", { attempts: 0, timeZone: NY, textConsent: true }, noon, { appointmentAt: appt });
  assert.deepEqual(a.map((x) => x.kind), ["text", "text", "text", "task", "call"]);
  assert.equal(a.at(-1)!.at, appt.toISOString());
  const sold = nextSteps("sold", { attempts: 1, timeZone: NY, textConsent: false }, noon);
  assert.deepEqual(sold.map((x) => x.what), ["Submit the application today", "Policy delivery call", "Annual review"]);
  const dnc = nextSteps("do_not_call", { attempts: 0, timeZone: NY, textConsent: true }, noon);
  assert.deepEqual(dnc.map((x) => x.kind), ["stop"]);
  assert.deepEqual(nextSteps("not_interested", { attempts: 0, timeZone: NY, textConsent: true }, noon).map((x) => x.kind), ["email"]);
});
