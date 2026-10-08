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
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center gap-10 overflow-hidden px-4 py-14 pb-24 text-center">
      {/* ambient depth behind the reveal */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-96">
        <div className="absolute left-1/2 top-24 h-72 w-[44rem] -translate-x-1/2 rounded-full bg-accent/[0.06] blur-3xl" />
      </div>

      <style>{`
        @keyframes card-head-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-head {
          opacity: 0;
          animation: card-head-rise 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes card-section-rise {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-section {
          opacity: 0;
          animation: card-section-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes status-ping {
          0% { transform: scale(1); opacity: 0.8; }
          80%, 100% { transform: scale(2.6); opacity: 0; }
        }
        .status-ping { animation: status-ping 2.4s cubic-bezier(0.22, 1, 0.36, 1) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .card-head, .card-section { animation: none; opacity: 1; }
          .status-ping { animation: none; }
        }
      `}</style>

      <header className="card-head relative flex max-w-xl flex-col gap-4">
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
      <section aria-label="Card status" className="card-section proof-strip w-full max-w-md py-4" style={{ animationDelay: "650ms" }}>
        {liveCard ? (
          <div className="flex items-center justify-center gap-5">
            <p className="stat-number text-2xl text-foreground">···· {liveCard.last_four}</p>
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="status-ping absolute inline-flex h-full w-full rounded-full bg-accent" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-accent">{liveCard.state}</span>
            </span>
            <p className="text-[10px] uppercase tracking-[0.18em] text-faint">Sandbox</p>
          </div>
        ) : (
          <p className="text-xs leading-5 text-muted">No card issued yet — no real money moves.</p>
        )}
      </section>

      <section aria-labelledby="spend-heading" className="card-section glass w-full max-w-md p-5 text-left" style={{ animationDelay: "780ms" }}>
        <h2 id="spend-heading" className="eyebrow">Spend history</h2>
        <p className="mt-3 text-xs leading-5 text-muted">
          Nothing spent yet. When the card goes live, every transaction lands here — verifiably yours, visible only to you.
        </p>
      </section>
    </main>
  );
}
