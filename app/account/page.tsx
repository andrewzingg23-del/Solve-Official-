import Link from "next/link";
import { redirect } from "next/navigation";
import { KernelError, type Actor, type KernelEvent } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { primaryAction, quietLink, secondaryAction } from "@/app/ui";
import { registerActor, signOut } from "./actions";
import { loginRequired } from "@/lib/auth/gate";

const eventNames: Record<string, string> = {
  "kernel.actor.registered": "SOV ID created",
  "kernel.actor.created": "Agent created",
  "kernel.grant.issued": "Authority granted",
  "kernel.grant.revoked": "Authority revoked",
  "kernel.scope.claimed": "Scope claimed",
  "kernel.evidence.attached": "Evidence attached",
  "kernel.account.opened": "Account opened",
  "kernel.ledger.posted": "Ledger posting",
};

type AccountRecord =
  | { state: "ready"; actor: Actor; events: KernelEvent[] }
  | { state: "unregistered" }
  | { state: "unavailable"; message: string };

async function loadRecord(): Promise<AccountRecord> {
  const kernel = await getKernel();
  try {
    const actor = await kernel.whoami();
    const events = await kernel.readEvents(`actor:${actor.actor_id}`, { newestFirst: true, limit: 12 });
    return { state: "ready", actor, events };
  } catch (error) {
    if (!(error instanceof KernelError)) throw error;
    if (error.name === "unauthenticated") return { state: "unregistered" };
    return { state: "unavailable", message: error.message };
  }
}

export default async function AccountPage() {
  // proxy.ts already redirects signed-out visitors; this is the real check.
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/account");

  const record = await loadRecord();

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-10 px-4 py-16">
      <div className="flex flex-col gap-4">
        <p className="eyebrow">Your record</p>
        <h1 className="text-5xl font-medium tracking-tight md:text-6xl">
          Your <span className="serif-accent">ID</span>.
        </h1>
      </div>

      {/* Dossier hero — the ID is the monument */}
      <section aria-label="Your identity" className="glass p-6 md:p-8">
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">SOV ID</p>
            <p className="mt-3 break-all font-mono text-base leading-relaxed text-accent md:text-lg">
              {record.state === "ready" ? record.actor.actor_id : "Not issued"}
            </p>
          </div>
          <div className="proof-strip flex gap-8 py-4">
            <div className="min-w-0">
              <p className="eyebrow">Email</p>
              <p className="mt-1 truncate text-sm text-foreground">{user?.email ?? "Not signed in"}</p>
            </div>
            <div>
              <p className="eyebrow">Joined</p>
              <p className="mt-1 text-sm text-foreground">
                {user ? new Date(user.created_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {record.state === "ready" && (
        <section aria-labelledby="history-heading" className="flex flex-col gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="history-heading" className="eyebrow">History</h2>
            <p className="text-xs text-faint">Append-only — each entry seals the one before it.</p>
          </div>
          <ol className="glass flex flex-col divide-y divide-line-soft p-2">
            {record.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm text-foreground">{eventNames[event.type] ?? event.type}</span>
                  <span className="truncate font-mono text-xs text-faint">
                    #{event.seq} ·{" "}
                    {new Date(event.occurred_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <span className="shrink-0 rounded-full border border-line-soft px-2.5 py-1 font-mono text-[10px] text-faint" title={event.hash}>
                  {event.hash.slice(0, 8)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {record.state === "unregistered" && (
        <form action={registerActor} className="glass flex flex-col gap-4 p-6">
          <p className="text-sm text-muted">Your SOV ID hasn&apos;t been issued yet.</p>
          <button type="submit" className={`${primaryAction} w-fit`}>
            Issue my SOV ID
          </button>
        </form>
      )}

      {record.state === "unavailable" && (
        <div className="glass flex flex-col gap-2 rounded-xl p-5 text-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Record unavailable</p>
          <p className="text-muted">
            {user
              ? "Your record can't be reached right now. Check back in a bit."
              : "Sign in and claim your ID and your record will live here."}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        <Link href="/" className={quietLink}>
          Back
        </Link>
        <form action={signOut}>
          <button type="submit" className={secondaryAction}>
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
