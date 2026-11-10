import type { Metadata } from "next";
import { headers } from "next/headers";
import { getUser, createClient } from "@/lib/supabase/server";
import { PageHead } from "@/app/ui/page-head";
import { Empty, listStyles } from "@/app/ui/list";
import { ConnectedApps, type ConnectedApp } from "./connected";
import styles from "./apps.module.css";

export const metadata: Metadata = { title: "Apps · Solve" };

// Apps: what you've connected, and how to bring the AI you already use. Solve runs no model of its
// own (DECISIONS.md, 2026-11-10: "It's everybody's outside LOLMs"), so the AI button lands here.
// There is no catalogue to discover yet, and the page doesn't pretend there is.
export default async function AppsPage() {
  const user = await getUser();
  let apps: ConnectedApp[] | null = [];
  if (user) {
    const listed = await (await createClient()).auth.oauth.listGrants().catch(() => null);
    apps = listed && !listed.error && listed.data
      ? listed.data.map(g => ({ clientId: g.client.id, name: g.client.name || "An app", since: g.granted_at }))
      : null;
  }
  const host = (await headers()).get("host") ?? "";
  const address = host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/mcp` : "/mcp";

  return <div>
    <PageHead label="Apps" title="Apps">Bring the tools and the AI you already use into your Space.</PageHead>

    <section className={listStyles.section} aria-labelledby="connected">
      <h2 id="connected">Connected</h2>
      <div className={listStyles.panel}>
        {apps === null
          ? <p role="status" className="s-muted" style={{ padding: 16 }}>This couldn&apos;t be read right now. Nothing has changed.</p>
          : apps.length === 0
            ? <Empty icon="apps" title="No apps connected"><span className="s-muted s-small">Connect your AI below to start.</span></Empty>
            : <ConnectedApps apps={apps} />}
      </div>
    </section>

    <section id="ai" className={listStyles.section} aria-labelledby="ai-title">
      <h2 id="ai-title">Connect your AI</h2>
      <div className="s-surface s-stack">
        <p>Solve has no AI of its own. Connect the one you already use — Claude, ChatGPT or another that supports connectors — and it can read your Spaces and add drafts to the ones you let it into. It can&apos;t pay, buy or delete anything, and everything it adds is labelled as coming from it.</p>
        <ol className={styles.steps}>
          <li>In your AI app, add a custom connector.</li>
          <li>Give it this address:</li>
        </ol>
        <p className={styles.address} data-mcp-address>{address}</p>
        <p className="s-muted s-small">It will open Solve and ask you to approve. You can disconnect it here at any time, and it stops at once.</p>
      </div>
    </section>
  </div>;
}
