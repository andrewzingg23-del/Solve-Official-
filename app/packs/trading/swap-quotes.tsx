import { getSolUsdcQuotes } from "@/lib/jupiter/quotes";

export async function SwapQuotes() {
  const quotes = await getSolUsdcQuotes().catch(() => null);
  if (!quotes || (!quotes.solToUsdc && !quotes.usdcToSol)) return null;
  return (
    <section aria-labelledby="swap-heading" className="rounded-md border border-line bg-surface/60 p-4 md:p-5">
      <h2 id="swap-heading" className="text-sm font-medium">On-chain · Jupiter</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="uppercase tracking-[0.14em] text-muted text-[10px]">1 SOL →</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {quotes.solToUsdc ? `$${quotes.solToUsdc.toFixed(2)}` : "—"}
          </p>
          <p className="text-muted">USDC</p>
        </div>
        <div>
          <p className="uppercase tracking-[0.14em] text-muted text-[10px]">100 USDC →</p>
          <p className="mt-1 font-mono text-lg tabular-nums">
            {quotes.usdcToSol ? quotes.usdcToSol.toFixed(4) : "—"}
          </p>
          <p className="text-muted">SOL</p>
        </div>
      </div>
      <p className="mt-3 text-[10px] uppercase tracking-[0.14em] text-muted">
        Live quotes · swaps execute from your wallet — we never hold your funds
      </p>
    </section>
  );
}
