// The homeowner's first solar numbers: sized from their bill, priced the installer's way, with 2026's
// rules (no federal credit assumed). Pure math; no network.
import assert from "node:assert/strict";
import { it } from "node:test";
import { economics, estimateSolar, FLORIDA_DEFAULTS } from "../../lib/solar/estimate";

it("sizes a system from the bill and gives the money honestly", () => {
  const e = estimateSolar({ monthlyBill: 224 }); // 224 / 0.16 = 1,400 kWh a month
  assert.equal(e.annualUseKwh, 16800);
  assert.equal(e.panels, 30); // 16,800 / 1,400 / 0.41 = 29.3, rounded up
  assert.equal(e.systemKw, 12.3);
  assert.equal(e.annualProductionKwh, 17220);
  assert.equal(e.grossCost, 35670);
  assert.equal(e.netCost, 35670, "no federal credit in 2026");
  assert.equal(e.firstYearSavings, 2688, "only the use the system covers is savings");
  assert.ok(e.paybackYears && e.paybackYears > 10 && e.paybackYears < 13);
  assert.ok(e.lifetimeSavings > 0);
});

it("uses the bill's own rate when the homeowner knows their kWh, and keeps inputs in range", () => {
  const e = estimateSolar({ monthlyBill: 300, monthlyKwh: 1500 });
  assert.equal(e.rate, 0.2);
  assert.equal(e.annualUseKwh, 18000);
  const silly = estimateSolar({ monthlyBill: 1e9, offset: 9 });
  assert.equal(silly.annualUseKwh, (2000 / 0.16) * 12, "bills are capped");
  assert.ok(silly.covers <= 1.11);
  assert.equal(estimateSolar({ monthlyBill: 1 }).panels >= 4, true, "never fewer than four panels");
});

it("takes an incentive only when it's entered, and re-prices a real design's production", () => {
  assert.equal(estimateSolar({ monthlyBill: 224, incentives: 5000 }).netCost, 30670);
  const design = economics({ ...FLORIDA_DEFAULTS, rate: 0.16, annualUseKwh: 16800, systemKw: 10.25, panels: 25, annualProductionKwh: 15000 });
  assert.equal(design.firstYearSavings, 2400);
  assert.equal(design.grossCost, 29730);
});

it("prices a loan the standard way and shows its terms together", async () => {
  const { EXAMPLE_LOAN, loanPayment, loanQuote } = await import("../../lib/solar/qualify");
  assert.equal(Math.round(loanPayment(30000, 7.99, 25)), 231);
  assert.equal(Math.round(loanPayment(12000, 0, 10)), 100, "a zero-rate loan is the price over the payments");
  const q = loanQuote(34480, EXAMPLE_LOAN);
  assert.deepEqual([q.financed, q.payments, Math.round(q.monthly)], [34480, 300, 266]);
  assert.equal(loanQuote(10000, { aprPct: 8, years: 10, down: 2000 }).financed, 8000);
});

it("pre-qualifies from six answers, says why, and never decides credit", async () => {
  const { qualify } = await import("../../lib/solar/qualify");
  const good = { owner: "yes", home: "single", roof: "under10", shade: "little", credit: "720", utility: "fpl" } as const;
  assert.deepEqual(qualify({ ...good }, 220), { status: "qualified", cash: "yes", loan: "yes", lease: "yes", notes: [] });
  assert.equal(qualify({ ...good, owner: null }, 220).status, "incomplete");
  const renter = qualify({ ...good, owner: "no" }, 220);
  assert.deepEqual([renter.status, renter.cash, renter.loan], ["not_yet", "no", "no"]);
  const old = qualify({ ...good, roof: "over20", credit: "640" }, 220);
  assert.equal(old.status, "almost");
  assert.equal(old.loan, "maybe");
  assert.ok(old.notes.some((n) => n.includes("replaced first")));
  assert.equal(qualify({ ...good, credit: "below" }, 220).loan, "no");
  assert.equal(qualify({ ...good }, 80).status, "almost", "a small bill is said plainly");
});
