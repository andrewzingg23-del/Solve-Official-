// The agent contract (Build Book §5): what the bot may do, where and until when, read from real
// records (its connections and its World grants), plus what the connector never offers (no tool
// spends, signs, publishes or changes access). Nothing here is a setting that pretends.
import Link from "next/link";
import { label, quietLink } from "@/app/ui";
import type { Connection } from "@/lib/bot/memory";
import { ACCESS_DAYS, type WorldWithAccess } from "@/lib/bot/worlds";

export function AgentContract({ botName, connections, worlds }: { botName: string; connections: Connection[]; worlds: WorldWithAccess[] }) {
  const adds = connections.filter((c) => c.mode === "remember");
  const addWorlds = worlds.filter((w) => w.access === "add").length;
  const readWorlds = worlds.filter((w) => w.access === "read").length;
  // Each World the bot was let into, so the boundary is a list you can open, not only a count
  // (from Manus's context ledger, pull request 6).
  const granted = worlds.filter((w) => w.access !== "none");
  const rows: [string, string][] = [
    [
      "Speaks through",
      connections.length ? connections.map((c) => `${c.clientName} (${c.mode === "remember" ? "read and add" : "read only"})`).join(", ") : "No assistant connected yet.",
    ],
    [
      "Memory",
      adds.length ? `Keeps what you or ${adds.map((c) => c.clientName).join(" or ")} give it. Each memory is sealed, and only you can erase it.` : "Nothing can add memories yet except you.",
    ],
    [
      "Worlds",
      addWorlds || readWorlds
        ? `Adds drafts in ${addWorlds} ${addWorlds === 1 ? "World" : "Worlds"}, reads ${readWorlds}. Each grant lasts ${ACCESS_DAYS} days and you can take it back.`
        : "Not let into any World yet.",
    ],
    ["Outside services", "None connected. Nothing reads your inbox, device or other accounts unless a connection appears here."],
    ["Money and access", "None. Connected assistants get no tool to spend, sign, publish or change who has access."],
    ["Real-world actions", "Drafts and proposals only. Anything with a real consequence waits for your approval."],
  ];
  return (
    <section aria-labelledby="agent-contract" className="relative overflow-hidden rounded-md border border-line bg-surface p-5 md:p-6">
      <span aria-hidden className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-accent/70 via-accent/10 to-transparent" />
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="agent-contract" className={label}>What {botName} may do</h2>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">From its grants and connections</p>
      </div>
      <dl className="mt-4 grid gap-x-6 gap-y-3 md:grid-cols-[11rem_1fr]">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted md:pt-0.5">{k}</dt>
            <dd className="text-sm leading-6">{v}</dd>
          </div>
        ))}
      </dl>
      {granted.length ? (
        <ul className="mt-4 flex flex-col divide-y divide-line border-t border-line">
          {granted.map((w) => (
            <li key={w.worldId} className="flex items-baseline justify-between gap-4 py-2 text-sm">
              <span className="min-w-0 truncate">{w.title}</span>
              <span className="flex shrink-0 items-baseline gap-4">
                <span className="text-xs text-muted">{w.access === "add" ? "reads and adds" : "reads"}</span>
                <Link href={`/world/${w.worldId}`} className={quietLink}>Open</Link>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
