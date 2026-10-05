// The homeowner's solar, as it renders: their current request with the design (or the estimate
// until it comes), earlier requests, and erasing. Data comes from page.tsx.
import Link from "next/link";
import type { DesignRequest } from "@/lib/solar/desk";
import { economics, estimateSolar, FLORIDA_DEFAULTS, money, type SolarEstimate } from "@/lib/solar/estimate";
import { accent, label, line, muted, panel, primary, secondary } from "../../venture-style";
import { eraseDesignAction } from "../actions";
import { ProposalModel } from "./model";

// The design's numbers when the installer gave them, else the estimate from the bill.
function numbersFor(r: DesignRequest): { e: SolarEstimate; panels: number; designed: boolean } {
  const d = r.details!;
  const base = estimateSolar({ monthlyBill: d.monthlyBill, monthlyKwh: d.monthlyKwh });
  const a = r.answer;
  if (!a?.systemKw || !a.annualKwh) return { e: base, panels: a?.panels ?? base.panels, designed: false };
  const panels = a.panels ?? Math.round((a.systemKw * 1000) / FLORIDA_DEFAULTS.panelWatts);
  const pricePerWatt = a.price ? a.price / (a.systemKw * 1000) : FLORIDA_DEFAULTS.pricePerWatt;
  const e = economics({ ...FLORIDA_DEFAULTS, pricePerWatt, rate: base.rate, annualUseKwh: base.annualUseKwh, systemKw: a.systemKw, panels, annualProductionKwh: a.annualKwh });
  return { e, panels, designed: true };
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b ${line} py-3`}>
      <span className={`text-sm ${muted}`}>{k}</span>
      <span className="font-mono text-lg tabular-nums">{v}</span>
    </div>
  );
}

export const when = (at: string) => new Date(at).toLocaleDateString("en-US", { month: "long", day: "numeric" });

export function Empty({ text }: { text: string }) {
  return (
    <section className="flex flex-col items-start gap-4">
      <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">{text}</h1>
      <Link href="/solar" className={primary}>See my price</Link>
    </section>
  );
}

export function Current({ r }: { r: DesignRequest }) {
  const { e, panels, designed } = numbersFor(r);
  return (
    <>
      <section className="flex flex-col gap-3">
        <p className={`text-xs font-semibold uppercase tracking-[0.26em] ${designed || r.answer ? accent : muted}`}>
          {r.answer ? `Designed for your roof · ${when(r.answer.at)}` : `Your roof is being designed · asked ${when(r.at)}`}
        </p>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{e.systemKw} kW · {panels} panels</h1>
        <p className={`max-w-2xl text-base leading-7 ${muted}`}>
          {designed
            ? "These numbers come from your design, made in Aurora from images of your roof."
            : r.answer
              ? "Your design is ready. Open the full proposal for your layout and numbers."
              : "Until your design is ready, these are the estimate from your bill. This page shows the design when Zest Solar sends it."}
        </p>
        {r.answer?.note ? <p className="max-w-2xl text-base leading-7">“{r.answer.note}”</p> : null}
        {r.answer ? (
          <div className="pt-2">
            <a href={r.answer.proposalUrl} target="_blank" rel="noreferrer" className={primary}>Open my full proposal</a>
          </div>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className={`${panel} relative min-h-[360px] overflow-hidden`}>
          <ProposalModel panels={panels} />
        </div>
        <div className={`${panel} flex flex-col p-6`}>
          <Row k="System" v={`${e.systemKw} kW`} />
          <Row k="Production, year one" v={`${e.annualProductionKwh.toLocaleString("en-US")} kWh`} />
          <Row k="Your use, a year" v={`${e.annualUseKwh.toLocaleString("en-US")} kWh`} />
          <Row k="Saved in year one" v={money(e.firstYearSavings)} />
          <Row k={r.answer?.price ? "Price from Zest Solar" : "Installed price, estimated"} v={money(r.answer?.price ?? e.netCost)} />
          <Row k="Pays for itself in" v={e.paybackYears ? `${e.paybackYears} years` : "—"} />
          <Row k="Ahead over 25 years" v={money(e.lifetimeSavings)} />
          <p className={`pt-4 text-xs leading-5 ${muted}`}>
            Not a contract. Utility prices rising 3% a year; panels losing 0.5% a year. No federal credit is counted: the 30% homeowner credit ended for systems installed after 2025.
          </p>
        </div>
      </section>

      <section className={`${panel} flex flex-col gap-3 p-6`}>
        <p className={label}>What you sent</p>
        <p className="text-sm leading-6">{r.details!.name} · {r.details!.address}{r.details!.phone ? ` · ${r.details!.phone}` : ""}{r.details!.email ? ` · ${r.details!.email}` : ""}</p>
        <div className="flex flex-wrap items-center gap-4">
          <Erase id={r.id} big />
          <span className={`text-xs ${muted}`}>Erasing deletes your address and contact for good and takes Zest Solar&apos;s access away.</span>
        </div>
      </section>
    </>
  );
}

export function Erase({ id, big = false }: { id: string; big?: boolean }) {
  return (
    <form action={eraseDesignAction}>
      <input type="hidden" name="askId" value={id} />
      <button type="submit" className={big ? secondary : `text-xs uppercase tracking-[0.2em] ${muted} hover:text-[#b42318]`}>Erase my request</button>
    </form>
  );
}
