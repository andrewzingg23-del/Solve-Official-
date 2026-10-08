import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { moneyEnabled } from "@/lib/flags";
import { quietLink } from "@/app/ui";
import { ProofOfLife, SendBob } from "./runner";

export const metadata: Metadata = { title: "Money, running · solve" };

// A run takes a few seconds: an in-memory kernel and chain start from nothing each time.
export const maxDuration = 60;

// Off unless ENABLE_MONEY is set: money is not part of the Build 1 path (lib/flags.ts).
export default function MoneyPage() {
  if (!moneyEnabled()) notFound();
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-12">
      <div className="relative flex flex-col gap-4">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-[260px] w-[560px] -translate-x-1/2 rounded-[50%] bg-accent/[0.08] blur-3xl" />
        <Link href="/" className="relative text-sm font-semibold tracking-[0.3em] text-accent">
          solve
        </Link>
        <p className="eyebrow relative">The ledger, live</p>
        <h1 className="relative text-4xl font-medium leading-tight tracking-tight md:text-6xl">
          The money system, <span className="serif-accent">running</span>.
        </h1>
        <p className="relative max-w-2xl leading-7 text-muted">
          Each run starts a fresh, private simulation: the real kernel rules in an in-memory database and the real
          Solana token programs in a local runtime. Test assets with no value. Nothing is saved.
        </p>
        <div className="proof-strip relative flex flex-wrap gap-x-8 gap-y-2 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Test assets · no value</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Real kernel rules</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">Nothing is saved</span>
        </div>
      </div>
      <ProofOfLife />
      <SendBob />
      <Link href="/" className={quietLink}>
        Back
      </Link>
    </main>
  );
}
