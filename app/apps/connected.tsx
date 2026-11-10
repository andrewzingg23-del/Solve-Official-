"use client";

import { useState, useTransition } from "react";
import { disconnectApp } from "./actions";
import styles from "./apps.module.css";

export type ConnectedApp = { clientId: string; name: string; since: string };

// The apps that can reach this person's SOLVE, and a way to cut each one off.
export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const live = apps.filter(a => !gone.includes(a.clientId));
  if (live.length === 0) return <p className="s-muted" data-no-apps>No apps are connected.</p>;
  return <>
    <ul className={styles.reach}>{live.map(a => <li key={a.clientId} data-app={a.clientId}>
      <span>{a.name}<span className="s-muted s-small"> · since {a.since.slice(0, 10)}</span></span>
      <button type="button" className="s-button" data-variant="quiet" disabled={pending} data-disconnect
        onClick={() => start(async () => {
          setError("");
          const result = await disconnectApp(a.clientId);
          if (!result.ok) { setError(result.error); return; }
          setGone(now => [...now, a.clientId]);
        })}>Disconnect</button>
    </li>)}</ul>
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </>;
}
