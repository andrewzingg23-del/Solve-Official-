// The signed-in person's side of the connector: the URL to give their assistant, who is connected,
// and what their bot remembers. Server-rendered; every change is a server action and a kernel record.
import { randomUUID } from "node:crypto";
import { label } from "@/app/ui";
import type { Connection, Memory } from "@/lib/bot/memory";
import { MEMORY_LIMITS } from "@/lib/bot/memory";
import { addMemoryAction, disconnectAction, forgetMemoryAction } from "./actions";
import { CopyField } from "./copy-field";

const ASSISTANTS = [
  { name: "Claude", steps: "Settings → Connectors → Add custom connector, paste the URL, then sign in to Sovereign." },
  { name: "ChatGPT", steps: "Settings → Apps & Connectors → turn on Developer mode, create a connector with the URL, then sign in. Needs Plus, Pro or a business plan." },
  { name: "Meta AI (Muse)", steps: "Ask Muse to add a custom connector with this URL, then sign in to Sovereign when it asks." },
];

export function Connections({ botName, connectorUrl, connections, memories, live }: { botName: string; connectorUrl: string; connections: Connection[]; memories: Memory[]; live?: React.ReactNode }) {
  return (
    <section className="grid gap-8 border-t border-line pt-8 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        {live}
        <div className="flex flex-col gap-2">
          <p className={label}>Bring your own AI</p>
          <h2 className="text-xl font-medium">Let your assistant become {botName}</h2>
          <p className="text-sm leading-6 text-muted">
            Add this connector to the assistant you already use. You approve it on Sovereign&apos;s own page and choose whether it may only read or also remember.
          </p>
        </div>
        <CopyField value={connectorUrl} name="Connector URL" />
        <ul className="flex flex-col gap-3">
          {ASSISTANTS.map((a) => (
            <li key={a.name} className="rounded-md border border-line p-3">
              <p className="text-sm">{a.name}</p>
              <p className="text-xs leading-5 text-muted">{a.steps}</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-3">
          <p className={label}>Connected</p>
          {connections.length === 0 ? (
            <p className="text-sm text-muted">No assistant is connected yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {connections.map((c) => (
                <li key={c.clientId} className="flex items-center justify-between gap-3 rounded-md border border-line p-3">
                  <span className="flex flex-col">
                    <span className="text-sm">{c.clientName}</span>
                    <span className="text-xs text-muted">{c.mode === "remember" ? "Reads and remembers" : "Read only"} · since {new Date(c.since).toLocaleDateString()}</span>
                  </span>
                  <form action={disconnectAction}>
                    <input type="hidden" name="client_id" value={c.clientId} />
                    <input type="hidden" name="request_id" value={randomUUID()} />
                    <button className="text-xs font-semibold uppercase tracking-[0.2em] text-muted transition-colors duration-300 ease-calm hover:text-negative">Disconnect</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <p className={label}>{botName}&apos;s memory</p>
          <p className="text-sm leading-6 text-muted">
            What you or your connected assistants have told {botName} to keep. Each memory is sealed with its own key, so forgetting one erases its words for good; the record only keeps that it existed. Still, never store passwords or keys here.
          </p>
        </div>
        <form action={addMemoryAction} className="flex flex-col gap-2">
          <textarea name="text" required maxLength={MEMORY_LIMITS.text} rows={3} placeholder={`Tell ${botName} something to remember`} className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-accent" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <input name="title" maxLength={MEMORY_LIMITS.title} placeholder="Label (optional)" className="h-10 min-w-0 rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent" />
            <input name="url" type="url" maxLength={MEMORY_LIMITS.url} placeholder="Source link (optional)" className="h-10 min-w-0 rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent" />
            <button className="h-10 rounded-md bg-accent px-4 text-xs font-semibold uppercase tracking-[0.2em] text-background">Remember</button>
          </div>
        </form>
        {memories.length === 0 ? (
          <p className="text-sm text-muted">Nothing yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {memories.map((m) => (
              <li key={m.id} id={`memory-${m.id}`} className="flex items-start justify-between gap-3 rounded-md border border-line p-3">
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="whitespace-pre-wrap break-words text-sm leading-6">{m.text}</span>
                  <span className="text-xs text-muted">
                    {[m.source.title, m.via.client_name ? `via ${m.via.client_name}` : "from you", new Date(m.at).toLocaleString(), m.sealed ? null : "older memory: forgetting hides it"].filter(Boolean).join(" · ")}
                    {m.source.url ? (
                      <>
                        {" · "}
                        <a href={m.source.url} rel="noreferrer noopener" target="_blank" className="underline decoration-line hover:text-accent">source</a>
                      </>
                    ) : null}
                  </span>
                </span>
                <form action={forgetMemoryAction}>
                  <input type="hidden" name="memory_id" value={m.id} />
                  <button className="text-xs uppercase tracking-[0.2em] text-muted transition-colors duration-300 ease-calm hover:text-negative">{m.sealed ? "Erase" : "Forget"}</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
