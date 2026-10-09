// Component journey against the real SQL kernel behind the isolated fixture
// server. Auth sessions and model completion are explicit fixtures, not live services.
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RoomView, type RoomData } from "../../app/world/[worldId]/room/view";
import { ArtifactEditor } from "../../app/world/[worldId]/artifact-editor";
import { InvitationPanel, type InvitationListItem, type InvitationState } from "../../app/world/[worldId]/invitation-panel";
import type { CreativeArtifact } from "../../lib/world/creative";

type State = { data: RoomData; artifact: CreativeArtifact; invitations: InvitationListItem[]; owner: boolean };

async function fixture(path: string, body: unknown) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error);
  return result;
}

function App() {
  const [state, setState] = useState<State | null>(null);
  const [view, setView] = useState("room");
  const [error, setError] = useState("");
  const refresh = async () => {
    const res = await fetch("/fixture/state");
    if (!res.ok) { setError("Fixture access denied"); return; }
    setState(await res.json());
  };
  useEffect(() => {
    void fetch("/fixture/state").then(async res => {
      if (!res.ok) { setError("Fixture access denied"); return; }
      setState(await res.json());
    });
    const listener = () => { void refresh(); };
    window.addEventListener("fixture-refresh", listener);
    return () => window.removeEventListener("fixture-refresh", listener);
  }, []);
  async function create(_previous: InvitationState, form: FormData): Promise<InvitationState> {
    const result = await fixture("/fixture/invite", { role: form.get("role") });
    await refresh(); return result;
  }
  async function cancel(invitationId: string) {
    const result = await fixture("/fixture/cancel", { invitationId });
    await refresh(); return result;
  }
  return <>
    <nav aria-label="Fixture controls" className="flex flex-wrap gap-4 border-b border-line bg-surface p-3 text-xs">
      <span className="text-muted">Local kernel fixture · provider simulated</span>
      <button onClick={() => setView("room")}>Open room</button><button onClick={() => setView("details")}>Open access and documents</button><button onClick={() => void refresh()}>Refresh shared state</button>
    </nav>
    {error ? <p role="alert">{error}</p> : null}
    {!state ? <p>Loading fixture…</p> : view === "room" ? <RoomView data={state.data} /> : <main className="mx-auto flex max-w-3xl flex-col gap-5 p-5">
      <h1 className="text-2xl">{state.data.title} · shared details</h1>
      {state.owner ? <InvitationPanel create={create} cancel={cancel} invitations={state.invitations} now={state.data.now} /> : null}
      <section aria-label="Specification editor" className="rounded border border-line p-4"><h2 className="text-lg">Specification · v{state.artifact.version}</h2><ArtifactEditor worldId={state.data.worldId} artifact={state.artifact} /></section>
    </main>}
  </>;
}

createRoot(document.getElementById("app")!).render(<App />);
