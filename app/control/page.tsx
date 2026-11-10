import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { reachFrom, type Reach } from "@/lib/product/access";
import { PageHead } from "@/app/ui/page-head";
import { ExportButton } from "./export-button";
import { ConnectedApps, type ConnectedApp } from "./apps";
import { createClient } from "@/lib/supabase/server";
import styles from "./control.module.css";

export const metadata: Metadata = { title: "Control · SOLVE" };

// Control: what a person can reach, and the way out. Rebuilt from zero (2026-11-10) — every line on
// it is read from the kernel; nothing here describes a capability that isn't there.
export default async function ControlPage() {
  const user = await getUser();
  let reach: Reach[] | null = [];
  let apps: ConnectedApp[] | null = [];
  if (user) {
    const listed = await (await createClient()).auth.oauth.listGrants().catch(() => null);
    apps = listed && !listed.error && listed.data
      ? listed.data.map(g => ({ clientId: g.client.id, name: g.client.name || "An app", since: g.granted_at }))
      : null;
    try {
      const kernel = await getKernel();
      const me = await kernel.whoami();
      const [grants, things] = await Promise.all([kernel.myGrants(), myThings(kernel)]);
      reach = reachFrom(grants, { actorId: me.actor_id, things: Object.fromEntries((things ?? []).map(t => [t.id.toLowerCase(), t.title])) });
    } catch {
      reach = null;
    }
  }
  return <div>
    <PageHead label="Control" title="You decide.">
      What you can reach, who else can reach what&apos;s yours, and how to take it all with you.
    </PageHead>

    <div className={styles.grid}>
      <section className="s-surface s-stack" aria-labelledby="reach">
        <h2 id="reach">What you can reach</h2>
        {reach === null
          ? <p role="status" className="s-muted">This couldn&apos;t be read right now. Nothing has changed.</p>
          : reach.length === 0
            ? <p className="s-muted">Nothing yet.</p>
            : <ul className={styles.reach}>{reach.map(r => <li key={r.what}>
                <span>{r.what}</span>
                <span className="s-muted s-small">{r.can.join(" · ")}</span>
              </li>)}</ul>}
        <p className="s-muted s-small">Who else can reach one of your things is shown on that thing.</p>
      </section>

      <section className="s-surface s-stack" aria-labelledby="apps">
        <h2 id="apps">Connected apps</h2>
        <p className="s-muted">AI assistants and other apps you let into SOLVE. They can read what you can. They can&apos;t change your things directly; anything one adds goes through your bot, only where you allowed it, and is labelled. Disconnecting stops one at once.</p>
        {apps === null
          ? <p role="status" className="s-muted">This couldn&apos;t be read right now. Nothing has changed.</p>
          : <ConnectedApps apps={apps} />}
      </section>

      <section className="s-surface s-stack" aria-labelledby="leave">
        <h2 id="leave">Take it with you</h2>
        <p className="s-muted">Everything that&apos;s yours — your things, their history, your card — in one file you keep. Nothing of anyone else&apos;s is in it.</p>
        <ExportButton />
      </section>
    </div>
  </div>;
}
