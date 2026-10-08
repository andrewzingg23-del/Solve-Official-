"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MINTS, getSwapOrder, deserializeTx, executeSwap } from "@/lib/jupiter/swap";
import { field } from "@/app/ui";
import { logSwap } from "./social-actions";

type Token = "SOL" | "USDC";

const DECIMALS: Record<Token, number> = { SOL: 9, USDC: 6 };

// Real swap interface. Quotes and execution go through Jupiter from the
// connected wallet — no fake fills, no invented balances. Every status line
// tells the truth about where the trade stands.
export function SwapBox() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [from, setFrom] = useState<Token>("SOL");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [spun, setSpun] = useState(false);

  const to: Token = from === "SOL" ? "USDC" : "SOL";
  const flip = () => { setFrom(to); setAmount(""); setQuote(null); setStatus(null); setSpun((s) => !s); };

  // Listen for copy-trade events from the activity feed.
  useEffect(() => {
    const onCopy = (e: Event) => {
      const d = (e as CustomEvent).detail as { from: string; amount: string };
      if (d.from === "SOL" || d.from === "USDC") {
        setFrom(d.from);
        setAmount(d.amount);
        setQuote(null);
        setStatus("Copied — get a fresh quote to execute.");
      }
    };
    window.addEventListener("swap:copy", onCopy);
    return () => window.removeEventListener("swap:copy", onCopy);
  }, []);

  const getQuote = async () => {
    if (!publicKey || !amount || Number(amount) <= 0) return;
    setBusy(true); setStatus(null);
    try {
      const raw = BigInt(Math.floor(Number(amount) * 10 ** DECIMALS[from])).toString();
      const order = await getSwapOrder(MINTS[from], MINTS[to], raw, publicKey.toBase58());
      const out = Number(order.outAmount) / 10 ** DECIMALS[to];
      setQuote(`≈ ${out.toFixed(to === "USDC" ? 2 : 4)} ${to}`);
      setStatus(null);
      (window as unknown as { __swapOrder?: unknown }).__swapOrder = order;
      (window as unknown as { __swapOut?: string }).__swapOut = out.toFixed(to === "USDC" ? 2 : 4);
    } catch (e) {
      setStatus(`Quote failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  const execute = async () => {
    const order = (window as unknown as { __swapOrder?: { requestId: string; transaction: string } }).__swapOrder;
    if (!order || !signTransaction || !publicKey) return;
    setBusy(true); setStatus("Waiting for wallet signature…");
    try {
      const tx = deserializeTx(order.transaction);
      const signed = await signTransaction(tx);
      const bytes = signed.serialize();
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const sig = btoa(binary);
      setStatus("Submitting to Solana…");
      const result = await executeSwap(sig, order.requestId);
      setStatus(`Done — ${result.signature.slice(0, 8)}…${result.signature.slice(-8)}`);
      // Record the swap as a kernel event (powers the activity feed + copy trading).
      const outAmt = (window as unknown as { __swapOut?: string }).__swapOut;
      await logSwap({ from, to, inAmount: amount, outAmount: outAmt ?? "", signature: result.signature });
      setQuote(null);
    } catch (e) {
      setStatus(`Failed: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setBusy(false);
    }
  };

  if (!connected) {
    return (
      <p className="text-xs leading-5 text-muted">Connect your wallet above to trade for real.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-stretch gap-2">
        <input
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00" inputMode="decimal" aria-label={`Amount of ${from}`}
          className={`${field} font-mono tabular-nums`}
        />
        <span className="flex shrink-0 items-center rounded-xl border border-line bg-surface-sunken px-4 text-[11px] font-bold uppercase tracking-[0.14em] text-foreground">
          {from}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={flip}
          aria-label={`Flip direction, currently swapping to ${to}`}
          style={{ transform: spun ? "rotate(180deg)" : "rotate(0deg)" }}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line text-base text-muted transition-all duration-500 ease-calm hover:border-accent hover:text-accent hover:shadow-[0_0_20px_rgb(34_211_238/0.3)] active:scale-95"
        >
          ⇅
        </button>
        <p className="text-xs text-muted">
          Swapping to <span className="font-semibold text-foreground">{to}</span>
          <span className="text-faint"> · priced live by Jupiter</span>
        </p>
      </div>
      {quote && (
        <p
          key={quote}
          className="animate-[page-enter_0.45s_var(--ease-calm)] rounded-xl border border-line-soft bg-surface-sunken/60 px-4 py-3 font-mono text-lg text-accent tabular-nums"
          style={{ textShadow: "0 0 24px rgb(34 211 238 / 0.4)" }}
        >
          {quote}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={getQuote}
          disabled={busy || !amount}
          className="inline-flex h-12 flex-1 items-center justify-center rounded-full bg-accent px-6 text-[11px] font-bold uppercase tracking-[0.16em] text-accent-ink transition-all duration-300 ease-calm hover:brightness-110 active:scale-[0.98] disabled:opacity-40"
        >
          {busy ? "Working…" : "Get quote"}
        </button>
        {quote && (
          <button
            onClick={execute}
            disabled={busy}
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-line bg-surface/60 px-6 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground backdrop-blur-md transition-all duration-300 ease-calm hover:border-accent hover:text-accent active:scale-[0.98] disabled:opacity-40"
          >
            Swap for real
          </button>
        )}
      </div>
      {status && (
        <p
          key={status}
          role="status"
          className="animate-[page-enter_0.3s_var(--ease-calm)] text-xs leading-5 text-muted"
        >
          {status}
        </p>
      )}
      <p className="text-[10px] uppercase tracking-[0.14em] text-faint">
        Real money · you sign · we never hold funds
      </p>
    </div>
  );
}
