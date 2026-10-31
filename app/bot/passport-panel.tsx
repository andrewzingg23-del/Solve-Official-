// "Your SOV Passport" on Your AI: connect solve to the person's passport, see the ventures it holds,
// or disconnect. The passport stays its own app; solve reads it with the access the person approves.
import Link from "next/link";
import { Icon } from "@/app/product/icons";
import type { PassportProject } from "@/lib/passport/client";

export type PassportView =
  | { kind: "unlinked" }
  | { kind: "linked"; projects: PassportProject[] | null }
  | { kind: "reconnect" };

const OUTCOMES: Record<string, { tone: "ok" | "error"; text: string }> = {
  linked: { tone: "ok", text: "Your passport is connected. Your AI now starts every conversation knowing what it holds." },
  unlinked: { tone: "ok", text: "Disconnected. solve forgot its passport access; you can also remove solve on the passport itself." },
  denied: { tone: "error", text: "You denied the connection on your passport. Nothing was shared." },
  expired: { tone: "error", text: "That connection attempt expired. Start it again." },
  reconnect: { tone: "error", text: "Your passport no longer accepts solve's access. Connect again to restore it." },
  unavailable: { tone: "error", text: "Your passport didn't answer. Try again in a moment." },
};

export function PassportPanel({ view, passportUrl, outcome }: { view: PassportView; passportUrl: string; outcome?: string }) {
  const note = outcome ? OUTCOMES[outcome] : undefined;
  return (
    <section className="solve-panel solve-form" aria-labelledby="passport-heading">
      <span className="solve-kicker">SOV Passport</span>
      <h2 id="passport-heading">{view.kind === "linked" ? "Your passport is connected" : "Connect your SOV Passport"}</h2>
      {note ? <p className={note.tone === "ok" ? "solve-success" : "solve-error"} role="status">{note.text}</p> : null}
      {view.kind === "linked" ? (
        <>
          <p>Your AI reads your public, verified and working facts from your passport before it answers. Personal and sensitive facts never leave it.</p>
          {view.projects === null ? (
            <p className="solve-muted">Your ventures couldn&apos;t be loaded just now.</p>
          ) : view.projects.length ? (
            <ul className="solve-passport-projects">
              {view.projects.map((p) => (
                <li key={p.id || p.name}>
                  <strong>{p.name}</strong>
                  <span>{p.facts} fact{p.facts === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="solve-muted">No projects on your passport yet.</p>
          )}
          <div className="solve-profile-save">
            <a className="solve-text-link" href={passportUrl} target="_blank" rel="noopener noreferrer">Open your passport<Icon name="arrow" width={15} /></a>
            <form action="/api/passport/unlink" method="post">
              <button className="solve-button solve-button-secondary" type="submit">Disconnect</button>
            </form>
          </div>
        </>
      ) : (
        <>
          <p>
            One memory for every AI you use. Connect it and your AI here knows your ventures, your preferences and your projects,
            the same facts Claude and ChatGPT read. You approve on your passport with your passkey; solve gets read access and can
            suggest memories, which wait for your approval there.
          </p>
          <Link className="solve-button" href="/api/passport/connect" prefetch={false}>
            {view.kind === "reconnect" ? "Reconnect your passport" : "Connect your passport"}
            <Icon name="arrow" width={16} />
          </Link>
        </>
      )}
    </section>
  );
}
