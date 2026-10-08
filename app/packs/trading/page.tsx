import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadBot } from "@/lib/bot/store";
import { marketSnapshot, candleStats, symbolLabel, type SymbolId, type Candle } from "@/lib/packs/trading";
import { SolanaProviders } from "@/lib/solana/providers";
import { primaryAction } from "@/app/ui";
import { Sparkline } from "../sparkline";
import { PriceChart } from "./chart";
import { BotAnalysis } from "./analysis";
import { WalletConnect } from "./wallet-connect";
import { SwapQuotes } from "./swap-quotes";
import { SwapBox } from "./swap";
import { SwapFeed } from "./social";
import { IntelCard } from "./intel-card";
import { Reveal } from "../reveal";
import { CountUp } from "../count-up";
import { MarketAurora } from "../market-aurora";
import { loginRequired } from "@/lib/auth/gate";

export const metadata: Metadata = { title: "Trading pack — solve" };

// Glance: the big number first, then trend, then detail — the Channel
// Analytics pattern. Derived from the same server-side snapshot candles the
// charts use: real data, one fetch, no second source of truth. The price
// counts up from the 24h-ago reference to the live value — both real numbers.
function HeroStrip({ candles }: { candles: Candle[] }) {
  const closes = candles.map((c) => c.close);
  const latest = closes[closes.length - 1];
  const ref = closes[Math.max(0, closes.length - 25)];
  const changePct = ((latest - ref) / ref) * 100;
  const up = changePct >= 0;
  const window = candles.slice(-24);
  const high = Math.max(...window.map((c) => c.high));
  const low = Math.min(...window.map((c) => c.low));
  const vol = window.reduce((a, c) => a + (c.volume || 0), 0);

  return (
    <section aria-label="Bitcoin at a glance" className="glass relative overflow-hidden p-6 md:p-8">
      <MarketAurora
        className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
        density={1.1}
      />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[rgb(4_7_13/0.6)]"
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow eyebrow-accent">Bitcoin · live</p>
          <span className="flex items-center gap-1.5 rounded-full bg-accent-dim px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
            <span className="fx-live-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
            Live
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-3">
          <p
            className="stat-number text-5xl text-foreground md:text-6xl"
            style={{ textShadow: "0 0 36px rgb(34 211 238 / 0.35)" }}
          >
            <CountUp value={latest} from={ref} format="usd" />
          </p>
          <p className={`mb-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${up ? "ok-pin" : "alert-pin"}`}>
            {up ? "+" : ""}
            {changePct.toFixed(2)}% · 24h
          </p>
        </div>
        <div className="mt-5">
          <Sparkline
            points={closes}
            width={640}
            height={88}
            animated
            glow
            fill
            className="block h-[88px] w-full"
            label={`Bitcoin hourly closes, ${up ? "up" : "down"} over the shown period`}
          />
        </div>
        <div className="proof-strip mt-5 grid grid-cols-3 gap-3 pt-4">
          {[
            { label: "24h high", value: `$${high.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
            { label: "24h low", value: `$${low.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
            { label: "24h volume", value: `${vol.toLocaleString("en-US", { maximumFractionDigits: 0 })} BTC` },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 90}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-faint">{s.label}</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-foreground md:text-base">{s.value}</p>
            </Reveal>
          ))}
        </div>
        <a href="#analysis" className={`${primaryAction} mt-6`}>
          Ask your bot
        </a>
      </div>
    </section>
  );
}

// Pinned to the charts when the market feed is down — an honest alert on
// the thing it describes, never a fake curve.
function MarketDown() {
  return (
    <div
      role="alert"
      className="glass border-[rgb(255_77_94/0.4)] bg-[rgb(255_77_94/0.08)] p-5 md:p-6"
    >
      <p className="text-sm font-medium text-negative">Live market data is unavailable right now.</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        The charts need the feed to come back. Your bot and your swaps are unaffected.
      </p>
    </div>
  );
}

export default async function TradingPackPage() {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/packs/trading");
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  const ownerId = me?.actor_id ?? "";
  // Guests have no kernel identity — the bot name degrades honestly instead
  // of 500ing (sign-in gate is off; visitors see this page).
  const bot = await loadBot(kernel).catch(() => null);
  const botName = bot?.avatar ? bot.persona.name : "Your bot";

  const snapshot = await marketSnapshot().catch(() => null);
  const btc = snapshot?.BTCUSDT ?? [];
  const hasMarket = btc.length >= 2;

  return (
    <SolanaProviders>
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-12 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Pack · Trading</p>
          <h1 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
            You want to <span className="serif-accent">trade.</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Here&apos;s the live market — and your bot, reading it with you.
          </p>
        </div>
        <WalletConnect />
      </div>

      {hasMarket ? <HeroStrip candles={btc} /> : <MarketDown />}

      <Reveal>
        <section aria-labelledby="intel-heading" className="grid gap-4 lg:grid-cols-2">
          <IntelCard
            href="/packs/trading/argus"
            kicker="Intel · Machine"
            title="ARGUS trading watch"
            desc="The watcher that never blinks — signal clouds orbiting the machine."
            cta="Open ARGUS"
            headingId="intel-heading"
          />
          <IntelCard
            href="/packs/trading/watchlist"
            kicker="Intel · Signals"
            title="The watchlist"
            desc="16 researched memecoin accounts, ranked by evidence. Caveats included, shills excluded."
            cta="Open watchlist"
          />
        </section>
      </Reveal>

      {snapshot ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {(Object.keys(snapshot) as SymbolId[]).map((s, i) => (
            <Reveal key={s} delay={i * 90}>
              <section aria-label={`${symbolLabel(s)} chart`} className="glass h-full p-5 md:p-6">
                <PriceChart symbol={s} candles={snapshot[s]} />
                <p className="mt-3 border-t border-line-soft pt-3 text-xs leading-5 text-faint tabular-nums">
                  {candleStats(snapshot[s])}
                </p>
              </section>
            </Reveal>
          ))}
        </div>
      ) : (
        <p className="text-xs leading-5 text-faint">
          Charts will appear here when the market feed returns.
        </p>
      )}

      <Reveal>
        <BotAnalysis botName={botName} />
      </Reveal>

      <Reveal>
        <section aria-labelledby="swap-heading" id="swap-box" className="glass scroll-mt-24 p-5 md:p-6">
          <p className="eyebrow eyebrow-accent">On-chain · Jupiter</p>
          <h2 id="swap-heading" className="mt-2 text-xl font-medium tracking-tight">Trade for real</h2>
          <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
            <SwapQuotes />
            <div>
              <p className="eyebrow">Your swap</p>
              <div className="mt-3">
                <SwapBox />
              </div>
            </div>
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section aria-labelledby="activity-heading" className="glass p-5 md:p-6">
          <p className="eyebrow">History</p>
          <h2 id="activity-heading" className="mt-2 text-xl font-medium tracking-tight">Your activity</h2>
          <p className="mt-1 text-xs leading-5 text-faint">Every swap, recorded. Tap copy on any trade to run it again.</p>
          <div className="mt-4">
            <SwapFeed ownerId={ownerId} />
          </div>
        </section>
      </Reveal>
    </main>
    </SolanaProviders>
  );
}
