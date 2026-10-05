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
      <div className="flex flex-col gap-3">
        <Link href="/" className="text-sm font-semibold tracking-[0.3em] text-accent">
          solve
        </Link>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">The money system, running</h1>
        <p className="leading-7 text-muted">
          Each run starts a fresh, private simulation: the real kernel rules in an in-memory database and the real
          Solana token programs in a local runtime. Test assets with no value. Nothing is saved.
        </p>
      </div>
      <ProofOfLife />
      <SendBob />
      <Link href="/" className={quietLink}>
        Back
      </Link>
    </main>
  );
}
