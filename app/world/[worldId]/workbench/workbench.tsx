"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Icon } from "@/app/product/icons";
import { addWorkbenchNote } from "./actions";
import type { RealityMode } from "@/app/reality/mode";
import type { SpaceAppearance } from "@/lib/product/appearance";

type WorkPiece = { id: string; title: string; body: string; x: number; y: number; version: number };
type View = "list" | "canvas";

export function Workbench({ worldId, title, summary, pieces, mode, tone }: {
  worldId: string; title: string; summary: string; pieces: WorkPiece[]; mode: RealityMode; tone: SpaceAppearance["tone"];
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState("");
  const root = "/world/" + encodeURIComponent(worldId);
  const ordered = [...pieces].reverse();

  function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim() || pending) return;
    setResult("");
    const requestId = crypto.randomUUID();
    startTransition(async () => {
      try {
        const saved = await addWorkbenchNote(worldId, note, requestId);
        if (!saved.ok) { setResult(saved.error); return; }
        setNote("");
        setResult("Saved and confirmed in this World.");
        router.refresh();
      } catch {
        setResult("The save could not be confirmed. Your text is still here.");
      }
    });
  }

  return <main className={"reality-workbench" + (mode === "personal" ? " reality-workbench--personal" : "")} data-style-tone={tone}>
    <a href="#workbench-content" className="reality-skip">Skip to work</a>
    <header className="reality-workbench-head">
      <Link href="/" aria-label="SOLVE home">SOLVE</Link>
      <span>/</span><span>Workbench</span>
      <nav className="reality-workbench-head-links" aria-label="Workbench actions">
        <Link href="/bot"><Icon name="chat" width={16}/>Your AI</Link>
        <Link href={root + "/room"}><Icon name="community" width={16}/>Shared room</Link>
        <Link href="/space">Leave Workbench <Icon name="arrow" width={15}/></Link>
      </nav>
    </header>
    <div className="reality-workbench-layout">
      <nav className="reality-workbench-rail" aria-label="Workspace shortcuts">
        <Link href="/" aria-label="Home"><Icon name="home"/></Link>
        <Link href={root} aria-label="World details"><Icon name="projects"/></Link>
        <Link href="/bot" aria-label="Your AI"><Icon name="chat"/></Link>
        <Link href="/space" aria-label="Your Space"><Icon name="community"/></Link>
      </nav>
      <div className="reality-workbench-body" id="workbench-content">
        <div className="reality-workbench-heading">
          <div><small>YOUR WORLD / WORKBENCH</small><h1>{title}</h1><p>{summary || "A private place for the things you want to make happen."}</p></div>
          <div className="reality-workbench-actions">
            <Link href={root}>Documents & settings</Link>
            <Link href={root + "/room"}>Open shared room</Link>
          </div>
        </div>
        <div className="reality-workbench-main">
          <section className="reality-board" aria-label="Saved work">
            <div className="reality-board-head">
              <h2>Work <span style={{ color: "var(--r-muted)", fontSize: 12, marginLeft: 6 }}>{pieces.length}</span></h2>
              <div className="reality-board-views" role="group" aria-label="Workbench view">
                <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"}>List</button>
                <button type="button" onClick={() => setView("canvas")} aria-pressed={view === "canvas"}>Canvas</button>
              </div>
            </div>
            {view === "list" ?
              <div className="reality-board-content">{ordered.length ?
                <ul className="reality-items">{ordered.map(piece => <li key={piece.id}>
                  <div><strong>{piece.title}</strong>{piece.body ? <p>{piece.body.length > 310 ? piece.body.slice(0, 307) + "…" : piece.body}</p> : null}</div>
                  <Link href={root + "#piece-" + encodeURIComponent(piece.id)}>Edit <Icon name="arrow" width={13}/></Link>
                </li>)}</ul>
                : <div className="reality-empty"><strong>Start with something real.</strong>Add a note, decision, or next step. It will be saved in this World.</div>}</div>
              : <div className="reality-canvas" aria-label="Canvas preview of saved pieces">
                {pieces.length ? pieces.map(piece => <Link key={piece.id} className="reality-canvas-card" href={root + "#piece-" + encodeURIComponent(piece.id)} style={{ left: Math.min(Math.max(2,piece.x),67) + "%", top: Math.min(Math.max(2,piece.y),76) + "%" }}>
                  <strong>{piece.title}</strong><small>Open to edit · v{piece.version}</small>
                </Link>) : <div className="reality-empty"><strong>Empty canvas.</strong>Add something to your World to see it here.</div>}
              </div>}
          </section>
          <aside className="reality-inspector" aria-label="Add work and tools">
            <h2>Add to your World</h2>
            <p>Write a thought, task, decision or idea. Your actual saved records stay available to you and authorized collaborators.</p>
            <form className="reality-note-form" onSubmit={addNote}>
              <label htmlFor="workbench-note">What needs to happen?</label>
              <textarea id="workbench-note" placeholder="Describe a next step…" maxLength={7000} required value={note} onChange={event => {setNote(event.target.value);setResult("");}} disabled={pending}/>
              <button type="submit" disabled={!note.trim() || pending}>{pending ? "Saving…" : "Save to World"}</button>
            </form>
            {result ? <p className="reality-action-message" role="status">{result}</p> : null}
            <div className="reality-inspector-links">
              <Link href="/bot"><Icon name="chat" width={19}/>Your AI and its permissions</Link>
              <Link href={root + "/room"}><Icon name="community" width={19}/>Project conversation</Link>
              <Link href={root}><Icon name="community" width={19}/>People, access & files</Link>
              <Link href="/space"><Icon name="home" width={19}/>Customize your Space</Link>
            </div>
          </aside>
        </div>
      </div>
    </div>
    <nav className="reality-workbench-mobile" aria-label="Mobile Workbench navigation">
      <Link href="/"><Icon name="home"/>Home</Link>
      <Link href={root}><Icon name="projects"/>World</Link>
      <Link href="/bot"><Icon name="chat"/>Your AI</Link>
      <Link href="/space"><Icon name="community"/>Space</Link>
    </nav>
  </main>;
}
