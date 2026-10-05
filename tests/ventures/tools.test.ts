// The venture doors' math: from the visitor's inputs only.
import assert from "node:assert/strict";
import { it } from "node:test";
import { breakEven, coverageNeed, positionSize } from "../../lib/ventures/tools";

it("works out a family's coverage need the DIME way, less what they already have", () => {
  const c = coverageNeed({ debts: 20000, income: 60000, years: 10, mortgage: 250000, education: 100000, existing: 250000 });
  assert.equal(c.total, 970000);
  assert.equal(c.need, 720000);
  assert.equal(coverageNeed({ debts: 0, income: 0, years: 0, mortgage: 0, education: 0, existing: 9 }).need, 0, "never negative");
  assert.equal(coverageNeed({ debts: 0, income: 50000, years: 99, mortgage: 0, education: 0, existing: 0 }).parts.income, 2000000, "years capped at 40");
});

it("sizes a position so a stopped-out trade loses only the chosen risk", () => {
  const p = positionSize({ account: 25000, riskPct: 1, entry: 50, stop: 48 });
  assert.deepEqual([p.risk, p.perShare, p.shares, p.value, p.direction], [250, 2, 125, 6250, "long"]);
  assert.equal(positionSize({ account: 25000, riskPct: 1, entry: 50, stop: 50 }).shares, 0, "no stop distance, no position");
  assert.equal(positionSize({ account: 10000, riskPct: 2, entry: 20, stop: 21 }).direction, "short");
});

it("prices break-even ad returns from the visitor's own numbers", () => {
  const b = breakEven({ orderValue: 120, marginPct: 40, targetPct: 15 });
  assert.equal(b.roas, 2.5);
  assert.equal(b.maxCpa, 48);
  assert.equal(b.targetRoas, 4);
  assert.equal(breakEven({ orderValue: 100, marginPct: 0, targetPct: 0 }).roas, null);
});
