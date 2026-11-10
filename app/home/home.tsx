"use client";

import { becomeGuest } from "@/lib/supabase/become-guest";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { readDeviceText, writeDeviceText } from "@/lib/client/device-storage";
import { custodyNotice, custodyOf } from "@/lib/product/custody";
import { Icon } from "@/app/ui/icons";
import { createThing } from "./actions";
import styles from "./home.module.css";

export type ThingSummary = { id: string; title: string; summary: string };

// Your Space: the approved shell's centre, exactly as drawn. The title switches between your
// Spaces; the box makes a new one from your words and takes you into it. SOLVE runs no model of its
// own, so nothing typed here is sent to an AI: your words become the Space. Words are held on the
// device while you type, so a refresh or a dropped connection never costs anything.
export function Home({ owner, durable, things }: {
  owner: string | null; durable: boolean; things: ThingSummary[] | null;
}) {
  const router = useRouter();
  const key = `solve.draft.v2:${owner ?? "none"}`;
  const [text, setText] = useState("");
  const [id] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const custody = custodyOf(owner, durable);

  // Restore an unsent line after hydration, so a refresh never loses it.
  useEffect(() => {
    const kept = readDeviceText(key);
    if (kept) setText(kept); // eslint-disable-line react-hooks/set-state-in-effect -- one read of device storage after hydration
  }, [key]);
  // "New Space" from the Add menu lands here, ready to type.
  useEffect(() => { if (window.location.hash === "#begin") input.current?.focus(); }, []);

  function change(next: string) {
    setText(next);
    setError("");
    writeDeviceText(key, next || null);
  }

  function begin(event: React.FormEvent) {
    event.preventDefault();
    const words = text.trim();
    if (!words || pending) return;
    start(async () => {
      try {
        // No identity yet: make one here and keep going. Never a sign-in screen just to start.
        if (!owner) {
          if (!writeDeviceText(key, words)) { setError("Your browser can't keep this. Copy your words before reloading."); return; }
          if (!(await becomeGuest())) { setError("Solve couldn't get you set up just now. Your words are kept here; try again in a moment."); return; }
        }
        const result = await createThing(id, words);
        if (!result.ok) { setError(result.error); return; }
        writeDeviceText(key, null);
        router.push(`/world/${encodeURIComponent(result.id)}`);
      } catch {
        setError("It wasn't kept. Your words are still here; try again when you're connected.");
      }
    });
  }

  return <div className={styles.home}>
    <section className={styles.centre} aria-labelledby="home-title">
      <details className={styles.switcher}>
        <summary className={styles.title}>
          <h1 id="home-title">Your Space</h1><Icon name="down" size={20} />
        </summary>
        <div className={styles.spaces} role="menu" aria-label="Your Spaces">
          <span className="s-label">Your Spaces</span>
          {things === null
            ? <p role="status" className="s-muted s-small">Your Spaces couldn&apos;t be loaded. Nothing has changed.</p>
            : things.length === 0
              ? <p className="s-muted s-small">None yet. Write something below to make your first.</p>
              : things.map(thing => <Link key={thing.id} role="menuitem" href={`/world/${encodeURIComponent(thing.id)}`} className={styles.spaceItem} data-thing={thing.id}>
                  <Icon name="lock" size={16} /><span>{thing.title}</span>
                </Link>)}
          <button type="button" role="menuitem" className={styles.spaceItem} onClick={event => {
            (event.currentTarget.closest("details") as HTMLDetailsElement).open = false;
            input.current?.focus();
          }}><Icon name="add" size={16} /><span>Create a new Space</span></button>
        </div>
      </details>
      <p className={styles.subtitle}>Private by default. Yours to shape.</p>

      <div className={styles.composeWrap}>
      <form id="begin" className={styles.compose} onSubmit={begin}>
        <Icon name="ai" size={30} />
        <span className={styles.bar} aria-hidden="true" />
        <label htmlFor="home-words" className="s-visually-hidden">Ask, create, or add anything</label>
        <input ref={input} id="home-words" name="words" maxLength={7000} autoComplete="off"
          className={styles.words} placeholder="Ask, create, or add anything…"
          value={text} onChange={event => change(event.target.value)} disabled={pending} />
        <button type="submit" className={styles.go} disabled={!text.trim() || pending} aria-label={pending ? "Keeping" : "Make it a Space"}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
      {error ? <p role="alert" className={`s-error ${styles.error}`}>{error}</p> : <p className={styles.custody} data-custody={custody}>{custodyNotice(custody)}</p>}
      </div>

      <div className={styles.chips}>
        <Link href="/people" className={styles.chip}><PersonAdd />Add people</Link>
        <Link href="/apps" className={styles.chip}><Icon name="apps" size={26} />Connect apps</Link>
        <button type="button" className={styles.chip} onClick={() => input.current?.focus()}><Layers />Add to Space</button>
      </div>
    </section>
  </div>;
}

function PersonAdd() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="8" r="3.6" /><path d="M3.5 20c.7-3.7 3.3-5.8 6.5-5.8 1.4 0 2.6.4 3.6 1.1M18 14v6M15 17h6" />
  </svg>;
}

function Layers() {
  return <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
  </svg>;
}
