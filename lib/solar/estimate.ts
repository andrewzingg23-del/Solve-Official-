// The homeowner's solar numbers, from their bill. A first estimate, before a real design: the
// installer designs the actual system in Aurora from satellite imagery and sends it back through the
// solar desk (lib/solar/desk.ts), whose numbers then replace these.
//
// The rules are 2026's: the 30% federal credit for homeowner-owned systems (25D) ended for systems
// installed after 2025-12-31, so no federal credit is assumed. Any incentive is entered explicitly.

export type SolarInputs = {
  monthlyBill: number; // dollars
  monthlyKwh?: number | null; // if they know it, from their bill
  rate: number; // dollars per kWh when monthlyKwh isn't given
  yieldKwhPerKw: number; // a year's production per kW installed, for the area
  pricePerWatt: number; // installed price the installer quotes, dollars per watt
  panelWatts: number;
  offset: number; // share of the yearly use to cover, 0.5–1.1
  escalation: number; // yearly utility price rise
  degradation: number; // yearly panel output loss
  years: number;
  incentives: number; // dollars, entered explicitly; none is assumed
};

// Florida, 2026: about 16¢ per kWh (EnergySage, August 2026); about 1,400 kWh per kW a year.
export const FLORIDA_DEFAULTS: SolarInputs = {
  monthlyBill: 220,
  monthlyKwh: null,
  rate: 0.16,
  yieldKwhPerKw: 1400,
  pricePerWatt: 2.9,
  panelWatts: 410,
  offset: 1,
  escalation: 0.03,
  degradation: 0.005,
  years: 25,
  incentives: 0,
};

export const SOLAR_LIMITS = { bill: [20, 2000], kwh: [100, 10000], offset: [0.5, 1.1] } as const;

export type SolarEstimate = {
  rate: number;
  annualUseKwh: number;
  systemKw: number;
  panels: number;
  annualProductionKwh: number;
  covers: number; // share of yearly use the system makes
  grossCost: number;
  netCost: number;
  firstYearSavings: number;
  lifetimeSavings: number; // over `years`, after the system's net cost
  paybackYears: number | null;
  billsWithout: number; // what the utility would cost over `years` without solar
};

const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));
const round = (n: number, step = 1) => Math.round(n / step) * step;

export function estimateSolar(raw: Partial<SolarInputs>, base: SolarInputs = FLORIDA_DEFAULTS): SolarEstimate {
  const i = { ...base, ...raw };
  const bill = clamp(Number(i.monthlyBill) || base.monthlyBill, SOLAR_LIMITS.bill);
  const kwh = i.monthlyKwh ? clamp(Number(i.monthlyKwh), SOLAR_LIMITS.kwh) : null;
  const rate = kwh ? bill / kwh : i.rate;
  const annualUseKwh = (kwh ?? bill / rate) * 12;
  const offset = clamp(i.offset, SOLAR_LIMITS.offset);
  const panels = Math.max(4, Math.ceil((annualUseKwh * offset) / i.yieldKwhPerKw / (i.panelWatts / 1000)));
  const systemKw = (panels * i.panelWatts) / 1000;
  return economics({ ...i, rate, annualUseKwh, systemKw, panels, annualProductionKwh: systemKw * i.yieldKwhPerKw });
}

// The money side, for a given system: from the estimate, or from a real design's size and production.
export function economics(x: SolarInputs & { rate: number; annualUseKwh: number; systemKw: number; panels: number; annualProductionKwh: number }): SolarEstimate {
  const grossCost = x.systemKw * 1000 * x.pricePerWatt;
  const netCost = Math.max(0, grossCost - Math.max(0, x.incentives));
  let cumulative = -netCost;
  let paybackYears: number | null = null;
  let firstYearSavings = 0;
  let billsWithout = 0;
  for (let y = 0; y < x.years; y++) {
    const price = x.rate * (1 + x.escalation) ** y;
    const made = x.annualProductionKwh * (1 - x.degradation) ** y;
    // Savings are the use the system covers; production beyond the year's use isn't counted.
    const saved = Math.min(made, x.annualUseKwh) * price;
    if (y === 0) firstYearSavings = saved;
    billsWithout += x.annualUseKwh * price;
    const before = cumulative;
    cumulative += saved;
    if (paybackYears === null && cumulative >= 0) paybackYears = y + (saved > 0 ? -before / saved : 0);
  }
  return {
    rate: x.rate,
    annualUseKwh: round(x.annualUseKwh),
    systemKw: Math.round(x.systemKw * 100) / 100,
    panels: x.panels,
    annualProductionKwh: round(x.annualProductionKwh),
    covers: Math.min(x.annualProductionKwh / x.annualUseKwh, 2),
    grossCost: round(grossCost, 10),
    netCost: round(netCost, 10),
    firstYearSavings: round(firstYearSavings),
    lifetimeSavings: round(cumulative, 10),
    paybackYears: paybackYears === null ? null : Math.round(paybackYears * 10) / 10,
    billsWithout: round(billsWithout, 10),
  };
}

export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
