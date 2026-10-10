// Server-rendered controls backed by the existing consent and private-memory actions.
import { RecoverableForm } from "@/app/product/recoverable-form";
import { randomUUID } from "node:crypto";
import type { Connection, Memory } from "@/lib/bot/memory";
import { MEMORY_LIMITS } from "@/lib/bot/memory";
import { Icon } from "@/app/product/icons";
import { addMemoryAction, disconnectAction, forgetMemoryAction } from "./actions";
import { CopyField } from "./copy-field";

const ASSISTANTS = [
  {
    name: "Claude",
    steps: "In Settings, open Connectors and add a custom connector with this URL. Continue to solve, sign in and review the requested permissions.",
  },
  {
    name: "ChatGPT",
    steps: "If your account supports custom MCP apps, enable Developer mode in Settings → Apps. Create a custom app with this URL and OAuth authentication, then sign in to solve and review the permissions.",
  },
];

export function Connections({ botName, connectorUrl, connections }: { botName: string; connectorUrl: string; connections: Connection[] }) {
  return (
    <div className="solve-two-columns solve-ai-connections">
      <section className="solve-panel solve-ai-card" aria-labelledby="authorized-connections">
        <div className="solve-ai-card-heading"><Icon name="lock" /><h2 id="authorized-connections">Authorized assistants</h2></div>
        <p>These assistants can read {botName}&apos;s persona and private knowledge. Each connection has the mode you approved.</p>
        {connections.length === 0 ? (
          <div className="solve-ai-small-empty">
            <p>No assistants are connected.</p>
            <p>Add a connector in your assistant, then review its permissions on solve.</p>
          </div>
        ) : (
          <ul className="solve-ai-records">
            {connections.map((connection) => (
              <li key={connection.clientId} className="solve-ai-record">
                <div>
                  <h3>{connection.clientName}</h3>
                  <p>{connection.mode === "remember" ? "Reads and adds" : "Read only"}</p>
                  <p className="solve-ai-record-meta">Authorized {new Date(connection.since).toLocaleDateString()}</p>
                </div>
                <form action={disconnectAction}>
                  <input type="hidden" name="client_id" value={connection.clientId} />
                  <input type="hidden" name="request_id" value={randomUUID()} />
                  <button type="submit" className="solve-ai-revoke" aria-label={`Revoke ${connection.clientName} access`}>Revoke access</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="solve-ai-fineprint">To change a mode, revoke the connection and authorize it again. Revoking stops future access; it does not remove information the assistant has already read.</p>
      </section>

      <section className="solve-panel solve-ai-card" aria-labelledby="connect-assistant">
        <div className="solve-ai-card-heading"><Icon name="plus" /><h2 id="connect-assistant">Connect an assistant</h2></div>
        <p>Use this MCP connector URL in an assistant that supports remote MCP with OAuth. You choose its permissions on solve.</p>
        <CopyField value={connectorUrl} name="MCP connector URL" />
        <dl className="solve-ai-modes">
          <div><dt>Read only</dt><dd>Reads your persona, private knowledge and project context your AI is allowed to see.</dd></div>
          <div><dt>Reads and adds</dt><dd>Can also keep knowledge you approve and add to projects where your AI has Add access.</dd></div>
        </dl>
        <details className="solve-ai-setup">
          <summary>Claude and ChatGPT setup</summary>
          <ul>
            {ASSISTANTS.map((assistant) => (
              <li key={assistant.name}><h3>{assistant.name}</h3><p>{assistant.steps}</p></li>
            ))}
          </ul>
          <p className="solve-ai-fineprint">Custom connector availability and settings depend on your assistant&apos;s plan and workspace policy. Connecting does not import or automatically sync its chat history.</p>
        </details>
      </section>
    </div>
  );
}

export function Knowledge({ botName, memories, ownerId }: { botName: string; memories: Memory[]; ownerId: string }) {
  return (
    <section className="solve-panel solve-ai-card" aria-labelledby="private-knowledge">
      <div className="solve-ai-card-heading"><Icon name="document" /><h2 id="private-knowledge">Private knowledge</h2></div>
      <p>Notes you or your authorized assistants have given {botName} to keep. Project members do not receive this private knowledge automatically.</p>
      <RecoverableForm action={addMemoryAction} className="solve-form solve-ai-memory-form" ownerActorId={ownerId} successMessage="Knowledge saved privately to your account.">
        <label htmlFor="memory-text">What should your AI remember?</label>
        <textarea id="memory-text" name="text" required maxLength={MEMORY_LIMITS.text} rows={4} placeholder="A preference, a decision or context you want to keep" />
        <div className="solve-ai-memory-fields">
          <div><label htmlFor="memory-title">Label <span>(optional)</span></label><input id="memory-title" name="title" maxLength={MEMORY_LIMITS.title} placeholder="For example, how I like to work" /></div>
          <div><label htmlFor="memory-url">Source link <span>(optional)</span></label><input id="memory-url" name="url" type="url" maxLength={MEMORY_LIMITS.url} placeholder="https://" /></div>
        </div>
        <button type="submit" className="solve-button">Keep this knowledge</button>
      </RecoverableForm>
      <p className="solve-ai-fineprint">Keep passwords and access keys out of memories. Erasing a sealed memory permanently removes its words; older unsealed records can only be hidden.</p>

      <div className="solve-ai-knowledge-list">
        <h3>Recent knowledge</h3>
        {memories.length === 0 ? (
          <div className="solve-ai-small-empty"><p>No knowledge has been saved yet.</p><p>Add a note above or review an export before importing it.</p></div>
        ) : (
          <>
            <p className="solve-ai-fineprint">Showing up to {MEMORY_LIMITS.read} recent readable memories.</p>
            <ul className="solve-ai-records">
              {memories.map((memory) => (
                <li key={memory.id} id={`memory-${memory.id}`} className="solve-ai-record solve-ai-memory">
                  <div>
                    {memory.source.title ? <h4>{memory.source.title}</h4> : null}
                    <p className="solve-ai-memory-text">{memory.text}</p>
                    <p className="solve-ai-record-meta">
                      {memory.via.client_name ? `Via ${memory.via.client_name}` : "From you"} · {new Date(memory.at).toLocaleString()}
                      {!memory.sealed ? " · Older unsealed record" : ""}
                      {memory.source.url ? <> · <a href={memory.source.url} rel="noreferrer noopener" target="_blank">View source</a></> : null}
                    </p>
                  </div>
                  <form action={forgetMemoryAction}>
                    <input type="hidden" name="memory_id" value={memory.id} />
                    <button type="submit" className="solve-ai-revoke" aria-label={`${memory.sealed ? "Erase" : "Hide"} ${memory.source.title || "memory from " + new Date(memory.at).toLocaleDateString()}`}>{memory.sealed ? "Erase" : "Hide"}</button>
                  </form>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
