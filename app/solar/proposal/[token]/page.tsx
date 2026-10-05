// The homeowner's proposal: their numbers, and their real design once Zest Solar makes it in Aurora.
// Read from Aurora each time it opens, so it's live; reached only by the signed link they were given.
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auroraFromEnv, latestDesign, readProposalToken, type AuroraDesign } from "@/lib/solar/aurora";
import { economics, estimateSolar, FLORIDA_DEFAULTS, money } from "@/lib/solar/estimate";
import { accent, label, line, muted, panel } from "../../../venture-style";
import { ProposalModel } from "./model";

export const metadata: Metadata = { title: "Your solar proposal · Zest Solar", robots: { index: false, follow: false } };

const secret = () => process.env.SOLAR_LINK_SECRET || process.env.SUPABASE_SECRET_KEY || null;

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b ${line} py-3`}>
      <span className={`text-sm ${muted}`}>{k}</span>
      <span className="font-mono text-lg tabular-nums">{v}</span>
    </div>
  );
}

export default async function Proposal({ params }: PageProps<"/solar/proposal/[token]">) {
  const { token } = await params;
  const key = secret();
  const link = key ? readProposalToken(key, token) : null;
  if (!link) notFound();

  const base = estimateSolar({ monthlyBill: link.monthlyBill, monthlyKwh: link.monthlyKwh });
  const aurora = auroraFromEnv();
  let design: AuroraDesign | null = null;
  let unavailable = false;
  if (aurora) {
    try {
      design = await latestDesign(aurora, link.projectId);
    } catch {
      unavailable = true;
    }
  }
  const real = design?.systemKw && design.annualKwh;
  const panels = design?.panels ?? (real ? Math.round((design!.systemKw! * 1000) / FLORIDA_DEFAULTS.panelWatts) : base.panels);
  const e = real
    ? economics({ ...FLORIDA_DEFAULTS, rate: base.rate, annualUseKwh: base.annualUseKwh, systemKw: design!.systemKw!, panels, annualProductionKwh: design!.annualKwh! })
    : base;

  return (
    <div className="min-h-svh w-full bg-[#f2f7fb] text-[#04070d] [color-scheme:light]">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 md:px-8 md:py-12">
        <header className={`flex items-center justify-between gap-4 border-b ${line} pb-5`}>
          <Link href="/solar" className={`text-xs font-semibold uppercase tracking-[0.3em] ${accent}`}>Zest Solar</Link>
          <span className={label}>Your proposal</span>
        </header>

        <section className="flex flex-col gap-3">
          <p className={`text-xs font-semibold uppercase tracking-[0.26em] ${real ? accent : muted}`}>
            {real ? "Designed for your roof" : unavailable ? "Couldn't reach the design system just now" : "Your roof is being designed"}
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight md:text-6xl">{e.systemKw} kW · {panels} panels</h1>
          <p className={`max-w-2xl text-base leading-7 ${muted}`}>
            {real
              ? "These numbers come from your design in Aurora, made from images of your roof, with the production it simulated."
              : "Until your design is ready, these are the estimate from your bill. This page updates by itself when the design is done."}
          </p>
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
            <Row k="Installed price" v={money(e.netCost)} />
            <Row k="Pays for itself in" v={e.paybackYears ? `${e.paybackYears} years` : "—"} />
            <Row k="Ahead over 25 years" v={money(e.lifetimeSavings)} />
            <p className={`pt-4 text-xs leading-5 ${muted}`}>
              Not a contract or a final quote. Price at $2.90 per watt installed; utility prices rising 3% a year. No federal credit is counted: the 30% homeowner credit ended for systems installed after 2025.
            </p>
          </div>
        </section>

        <footer className={`flex flex-wrap items-center justify-between gap-4 border-t ${line} pt-5`}>
          <span className="text-sm font-medium">Everything here is real.</span>
          <span className={`text-xs ${muted}`}>{real ? `Design ${design!.designId.slice(0, 8)} in Aurora` : "Checked with Aurora each time you open this page"}</span>
        </footer>
      </main>
    </div>
  );
}
