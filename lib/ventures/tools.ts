// The working math behind the venture doors. Every number comes from the visitor's own inputs; none is
// a promise of earnings or a quote.

const n = (v: unknown, lo = 0, hi = 1e12) => {
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo;
};

// Life insurance need, the DIME way: Debts + Income for the years it must be replaced + Mortgage +
// Education, less the coverage already in place.
export function coverageNeed(i: { debts: number; income: number; years: number; mortgage: number; education: number; existing: number }) {
  const parts = {
    debts: n(i.debts),
    income: n(i.income) * n(i.years, 0, 40),
    mortgage: n(i.mortgage),
    education: n(i.education),
  };
  const total = parts.debts + parts.income + parts.mortgage + parts.education;
  return { parts, total, need: Math.max(0, total - n(i.existing)) };
}

// How many shares to buy so a trade that hits its stop loses only the risk you chose.
export function positionSize(i: { account: number; riskPct: number; entry: number; stop: number }) {
  const account = n(i.account);
  const risk = (account * n(i.riskPct, 0, 100)) / 100;
  const perShare = Math.abs(n(i.entry) - n(i.stop));
  const shares = perShare > 0 ? Math.floor(risk / perShare) : 0;
  const value = shares * n(i.entry);
  return { risk, perShare, shares, value, ofAccount: account > 0 ? value / account : 0, direction: n(i.stop) < n(i.entry) ? "long" : "short" };
}

// What missed calls cost a month: calls missed, the share that would have booked, times a job's value.
export function missedCalls(i: { callsPerWeek: number; missedPct: number; bookPct: number; jobValue: number }) {
  const missed = n(i.callsPerWeek) * (52 / 12) * (n(i.missedPct, 0, 100) / 100);
  const jobs = missed * (n(i.bookPct, 0, 100) / 100);
  return { missed, jobs, revenue: jobs * n(i.jobValue) };
}

// The return on ad spend needed to break even, and to hit a target profit, from the order value and margin.
export function breakEven(i: { orderValue: number; marginPct: number; targetPct: number }) {
  const margin = n(i.marginPct, 0, 100) / 100;
  const target = n(i.targetPct, 0, 100) / 100;
  const maxCpa = n(i.orderValue) * margin;
  return {
    roas: margin > 0 ? 1 / margin : null,
    maxCpa,
    targetRoas: margin > target ? 1 / (margin - target) : null,
    targetCpa: n(i.orderValue) * Math.max(0, margin - target),
  };
}
