"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disconnectTool, setToolUse } from "./actions";
import styles from "./apps.module.css";

export type ToolState =
  | { state: "unavailable" }
  | { state: "none" }
  | { state: "connected" | "reconnect"; account: string; apps: { clientId: string; name: string; allowed: boolean }[] };

// Your tools: the person's own accounts that Solve can use for them. GitHub first. Connecting goes
// through GitHub's own approval; the token stays sealed on Solve's server; each AI app needs the
// person's say-so to use it, and that can be withdrawn here at any time.
export function GithubTool({ tool }: { tool: ToolState }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const run = (act: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    setError("");
    const r = await act();
    if (!r.ok) setError(r.error ?? "That didn't work.");
    router.refresh();
  });
  return <li className={styles.tool} data-tool="github">
    <span className={styles.app}>
      <strong>GitHub</strong>
      {tool.state === "unavailable" ? <span className="s-muted s-small" data-tool-state="unavailable">Not available on this deployment yet.</span>
        : tool.state === "none" ? <span className="s-muted s-small" data-tool-state="none">Read your repositories into a Space. You choose which repositories.</span>
        : tool.state === "reconnect" ? <span className="s-small" data-tool-state="reconnect">GitHub needs you to sign in again (as @{tool.account}).</span>
        : <span className="s-muted s-small" data-tool-state="connected">Connected as @{tool.account} · read-only</span>}
    </span>
    {tool.state === "none" ? <a href="/apps/github/connect" className="s-button" data-variant="quiet" data-tool-connect>Connect</a> : null}
    {tool.state === "reconnect" ? <a href="/apps/github/connect" className="s-button" data-tool-connect>Reconnect</a> : null}
    {tool.state === "connected" || tool.state === "reconnect" ? <>
      {tool.apps.map(a => <label key={a.clientId} className={styles.allow}>
        <input type="checkbox" checked={a.allowed} disabled={pending} data-tool-use={a.clientId} onChange={e => run(() => setToolUse(a.clientId, "github", e.target.checked))} />
        <span className="s-small">Let {a.name} use it</span>
      </label>)}
      <button type="button" className="s-button" data-variant="quiet" disabled={pending} data-tool-disconnect onClick={() => run(() => disconnectTool("github"))}>Disconnect</button>
    </> : null}
    {error ? <p role="alert" className="s-error">{error}</p> : null}
  </li>;
}
