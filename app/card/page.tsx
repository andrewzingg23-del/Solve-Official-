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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 px-4 py-14 pb-24 text-center">
      <header className="flex max-w-xl flex-col gap-4">
        <p className="eyebrow">SOV-ID card</p>
        <h1 className="text-4xl font-medium tracking-tight md:text-5xl">
          One card, <span className="serif-accent">two</span> faces.
        </h1>
        <p className="text-sm leading-6 text-muted">
          Your business card and your private spend card — same identity, the right face for the right person.
        </p>
      </header>

      <SovCard name={name} sovId={sovId} lastFour={liveCard?.last_four ?? null} />

      {/* Ambient proof — glanceable card status */}
      <section aria-label="Card status" className="proof-strip w-full max-w-md py-4">
        {liveCard ? (
          <div className="flex items-center justify-center gap-5">
            <p className="stat-number text-2xl text-foreground">···· {liveCard.last_four}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-accent">{liveCard.state}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Sandbox</p>
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted">No card issued yet — no real money moves.</p>
        )}
      </section>

      <section aria-labelledby="spend-heading" className="glass w-full max-w-md p-5 text-left">
        <h2 id="spend-heading" className="eyebrow">Spend history</h2>
        <p className="mt-3 text-xs leading-5 text-muted">
          Nothing spent yet. When the card goes live, every transaction lands here — verifiably yours, visible only to you.
        </p>
      </section>
    </main>
  );
}
