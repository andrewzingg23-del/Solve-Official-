// Paying for it, and whether it fits: the homeowner's price as cash or a loan, and a pre-qualification
// from six answers. Nothing here is a credit decision and no credit is checked; the lender decides a
// loan, and the design visit confirms the roof.

// A fixed-rate loan's monthly payment.
export function loanPayment(principal: number, aprPct: number, years: number): number {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return 0;
  const r = aprPct / 100 / 12;
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
}

// Example loan terms, shown with the payment as the law asks: APR, term and down payment together.
// The lender sets the real ones from the homeowner's credit.
export const EXAMPLE_LOAN = { aprPct: 7.99, years: 25, down: 0 } as const;

export function loanQuote(price: number, terms: { aprPct: number; years: number; down: number }) {
  const financed = Math.max(0, price - Math.max(0, terms.down));
  const monthly = loanPayment(financed, terms.aprPct, terms.years);
  return { financed, monthly, payments: Math.round(terms.years * 12), totalPaid: monthly * Math.round(terms.years * 12) + Math.max(0, terms.down) };
}

export type Answers = {
  owner: "yes" | "no" | null;
  home: "single" | "townhome" | "condo" | "mobile" | null;
  roof: "under10" | "10to15" | "15to20" | "over20" | "unsure" | null;
  shade: "little" | "some" | "heavy" | null;
  credit: "720" | "680" | "640" | "below" | "unsure" | null;
  utility: "fpl" | "duke" | "other" | null;
};

export const QUESTIONS: { key: keyof Answers; ask: string; options: [string, string][] }[] = [
  { key: "owner", ask: "Do you own the home?", options: [["yes", "Yes"], ["no", "No, I rent"]] },
  { key: "home", ask: "What kind of home?", options: [["single", "Single-family"], ["townhome", "Townhome"], ["condo", "Condo"], ["mobile", "Mobile home"]] },
  { key: "roof", ask: "How old is the roof?", options: [["under10", "Under 10 years"], ["10to15", "10–15"], ["15to20", "15–20"], ["over20", "Over 20"], ["unsure", "Not sure"]] },
  { key: "shade", ask: "How much shade on the roof midday?", options: [["little", "Little"], ["some", "Some"], ["heavy", "Heavy"]] },
  { key: "credit", ask: "Your credit, roughly? (no check)", options: [["720", "720+"], ["680", "680–719"], ["640", "640–679"], ["below", "Below 640"], ["unsure", "Not sure"]] },
  { key: "utility", ask: "Who's your power company?", options: [["fpl", "FPL"], ["duke", "Duke Energy"], ["other", "Someone else"]] },
];

export type Fit = "yes" | "maybe" | "no";
export type Qualification = {
  status: "incomplete" | "qualified" | "almost" | "not_yet";
  cash: Fit;
  loan: Fit;
  lease: Fit;
  notes: string[];
};

export function qualify(a: Answers, monthlyBill: number): Qualification {
  if (QUESTIONS.some((q) => a[q.key] === null)) return { status: "incomplete", cash: "maybe", loan: "maybe", lease: "maybe", notes: [] };
  const notes: string[] = [];
  let blocked = false;
  let almost = false;
  if (a.owner === "no") {
    blocked = true;
    notes.push("Solar goes on the owner's roof. If you rent, share this page with your landlord.");
  }
  if (a.home === "mobile") {
    blocked = true;
    notes.push("Mobile homes usually can't carry a rooftop system.");
  }
  if (a.home === "condo") {
    almost = true;
    notes.push("A condo roof needs your association's approval first.");
  }
  if (a.roof === "over20") {
    almost = true;
    notes.push("A roof over 20 years old should be replaced first. Zest Solar can price both together.");
  } else if (a.roof === "15to20" || a.roof === "unsure") {
    notes.push("The roof gets a look on the design visit.");
  }
  if (a.shade === "heavy") {
    almost = true;
    notes.push("Heavy shade can make solar a poor fit. The design shows exactly how much sun the roof gets.");
  }
  if (monthlyBill < 100) {
    almost = true;
    notes.push("Under $100 a month, the savings are small. It can still make sense; the design will show.");
  }
  if (a.utility === "other") {
    almost = true;
    notes.push("Zest Solar works in FPL and Duke territory; we'll check whether we serve your area.");
  }
  const loan: Fit = a.credit === "720" || a.credit === "680" ? "yes" : a.credit === "640" || a.credit === "unsure" ? "maybe" : "no";
  if (loan === "maybe") notes.push("Some lenders approve from 640. The lender decides with a credit check, only when you apply.");
  if (loan === "no") notes.push("A loan is hard below 640. Cash or a lease may still work.");
  const lease: Fit = blocked ? "no" : a.credit === "below" ? "maybe" : "yes";
  return {
    status: blocked ? "not_yet" : almost ? "almost" : "qualified",
    cash: blocked ? "no" : "yes",
    loan: blocked ? "no" : loan,
    lease,
    notes,
  };
}
