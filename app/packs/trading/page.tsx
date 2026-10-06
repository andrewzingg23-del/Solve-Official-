import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadBot } from "@/lib/bot/store";
import { marketSnapshot, type SymbolId } from "@/lib/packs/trading";
import { SolanaProviders } from "@/lib/solana/providers";
import { PriceChart } from "./chart";
import { BotAnalysis } from "./analysis";
import { WalletConnect } from "./wallet-connect";
import { SwapQuotes } from "./swap-quotes";
import { SwapBox } from "./swap";

export const metadata: Metadata = { title: "Trading pack — solve" };

export default async function TradingPackPage() {
  const user = await getUser();
  if (!user) redirect("/login?next=/packs/trading");
  const kernel = await getKernel();
  const bot = await loadBot(kernel);
  const botName = bot.avatar ? bot.persona.name : "Your bot";

  let snapshot: Record<SymbolId, { openTime: number; open: number; high: number; low: number; close: number; volume: number }[]> | null = null;
  try {
    snapshot = await marketSnapshot();
  } catch {
    snapshot = null;
  }

  return (
    <SolanaProviders>
    <main className="mx-auto flex min-h-svh w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Pack · Trading</p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-4xl">You want to trade.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Here&apos;s the live market — and your bot, reading it with you.
          </p>
        </div>
        <WalletConnect />
      </div>

      {snapshot ? (
        <div className="grid gap-6 md:grid-cols-2">
          {(Object.keys(snapshot) as SymbolId[]).map((s) => (
            <section key={s} aria-label={`${s} chart`} className="rounded-md border border-line bg-surface/60 p-4 md:p-5">
              <PriceChart symbol={s} candles={snapshot[s]} />
            </section>
          ))}
        </div>
      ) : (
        <p role="alert" className="rounded border border-line bg-surface/60 p-4 text-sm text-muted">
          Live market data is unavailable right now. The bot can try again in a bit.
        </p>
      )}

      <BotAnalysis botName={botName} />

      <SwapQuotes />

      <section aria-labelledby="swap-heading" className="rounded-md border border-line bg-surface/60 p-4 md:p-5">
        <h2 id="swap-heading" className="text-sm font-medium">Trade for real</h2>
        <div className="mt-3"><SwapBox /></div>
      </section>
    </main>
    </SolanaProviders>
  );
}
