import Link from "next/link";
import { redirect } from "next/navigation";
import { KernelError, type Actor, type KernelEvent } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { label, quietLink, secondaryAction } from "@/app/ui";
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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-10 px-4 py-16">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold tracking-[0.3em] text-accent">solve</p>
        <h1 className="text-2xl font-semibold tracking-tight">Your record</h1>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
        <dt className={label}>SOV ID</dt>
        <dd className="truncate font-mono text-xs leading-5 text-accent">
          {record.state === "ready" ? record.actor.actor_id : "Not issued"}
        </dd>
        <dt className={label}>Email</dt>
        <dd className="truncate">{user?.email ?? "Not signed in"}</dd>
        <dt className={label}>Joined</dt>
        <dd>
          {user ? new Date(user.created_at).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
        </dd>
      </dl>

      {record.state === "ready" && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className={label}>History</h2>
            <p className="text-xs text-muted">Append-only. Each entry seals the one before it.</p>
          </div>
          <ol className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
            {record.events.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="flex min-w-0 flex-col">
                  <span>{eventNames[event.type] ?? event.type}</span>
                  <span className="truncate text-xs text-muted">
                    #{event.seq} ·{" "}
                    {new Date(event.occurred_at).toLocaleString("en-US", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-xs text-muted" title={event.hash}>
                  {event.hash.slice(0, 12)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {record.state === "unregistered" && (
        <form action={registerActor} className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
          <p className="text-sm text-muted">Your SOV ID hasn&apos;t been issued yet.</p>
          <button type="submit" className={`${secondaryAction} w-fit`}>
            Issue my SOV ID
          </button>
        </form>
      )}

      {record.state === "unavailable" && (
        <div className="flex flex-col gap-2 rounded-md border border-negative/30 bg-negative/10 p-4 text-sm">
          <p className={label}>Kernel unreachable</p>
          <p className="text-muted">
            Apply <code className="font-mono text-foreground">supabase/migrations</code> and expose the{" "}
            <code className="font-mono text-foreground">kernel_api</code> schema. ({record.message})
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
