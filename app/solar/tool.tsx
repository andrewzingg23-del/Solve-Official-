"use client";

// The homeowner's whole way in, on one page: their bill, their system in 3D, their price (cash or a
// loan), whether they qualify, and then the real design from their roof: Zest Solar makes it in
// Aurora by hand and sends it back to the homeowner's own page in solve (lib/solar/desk.ts).
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { estimateSolar, money, SOLAR_LIMITS } from "@/lib/solar/estimate";
import { EXAMPLE_LOAN, loanQuote, qualify, QUESTIONS, type Answers, type Fit } from "@/lib/solar/qualify";
import { accent, field, label, line, muted, panel, primary, secondary } from "../venture-style";

const House3D = dynamic(() => import("./house-3d").then((m) => m.House3D), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading the model…</div>,
});

function Figure({ value, caption, strong = false }: { value: string; caption: string; strong?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 border-t ${line} pt-3`}>
      <span
        className={`font-mono tabular-nums ${strong ? "text-3xl font-semibold sm:text-4xl" : "text-xl sm:text-2xl"}`}
        style={strong ? { textShadow: "0 0 28px rgb(34 211 238 / 0.2)" } : undefined}
      >
        {value}
      </span>
      <span className={`text-xs leading-5 ${muted}`}>{caption}</span>
    </div>
  );
}

function Step({ n, title, children, id }: { n: string; title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="flex scroll-mt-6 flex-col gap-4">
      <div className="flex items-baseline gap-4">
        <span className={`font-mono text-sm tabular-nums ${accent}`}>{n}</span>
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h2>
      </div>
      {children}
    </section>
  );
}

const FIT: Record<Fit, string> = { yes: "Yes", maybe: "Likely", no: "Not now" };

export type SolarStart = { bill: number; kwh: string; answers: Partial<Answers> };

const NO_ANSWERS: Answers = { owner: null, home: null, roof: null, shade: null, credit: null, utility: null };

function answersFrom(raw: Partial<Answers> | undefined): Answers {
  const out = { ...NO_ANSWERS };
  for (const q of QUESTIONS) {
    const v = raw?.[q.key];
    if (typeof v === "string" && q.options.some(([value]) => value === v)) (out as Record<string, string | null>)[q.key] = v;
  }
  return out;
}

export function SolarTool({ desk, signedIn, request, requestId, start, error }: {
  desk: boolean;
  signedIn: boolean;
  request: (form: FormData) => void | Promise<void>;
  requestId: string;
  start?: SolarStart;
  error?: string | null;
}) {
  const [bill, setBill] = useState(start ? Math.min(SOLAR_LIMITS.bill[1], Math.max(SOLAR_LIMITS.bill[0], Math.round(start.bill))) : 220);
  const [kwh, setKwh] = useState<string>(start?.kwh ?? "");
  const [offset, setOffset] = useState(100);
  const [pay, setPay] = useState<"cash" | "loan" | "lease">("loan");
  const [apr, setApr] = useState<number>(EXAMPLE_LOAN.aprPct);
  const [years, setYears] = useState<number>(EXAMPLE_LOAN.years);
  const [down, setDown] = useState<number>(EXAMPLE_LOAN.down);
  const [answers, setAnswers] = useState<Answers>(answersFrom(start?.answers));
  // Back from signing in, or with an error to read: open on the last step.
  useEffect(() => {
    if (start || error) document.getElementById("design")?.scrollIntoView({ block: "start" });
  }, [start, error]);

  const e = useMemo(() => estimateSolar({ monthlyBill: bill, monthlyKwh: kwh ? Number(kwh) : null, offset: offset / 100 }), [bill, kwh, offset]);
  const loan = useMemo(() => loanQuote(e.netCost, { aprPct: apr, years, down }), [e.netCost, apr, years, down]);
  const leftover = (Math.max(0, e.annualUseKwh - e.annualProductionKwh) / 12) * e.rate;
  const fit = useMemo(() => qualify(answers, bill), [answers, bill]);
  const todayMonthly = (e.annualUseKwh / 12) * e.rate;
  const withLoan = loan.monthly + leftover;

  return (
    <div id="numbers" className="flex scroll-mt-6 flex-col gap-14">
      <Step n="01" title="Your bill, your system">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className={`${panel} flex flex-col gap-6 p-6`}>
            <label className="flex flex-col gap-3">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Average monthly electric bill</span>
                <span className="font-mono text-2xl font-semibold tabular-nums">{money(bill)}</span>
              </span>
              <input type="range" min={SOLAR_LIMITS.bill[0]} max={800} step={5} value={bill} onChange={(ev) => setBill(Number(ev.target.value))} className="accent-[var(--accent)]" aria-label="Average monthly electric bill" />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">Monthly kWh <span className={`font-normal ${muted}`}>(optional, from your bill)</span></span>
              <input inputMode="numeric" value={kwh} onChange={(ev) => setKwh(ev.target.value.replace(/[^0-9]/g, "").slice(0, 5))} placeholder="e.g. 1400" className={field} />
            </label>
            <label className="flex flex-col gap-3">
              <span className="flex items-baseline justify-between">
                <span className="text-sm font-medium">How much of your use to cover</span>
                <span className="font-mono text-lg tabular-nums">{offset}%</span>
              </span>
              <input type="range" min={50} max={110} step={5} value={offset} onChange={(ev) => setOffset(Number(ev.target.value))} className="accent-[var(--accent)]" aria-label="Share of your use to cover" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <Figure value={`${e.systemKw} kW`} caption={`${e.panels} panels`} strong />
              <Figure value={e.annualProductionKwh.toLocaleString("en-US")} caption={`kWh a year, about ${Math.round(e.covers * 100)}% of your use`} strong />
            </div>
          </div>
          <div className={`${panel} relative min-h-[380px] overflow-hidden lg:min-h-0`}>
            <House3D panels={e.panels} label={`A home with ${e.panels} solar panels on the roof. Drag to turn it.`} />
            <p className={`pointer-events-none absolute left-4 top-4 rounded-full border ${line} bg-surface-sunken/85 px-3 backdrop-blur-md py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent}`}>{e.panels} panels · drag to turn</p>
            <p className={`pointer-events-none absolute bottom-3 left-4 right-4 text-[11px] leading-4 ${muted}`}>An illustration of the panel count on a typical home. Your real layout is designed for your roof.</p>
          </div>
        </div>
      </Step>

      <Step n="02" title="Your price" id="price">
        <div className={`${panel} flex flex-col gap-6 p-6 md:p-8`}>
          <div role="tablist" aria-label="How you pay" className={`inline-flex w-fit gap-1 rounded-md border ${line} bg-surface-sunken p-1`}>
            {(["cash", "loan", "lease"] as const).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={pay === k} onClick={() => setPay(k)}
                className={`rounded px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${pay === k ? "bg-accent text-accent-ink" : muted}`}>
                {k === "cash" ? "Cash" : k === "loan" ? "Loan" : "Lease"}
              </button>
            ))}
          </div>
          {pay === "cash" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Figure value={money(e.netCost)} caption="installed price" strong />
              <Figure value={money(e.firstYearSavings)} caption="saved in year one" />
              <Figure value={e.paybackYears ? `${e.paybackYears} yrs` : "—"} caption="to pay for itself" />
              <Figure value={money(e.lifetimeSavings)} caption="ahead over 25 years, after the price" />
            </div>
          ) : pay === "loan" ? (
            <div className="flex flex-col gap-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">APR</span>
                  <input type="number" step={0.01} min={0} max={30} value={apr} onChange={(ev) => setApr(Math.min(30, Math.max(0, Number(ev.target.value))))} className={`${field} font-mono`} /></label>
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Term</span>
                  <select value={years} onChange={(ev) => setYears(Number(ev.target.value))} className={field}>
                    {[10, 15, 20, 25].map((y) => <option key={y} value={y}>{y} years</option>)}
                  </select></label>
                <label className="flex flex-col gap-1.5"><span className="text-sm font-medium">Down payment</span>
                  <input type="number" step={500} min={0} value={down} onChange={(ev) => setDown(Math.max(0, Number(ev.target.value)))} className={`${field} font-mono`} /></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Figure value={money(todayMonthly)} caption="today, a month to the utility" />
                <Figure value={money(loan.monthly)} caption={`loan payment${leftover >= 1 ? `, plus about ${money(leftover)} still to the utility` : ""}`} strong />
                <Figure value={withLoan <= todayMonthly ? `${money(todayMonthly - withLoan)} less` : `${money(withLoan - todayMonthly)} more`} caption="a month in year one; utility prices keep rising, the payment doesn't" />
              </div>
              <p className={`text-xs leading-5 ${muted}`}>
                Example: {money(loan.financed)} financed at {apr}% APR for {years} years with {money(down)} down is {loan.payments} monthly payments of {money(loan.monthly)}.
                Your rate and terms come from the lender and your credit, and some loans add fees to the price. Utilities also bill fixed monthly charges either way.
              </p>
            </div>
          ) : (
            <div className="flex max-w-2xl flex-col gap-2">
              <p className="text-lg font-medium">$0 down. A set monthly payment for the system, with the provider owning and servicing it.</p>
              <p className={`text-sm leading-6 ${muted}`}>Lease payments are set by the leasing company for your roof and credit, so there&apos;s no honest number to show before your design. Ask for a lease quote on your design call.</p>
            </div>
          )}
        </div>
      </Step>

      <Step n="03" title="Do you qualify?" id="qualify">
        <div className={`${panel} grid gap-8 p-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] md:p-8`}>
          <div className="flex flex-col gap-5">
            {QUESTIONS.map((q) => (
              <fieldset key={q.key} className="flex flex-col gap-2">
                <legend className="mb-2 text-sm font-medium">{q.ask}</legend>
                <div className="flex flex-wrap gap-2">
                  {q.options.map(([value, text]) => (
                    <button key={value} type="button" aria-pressed={answers[q.key] === value} onClick={() => setAnswers({ ...answers, [q.key]: value })}
                      className={`rounded-md border px-3 py-2 text-sm transition-colors ${answers[q.key] === value ? "border-accent bg-accent text-accent-ink" : `${line} bg-surface-sunken hover:border-accent`}`}>
                      {text}
                    </button>
                  ))}
                </div>
              </fieldset>
            ))}
            <p className={`text-xs ${muted}`}>No credit check, and nothing here affects your credit.</p>
          </div>
          <div className="flex flex-col gap-4" aria-live="polite">
            <p className={label}>Your answer</p>
            <p className="text-3xl font-semibold tracking-tight">
              {fit.status === "incomplete" ? "Six quick questions." : fit.status === "qualified" ? "You pre-qualify." : fit.status === "almost" ? "Almost. One thing to check." : "Not yet."}
            </p>
            {fit.status !== "incomplete" ? (
              <dl className="flex flex-col">
                {(["cash", "loan", "lease"] as const).map((k) => (
                  <div key={k} className={`flex items-baseline justify-between border-t ${line} py-2.5`}>
                    <dt className="text-sm capitalize">{k}</dt>
                    <dd className={`text-sm font-semibold ${fit[k] === "yes" ? accent : fit[k] === "no" ? muted : ""}`}>{FIT[fit[k]]}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            {fit.notes.map((n) => <p key={n} className={`text-sm leading-6 ${muted}`}>{n}</p>)}
          </div>
        </div>
      </Step>

      <Step n="04" title="Your real design and final price" id="design">
        <div className={`${panel} flex flex-col gap-4 p-6 md:p-8`}>
          <p className={`text-sm leading-6 ${muted}`}>
            A person at Zest Solar designs your system in Aurora from images of your roof, then sends you your layout, production and final price. It comes back to your own page here.
          </p>
          {!desk ? (
            <p className="text-sm font-medium">Zest Solar&apos;s design desk opens here soon. Your numbers above are yours to keep.</p>
          ) : !signedIn ? (
            <>
              <p className="text-sm leading-6">Sign in first, so your design has somewhere to come back to. It&apos;s free, your numbers come with you, and your details stay yours: you can erase them any time.</p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href={`/login?next=${encodeURIComponent(`/solar?bill=${bill}&kwh=${kwh}&a=${JSON.stringify(Object.fromEntries(Object.entries(answers).filter(([, v]) => v)))}`)}`}
                  className={primary}
                >
                  Sign in to ask for my design
                </Link>
              </div>
            </>
          ) : (
            <form action={request} className="flex flex-col gap-4">
              <input type="hidden" name="requestId" value={requestId} />
              <input type="hidden" name="monthlyBill" value={bill} />
              <input type="hidden" name="monthlyKwh" value={kwh} />
              <input type="hidden" name="answers" value={JSON.stringify(answers)} />
              <div className="grid gap-3 md:grid-cols-2">
                <input name="name" required maxLength={120} autoComplete="name" placeholder="Your name" className={`${field} md:col-span-2`} />
                <input name="address" required maxLength={200} autoComplete="street-address" placeholder="Home address (street, city, state, ZIP)" className={`${field} md:col-span-2`} />
                <input name="phone" type="tel" maxLength={30} autoComplete="tel" placeholder="Phone (optional, if you'd like a call)" className={field} />
                <input name="email" type="email" maxLength={120} autoComplete="email" placeholder="Email (optional)" className={field} />
              </div>
              <label className={`flex items-start gap-3 text-sm leading-6 ${muted}`}>
                <input type="checkbox" name="consent" required className="mt-1 accent-[var(--accent)]" />
                <span>Send my name, address, contact and answers to Zest Solar so they can design my system and contact me about it. They&apos;re sealed for Zest Solar alone, and I can erase them any time. Nothing is signed and nothing is owed.</span>
              </label>
              <div className="flex flex-wrap items-center gap-4">
                <button type="submit" className={primary} disabled={fit.status === "not_yet"}>Design my roof</button>
                <Link href="/solar/mine" className={secondary}>My solar</Link>
              </div>
            </form>
          )}
          {error ? <p role="alert" className="text-sm text-negative">{error}</p> : null}
        </div>
      </Step>

      <p className={`text-xs leading-5 ${muted}`}>
        Estimates, not a quote: about 16¢ per kWh (Florida, 2026) unless you enter your kWh; about 1,400 kWh a year per kW installed;
        $2.90 per watt installed; 3% a year utility increases; panels losing 0.5% a year. The 30% federal credit for homeowners ended for systems installed after 2025, so none is counted.
      </p>
    </div>
  );
}
