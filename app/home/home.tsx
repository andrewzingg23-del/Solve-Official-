"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { readDeviceText, writeDeviceText } from "@/lib/client/device-storage";
import { custodyNotice, custodyOf } from "@/lib/product/custody";
import { greetingName } from "@/lib/product/greeting";
import { createThing } from "./actions";
import styles from "./home.module.css";

export type ThingSummary = { id: string; title: string; summary: string };

// Home: a person writes down what they want to do, and it becomes theirs — kept, with its history.
// Their words are held on the device while they type, so a refresh or a dropped connection never
// costs them anything; the device copy is a safety net, never the record.
export function Home({ owner, durable, name, things }: {
  owner: string | null; durable: boolean; name: string; things: ThingSummary[] | null;
}) {
  const router = useRouter();
  const key = `solve.draft.v2:${owner ?? "none"}`;
  const [text, setText] = useState("");
  const [id, setId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const custody = custodyOf(owner, durable);
  const first = greetingName(name);

  // Restore an unsent line after hydration, so a refresh never loses it.
  useEffect(() => {
    const kept = readDeviceText(key);
    if (kept) setText(kept); // eslint-disable-line react-hooks/set-state-in-effect -- one read of device storage after hydration
  }, [key]);

  function change(next: string) {
    setText(next);
    setError("");
    writeDeviceText(key, next || null);
  }

  function begin(event: React.FormEvent) {
    event.preventDefault();
    const words = text.trim();
    if (!words || pending) return;
    if (!owner) {
      if (!writeDeviceText(key, words)) { setError("Your browser can't keep this. Copy your words before reloading."); return; }
      router.push("/login?next=%2F");
      return;
    }
    start(async () => {
      try {
        const result = await createThing(id, words);
        if (!result.ok) { setError(result.error); return; }
        writeDeviceText(key, null);
        setText("");
        setId(crypto.randomUUID());
        router.refresh();
      } catch {
        setError("It wasn't recorded. Your words are still here; retry when you're connected.");
      }
    });
  }

  return <div className={styles.home}>
    <section className={styles.intro} aria-labelledby="home-title">
      <h1 id="home-title">{first ? `Hello, ${first}.` : "What do you want to do?"}</h1>
      <form className={styles.compose} onSubmit={begin}>
        <label htmlFor="home-words" className="s-visually-hidden">What do you want to do?</label>
        <textarea
          id="home-words" name="words" rows={2} maxLength={7000}
          className={styles.words} placeholder="Write it down — a thing to do, remember or make"
          value={text} onChange={event => change(event.target.value)} disabled={pending}
          onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); begin(event); } }}
        />
        <button type="submit" className="s-button" disabled={!text.trim() || pending}>{pending ? "Keeping…" : "Begin"}</button>
      </form>
      <p className={styles.custody} data-custody={custody}>{custodyNotice(custody)}</p>
      {error ? <p role="alert" className="s-error">{error}</p> : null}
    </section>

    <section aria-labelledby="home-things" className={styles.things}>
      <div className={styles.thingsHead}>
        <h2 id="home-things">Your things</h2>
        {things && things.length > 0 ? <Link href="/space" className="s-button" data-variant="link">All in Space</Link> : null}
      </div>
      {things === null
        ? <p role="status" className="s-muted">Your things couldn&apos;t be loaded. Nothing of yours has changed; try again shortly.</p>
        : things.length === 0
          ? <p className={styles.empty}>Nothing here yet. What you write down becomes yours — kept, with its whole history.</p>
          : <ul className={styles.grid}>
              {things.slice(0, 6).map(thing => <li key={thing.id}>
                <Link href={`/world/${encodeURIComponent(thing.id)}`} className={styles.thing} data-thing={thing.id}>
                  <strong>{thing.title}</strong>
                  <span className="s-muted s-small">{thing.summary && thing.summary !== thing.title ? thing.summary : "Open it"}</span>
                </Link>
              </li>)}
            </ul>}
    </section>
  </div>;
}
