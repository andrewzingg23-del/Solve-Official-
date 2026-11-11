"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DESTINATIONS, destinationOf } from "@/lib/product/destinations";
import { Icon } from "./icons";
import styles from "./shell.module.css";
import { AiConsole } from "./ai-console";

// The approved shell (DECISIONS.md, 2026-11-10): four places — Space, People, Apps, Control — and,
// always in reach, Search, Add, AI, who can see your Space, and you. Nothing else is permanent
// navigation; whatever a person builds lives inside a Space. Pages reached from someone else's link
// get only the name "Solve." — never someone else's navigation.
export function Shell({ name, signedIn, publicSpace, identityKey, children }: {
  name: string; signedIn: boolean; publicSpace: boolean; identityKey: string; children: React.ReactNode;
}) {
  const path = usePathname();
  const [aiOpen, setAiOpen] = useState(false);
  const aiButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const root = document.documentElement;
    // After a tap or click, a save that moves focus mustn't pop the skip link up; Tab brings it back.
    const key = (event: KeyboardEvent) => { if (event.key === "Tab") delete root.dataset.pointer; };
    const pointer = () => { root.dataset.pointer = ""; };
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", pointer, true);
    return () => { window.removeEventListener("keydown", key, true); window.removeEventListener("pointerdown", pointer, true); };
  }, []);
  // One conversation surface on every screen. It remains mounted across
  // navigation so a person's current thread does not reset on every click.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAiOpen(value => !value);
      } else if (event.key === "Escape" && aiOpen) {
        setAiOpen(false);
        aiButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [aiOpen]);
  const active = destinationOf(path);
  const fromSomeoneElse = path.startsWith("/oauth") || path.startsWith("/world-invite");

  // A person's public pages are theirs edge to edge: they draw their own frame in their colours.
  if (path.startsWith("/p/") || path.startsWith("/s/")) return <>{children}</>;

  if (fromSomeoneElse) {
    return <div className={styles.bare}>
      <header className={styles.bareHead}><Link href="/" className={styles.brand}>Solve.</Link></header>
      <main className={styles.bareMain}>{children}</main>
    </div>;
  }

  const links = DESTINATIONS.map(d =>
    <Link key={d.href} href={d.href} className={styles.link} aria-current={active === d.href ? "page" : undefined}>
      <Icon name={d.icon} size={27} filled={active === d.href} /><span>{d.label}</span>
    </Link>);
  // Inside one of your Spaces, the add menu can add to it; that Space shows who can see it itself.
  const inSpace = /^\/world\/[^/]+$/.test(path) ? path : null;
  const initial = name.trim().replace(/^[^\p{L}\p{N}]+/u, "").charAt(0).toUpperCase();

  return <div className={styles.shell}>
    {/* Hidden after a tap or click until Tab is pressed again: after a save, Next can move focus to
        the first focusable element, which would otherwise pop this up for someone who never asked. */}
    <a href="#main" className={styles.skip}>Skip to content</a>
    <aside className={styles.rail} aria-label="Solve">
      <Link href="/" className={styles.brand} aria-label="Solve, your Space">Solve.</Link>
      <nav aria-label="Primary" className={styles.nav}>{links}</nav>
      <Link href="/account" className={styles.you} aria-label={`Your ID${name ? `, ${name}` : ""}`}>
        <span className={styles.avatar} aria-hidden="true">{initial || <Icon name="account" size={20} />}</span>
        <Icon name="down" size={20} />
        {!signedIn ? <span className="s-visually-hidden">, kept in this browser</span> : null}
      </Link>
    </aside>
    <div className={styles.body}>
      <header className={styles.top}>
        <Link href="/" className={`${styles.brand} ${styles.topBrand}`} aria-label="Solve, your Space">Solve.</Link>
        <form action="/search" role="search" className={styles.search}>
          <Icon name="search" size={24} />
          <label htmlFor="shell-search" className="s-visually-hidden">Search your Spaces</label>
          <input id="shell-search" name="q" type="search" placeholder="Search…" className={styles.searchInput} autoComplete="off" />
        </form>
        <div className={styles.actions}>
          <details key={path} className={styles.add}>
            <summary className={styles.pill}><Icon name="add" size={24} /><span>Add</span></summary>
            <div className={styles.menu} role="menu">
              {inSpace ? <Link role="menuitem" href={`${inSpace}#add`} className={styles.menuItem}>Add to this Space</Link> : null}
              <Link role="menuitem" href="/#begin" className={styles.menuItem}>New Space</Link>
              <Link role="menuitem" href="/people" className={styles.menuItem}>Add people</Link>
              <Link role="menuitem" href="/apps" className={styles.menuItem}>Connect apps</Link>
            </div>
          </details>
          <button
            type="button"
            ref={aiButton}
            className={`${styles.pill} ${styles.ai}`}
            aria-label="Talk with AI"
            aria-expanded={aiOpen}
            aria-controls="solve-ai-console"
            onClick={() => setAiOpen(value => !value)}
          >
            <Icon name="ai" size={24} /><span>AI</span>
          </button>
          <span className={styles.divider} aria-hidden="true" />
          {inSpace ? null : <Link href="/space" className={styles.pill} data-visibility={publicSpace ? "public" : "private"}
            aria-label={publicSpace ? "Your Space is public. Change who can see it" : "Your Space is private. Change who can see it"}>
            <Icon name={publicSpace ? "globe" : "lock"} size={24} /><span>{publicSpace ? "Public" : "Private"}</span><Icon name="down" size={18} />
          </Link>}
          <Link href="/account" className={styles.round} aria-label="Your ID"><Icon name="account" size={26} /></Link>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>{children}</main>
    </div>
    <nav aria-label="Primary mobile" className={styles.tabs}>{links}</nav>
    <AiConsole identityKey={identityKey} open={aiOpen} signedIn={signedIn} pathname={path} onClose={() => {
      setAiOpen(false);
      aiButton.current?.focus();
    }} />
  </div>;
}
