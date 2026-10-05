"use client";

// The homeowner's numbers, live as they type, with their system in 3D. Then one step to the real thing:
// the installer designs it in Aurora from their address.
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { estimateSolar, money, SOLAR_LIMITS } from "@/lib/solar/estimate";
import { accent, field, label, line, muted, panel, primary } from "../venture-style";

const House3D = dynamic(() => import("./house-3d").then((m) => m.House3D), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#4d5b6c]">Loading the model…</div>,
});

function Figure({ value, caption, strong = false }: { value: string; caption: string; strong?: boolean }) {
  return (
    <div className={`flex flex-col gap-1 border-t ${line} pt-3`}>
      <span className={`font-mono tabular-nums ${strong ? "text-3xl font-semibold sm:text-4xl" : "text-xl sm:text-2xl"}`}>{value}</span>
      <span className={`text-xs leading-5 ${muted}`}>{caption}</span>
    </div>
  );
}

export function SolarTool({ connected, request, error }: { connected: boolean; request: (form: FormData) => void | Promise<void>; error?: string | null }) {
  const [bill, setBill] = useState(220);
  const [kwh, setKwh] = useState<string>("");
  const [offset, setOffset] = useState(100);
  const e = useMemo(() => estimateSolar({ monthlyBill: bill, monthlyKwh: kwh ? Number(kwh) : null, offset: offset / 100 }), [bill, kwh, offset]);

  return (
    <div id="numbers" className="flex scroll-mt-6 flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className={`${panel} flex flex-col gap-6 p-6`}>
          <p className={label}>Your bill</p>
          <label className="flex flex-col gap-3">
            <span className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Average monthly electric bill</span>
              <span className="font-mono text-2xl font-semibold tabular-nums">{money(bill)}</span>
            </span>
            <input type="range" min={SOLAR_LIMITS.bill[0]} max={800} step={5} value={bill} onChange={(ev) => setBill(Number(ev.target.value))} className="accent-[#0891b2]" aria-label="Average monthly electric bill" />
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
            <input type="range" min={50} max={110} step={5} value={offset} onChange={(ev) => setOffset(Number(ev.target.value))} className="accent-[#0891b2]" aria-label="Share of your use to cover" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Figure value={`${e.systemKw} kW`} caption={`${e.panels} panels`} strong />
            <Figure value={money(e.firstYearSavings)} caption="saved in year one" strong />
            <Figure value={`${e.annualProductionKwh.toLocaleString("en-US")} kWh`} caption={`a year, about ${Math.round(e.covers * 100)}% of your use`} />
            <Figure value={e.paybackYears ? `${e.paybackYears} yrs` : "—"} caption="to pay for itself" />
            <Figure value={money(e.netCost)} caption="installed, before any incentive" />
            <Figure value={money(e.lifetimeSavings)} caption="ahead over 25 years, after the system's cost" />
          </div>
        </div>
        <div className={`${panel} relative min-h-[380px] overflow-hidden lg:min-h-0`}>
          <House3D panels={e.panels} label={`A home with ${e.panels} solar panels on the roof. Drag to turn it.`} />
          <p className={`pointer-events-none absolute left-4 top-4 rounded-full border ${line} bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${accent}`}>{e.panels} panels · drag to turn</p>
          <p className={`pointer-events-none absolute bottom-3 left-4 right-4 text-[11px] leading-4 ${muted}`}>An illustration of the panel count on a typical home. Your real layout is designed for your roof.</p>
        </div>
      </div>

      <p className={`text-xs leading-5 ${muted}`}>
        An estimate, not a quote: about 16¢ per kWh (Florida, 2026) unless you enter your kWh; about 1,400 kWh a year per kW installed;
        $2.90 per watt installed; 3% a year utility increases; panels losing 0.5% a year. The 30% federal credit for homeowners ended for systems installed after 2025, so none is counted.
      </p>

      <form action={request} className={`${panel} flex flex-col gap-4 p-6`}>
        <div className="flex flex-col gap-1">
          <p className={label}>Your real design</p>
          <h2 className="text-2xl font-semibold tracking-tight">Get your roof designed, with your actual numbers.</h2>
          <p className={`text-sm leading-6 ${muted}`}>Zest Solar designs your system in Aurora from satellite images of your roof, then your proposal page here updates with the real layout and production.</p>
        </div>
        <input type="hidden" name="monthlyBill" value={bill} />
        <input type="hidden" name="monthlyKwh" value={kwh} />
        <div className="grid gap-3 md:grid-cols-2">
          <input name="firstName" required maxLength={60} autoComplete="given-name" placeholder="First name" className={field} disabled={!connected} />
          <input name="lastName" required maxLength={60} autoComplete="family-name" placeholder="Last name" className={field} disabled={!connected} />
          <input name="email" type="email" required maxLength={120} autoComplete="email" placeholder="Email" className={field} disabled={!connected} />
          <input name="phone" type="tel" required maxLength={30} autoComplete="tel" placeholder="Phone" className={field} disabled={!connected} />
          <input name="address" required maxLength={200} autoComplete="street-address" placeholder="Home address (street, city, state, ZIP)" className={`${field} md:col-span-2`} disabled={!connected} />
        </div>
        <label className={`flex items-start gap-3 text-sm leading-6 ${muted}`}>
          <input type="checkbox" name="consent" required className="mt-1 accent-[#0891b2]" disabled={!connected} />
          <span>Send my name, contact and address to Zest Solar so they can design my system and contact me about it. Nothing is signed and nothing is owed.</span>
        </label>
        {error ? <p role="alert" className="text-sm text-[#b42318]">{error}</p> : null}
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" className={primary} disabled={!connected}>Design my roof</button>
          {!connected ? <span className={`text-sm ${muted}`}>Design requests open when Zest Solar&apos;s Aurora account is connected to this site.</span> : null}
        </div>
      </form>
    </div>
  );
}
