"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { MINTS, getSwapOrder, deserializeTx, executeSwap } from "@/lib/jupiter/swap";
import { logSwap } from "./social-actions";

type Token = "SOL" | "USDC";

const DECIMALS: Record<Token, number> = { SOL: 9, USDC: 6 };

export function SwapBox() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [from, setFrom] = useState<Token>("SOL");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const to: Token = from === "SOL" ? "USDC" : "SOL";
  const flip = () => { setFrom(to); setAmount(""); setQuote(null); setStatus(null); };

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
      <p className="text-xs text-muted">Connect your wallet above to trade for real.</p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00" inputMode="decimal" aria-label={`Amount of ${from}`}
          className="w-full rounded-md border border-line bg-background px-3 py-2 font-mono text-sm tabular-nums"
        />
        <span className="shrink-0 rounded-full border border-line px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em]">{from}</span>
        <button onClick={flip} aria-label="Flip direction"
          className="shrink-0 rounded-full border border-line px-3 py-2 text-xs text-muted hover:text-foreground">⇅</button>
        <span className="shrink-0 text-[10px] uppercase tracking-[0.14em] text-muted">→ {to}</span>
      </div>
      {quote && <p className="font-mono text-sm text-accent">{quote}</p>}
      <div className="flex gap-2">
        <button onClick={getQuote} disabled={busy || !amount}
          className="rounded-full bg-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-background disabled:opacity-40">
          {busy ? "Working…" : "Get quote"}
        </button>
        {quote && (
          <button onClick={execute} disabled={busy}
            className="rounded-full border border-accent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent disabled:opacity-40">
            Swap for real
          </button>
        )}
      </div>
      {status && <p role="status" className="text-xs text-muted">{status}</p>}
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Real money · you sign · we never hold funds</p>
    </div>
  );
}
