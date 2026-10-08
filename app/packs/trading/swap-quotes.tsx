import { getSolUsdcQuotes } from "@/lib/jupiter/quotes";
import { Reveal } from "../reveal";

// Live Jupiter quotes — real numbers from the quote API, or nothing.
// Renders as the glance half of the swap panel.
export async function SwapQuotes() {
  const quotes = await getSolUsdcQuotes().catch(() => null);
  if (!quotes || (!quotes.solToUsdc && !quotes.usdcToSol)) return null;
  return (
    <Reveal>
      <div aria-labelledby="quotes-heading" className="rounded-2xl border border-line-soft bg-surface-sunken/60 p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Live quotes</p>
          <span className="fx-live-dot h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
        </div>
        <h3 id="quotes-heading" className="mt-2 text-sm font-medium text-muted">
          What you&apos;d get right now
        </h3>
        <div className="mt-4 flex flex-col gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-faint">1 SOL →</p>
            <p
              className="stat-number mt-1 text-3xl text-foreground"
              style={{ textShadow: "0 0 26px rgb(34 211 238 / 0.22)" }}
            >
              {quotes.solToUsdc ? `$${quotes.solToUsdc.toFixed(2)}` : "—"}
              <span className="ml-2 text-sm font-medium tracking-normal text-muted">USDC</span>
            </p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-faint">100 USDC →</p>
            <p
              className="stat-number mt-1 text-3xl text-foreground"
              style={{ textShadow: "0 0 26px rgb(34 211 238 / 0.22)" }}
            >
              {quotes.usdcToSol ? quotes.usdcToSol.toFixed(4) : "—"}
              <span className="ml-2 text-sm font-medium tracking-normal text-muted">SOL</span>
            </p>
          </div>
        </div>
        <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-faint">
          Live · swaps execute from your wallet
        </p>
      </div>
    </Reveal>
  );
}
