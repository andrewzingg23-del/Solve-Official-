import Link from "next/link";
import { label, quietLink } from "@/app/ui";
import type { Connection, Memory } from "@/lib/bot/memory";
import type { WorldWithAccess } from "@/lib/bot/worlds";

type Props = {
  botName: string;
  connections: Connection[];
  memories: Memory[];
  worlds: WorldWithAccess[];
};

function accessLabel(access: WorldWithAccess["access"]) {
  return access === "add" ? "Read + add" : "Read only";
}

export function ContextLedger({ botName, connections, memories, worlds }: Props) {
  const grantedWorlds = worlds.filter((world) => world.access !== "none");
  const memoryWriters = connections.filter((connection) => connection.mode === "remember");
  const sources = [
    { name: "Worlds", value: String(grantedWorlds.length), detail: grantedWorlds.length ? "Granted to this avatar" : "No World grants yet" },
    { name: "Memory", value: String(memories.length), detail: memories.length ? "Readable saved memories" : "Nothing saved yet" },
    { name: "Assistants", value: String(connections.length), detail: connections.length ? "Approved connections" : "No assistant connected" },
    { name: "Outside streams", value: "0", detail: "Nothing connected by default" },
  ];

  return (
    <section aria-labelledby="context-ledger-title" className="flex flex-col gap-5 rounded-md border border-line bg-surface p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className={label}>Context ledger</p>
          <h2 id="context-ledger-title" className="mt-2 text-xl font-medium tracking-tight">What {botName} can use right now</h2>
        </div>
        <span className="text-[11px] uppercase tracking-[0.18em] text-positive">Explicit grants only</span>
      </div>
      <p className="max-w-3xl text-sm leading-6 text-muted">
        This is the avatar&apos;s current context boundary. Nothing here implies access to your device, inbox, or an outside service unless a connection and grant appear below.
      </p>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {sources.map((source) => (
          <div key={source.name} className="rounded-md border border-line bg-background/60 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{source.name}</p>
            <p className="mt-2 text-2xl font-medium tracking-tight">{source.value}</p>
            <p className="mt-1 text-xs leading-5 text-muted">{source.detail}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 border-t border-line pt-5 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className={label}>Granted Worlds</p>
          {grantedWorlds.length ? (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {grantedWorlds.slice(0, 6).map((world) => (
                <li key={world.worldId} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0"><p className="truncate text-sm">{world.title}</p><p className="text-xs text-muted">{accessLabel(world.access)}</p></div>
                  <Link href={world.url || `/world/${world.worldId}`} className={quietLink}>Open</Link>
                </li>
              ))}
            </ul>
          ) : <p className="rounded-md border border-dashed border-line p-4 text-sm leading-6 text-muted">Let {botName} into a World when you want it to read or add there.</p>}
        </div>

        <div className="flex flex-col gap-3">
          <p className={label}>Connected context</p>
          {connections.length ? (
            <ul className="flex flex-col divide-y divide-line border-y border-line">
              {connections.map((connection) => (
                <li key={connection.clientId} className="flex items-center justify-between gap-4 py-3"><span className="text-sm">{connection.clientName}</span><span className="text-xs text-muted">{connection.mode === "remember" ? "Read + add memory" : "Read only"}</span></li>
              ))}
            </ul>
          ) : <p className="rounded-md border border-dashed border-line p-4 text-sm leading-6 text-muted">Connect Claude, ChatGPT, Meta Muse, or another approved assistant when you want one to speak through {botName}.</p>}
          <p className="text-xs leading-5 text-muted">{memoryWriters.length ? `${memoryWriters.map((connection) => connection.clientName).join(" and ")} may add memories when you approve that connection.` : "Only you can add memories until an assistant is explicitly allowed to add them."}</p>
        </div>
      </div>
    </section>
  );
}
