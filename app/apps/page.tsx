import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { getUser, createClient } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { PageHead } from "@/app/ui/page-head";
import { Empty, listStyles } from "@/app/ui/list";
import { ConnectedApps, type ConnectedApp } from "./connected";
import { GithubTool, type ToolState } from "./tools";
import { githubConfig } from "@/lib/product/providers/github";
import { providerScope, readProvider } from "@/lib/product/credentials";
import { custodyOf, connectionNotice } from "@/lib/product/custody";
import styles from "./apps.module.css";

export const metadata: Metadata = { title: "Apps · Solve" };

// Apps: what you've connected, and how to bring the AI you already use. Solve runs no model of its
// own (DECISIONS.md, 2026-11-10: "It's everybody's outside LOLMs"), so the AI button lands here.
// There is no catalogue to discover yet, and the page doesn't pretend there is.
export default async function AppsPage() {
  const user = await getUser();
  let apps: ConnectedApp[] | null = [];
  let github: ToolState = { state: githubConfig() ? "none" : "unavailable" };
  if (user) {
    // What Supabase's OAuth server says the person approved, and what the kernel says each app may do.
    const [listed, kernelApps] = await Promise.all([
      (await createClient()).auth.oauth.listGrants().catch(() => null),
      getKernel().then(k => k.myConnections()).catch(() => null),
    ]);
    apps = listed && !listed.error && listed.data && kernelApps
      ? listed.data.map(g => {
          const live = kernelApps.find(c => c.client_id === g.client.id && !c.disconnected_at);
          const scopes = (live?.scopes ?? []) as { scope: string; capability: string }[];
          const spaces = new Set(scopes.filter(x => x.scope.startsWith("world:")).map(x => x.scope));
          const adds = new Set(scopes.filter(x => x.scope.startsWith("world:") && x.capability === "world.entity.write").map(x => x.scope));
          return { clientId: g.client.id, name: live?.label || g.client.name || "An app", since: live?.connected_at ?? g.granted_at,
            status: live ? "connected" as const : "reconnect" as const, spaces: spaces.size, adds: adds.size };
        })
      : null;
    // The person's GitHub, and which of their AI apps may use it — from the kernel.
    if (githubConfig() && kernelApps) {
      const kernel = await getKernel();
      const person = (await kernel.whoami().catch(() => null))?.actor_id;
      const conn = person ? await readProvider(kernel, person, "github").catch(() => null) : null;
      if (person && conn && conn.status !== "disconnected") {
        const scope = providerScope(person, "github");
        github = { state: conn.status, account: conn.account, apps: kernelApps.filter(c => !c.disconnected_at).map(c => ({
          clientId: c.client_id, name: c.label || "An app",
          allowed: ((c.scopes ?? []) as { scope: string }[]).some(g => g.scope === scope),
        })) };
      }
    }
  }
  // Who these connections belong to. A guest's belong to this browser alone, and saying so here is
  // the difference between a confusing fallback and an understandable one.
  const custody = custodyOf(user?.id ?? null, Boolean(user && !user.is_anonymous));
  const host = (await headers()).get("host") ?? "";
  const address = host ? `${host.startsWith("localhost") ? "http" : "https"}://${host}/mcp` : "/mcp";

  return <div>
    <PageHead label="Apps" title="Apps">Bring the tools and the AI you already use into your Space.</PageHead>

    <div className={styles.custody} data-custody={custody}>
      <p className="s-small">{connectionNotice(custody)}</p>
      {custody === "durable" ? null
        : <Link href="/login?next=%2Fapps" className="s-button" data-variant="quiet" data-custody-signin>Sign in</Link>}
    </div>

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

    <section className={listStyles.section} aria-labelledby="tools">
      <h2 id="tools">Your tools</h2>
      <ul className={listStyles.panel}><GithubTool tool={github} /></ul>
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
