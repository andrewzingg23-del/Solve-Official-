"use client";

import { useState, useTransition } from "react";
import { disconnectApp } from "./actions";
import styles from "./apps.module.css";

/** connected: its own agent, reaching `spaces` Spaces. reconnect: connected before apps had their own access. */
export type ConnectedApp = { clientId: string; name: string; since: string; status: "connected" | "reconnect"; spaces: number; adds: number };

// The apps that can reach this person's SOLVE, and a way to cut each one off.
export function ConnectedApps({ apps }: { apps: ConnectedApp[] }) {
  const [gone, setGone] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const live = apps.filter(a => !gone.includes(a.clientId));
  if (live.length === 0) return <p className="s-muted" data-no-apps>No apps are connected.</p>;
  return <>
    <ul className={styles.reach}>{live.map(a => <li key={a.clientId} data-app={a.clientId}>
      <span className={styles.app}>
        <strong>{a.name}</strong>
        {a.status === "connected"
          ? <span className="s-muted s-small" data-app-health="connected">Connected since {a.since.slice(0, 10)} · {a.spaces === 0 ? "not let into any Space yet — choose in a Space" : `can reach ${a.spaces} Space${a.spaces === 1 ? "" : "s"}${a.adds ? `, adding in ${a.adds}` : ""}`}</span>
          : <span className="s-small" data-app-health="reconnect">Sign in again: this app was connected before apps had their own access, so it can&apos;t do anything now. Disconnect it here, then connect it again from your AI app — it will start with no access.</span>}
      </span>
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
