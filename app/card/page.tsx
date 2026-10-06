import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { isConfigured, listCards } from "@/lib/lithic/sandbox";
import { SovCard } from "./card-visual";
import { loginRequired } from "@/lib/auth/gate";

export const metadata: Metadata = { title: "Your card — solve" };

export default async function CardPage() {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/card");
  const kernel = await getKernel();
  const me = await kernel.whoami().catch(() => null);
  const name = me?.label || "Your name";
  const sovId = me?.actor_id || "";

  const cards = isConfigured() ? await listCards().catch(() => []) : [];
  const liveCard = cards[0];

  return (
    <div data-theme="dark" className="min-h-svh bg-background text-foreground">
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 pb-24">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Your ID</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight md:text-4xl">One card, two faces.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Your business card and your private spend card — same identity, showing the right face to the right person.
        </p>
      </div>

      <section aria-labelledby="wallet-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-5 md:p-6">
        <h2 id="wallet-heading" className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Card status</h2>
        {liveCard ? (
          <div>
            <p className="font-mono text-4xl tracking-tight md:text-5xl">···· {liveCard.last_four}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{liveCard.state} · Sandbox — no real money moves</p>
          </div>
        ) : (
          <div>
            <p className="text-2xl font-medium tracking-tight">No card issued yet</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Connect a Solana wallet and your USDC balance shows up here. Spend settles on Solana; the card issuer plugs in next.
            </p>
          </div>
        )}
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Lithic sandbox · Rain/Baanx for production</p>
      </section>

      <SovCard name={name} sovId={sovId} />

      <section aria-labelledby="spend-heading" className="flex flex-col gap-3 rounded-md border border-line bg-surface/60 p-4 md:p-5">
        <h2 id="spend-heading" className="text-lg font-medium">Spend history</h2>
        <p className="text-xs leading-5 text-muted">
          Nothing spent yet. When the card goes live, every transaction lands here — verifiably yours, visible only to you.
        </p>
      </section>
    </main>
    </div>
  );
}
