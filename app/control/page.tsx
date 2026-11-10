import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { myThings } from "@/lib/product/my-things";
import { reachFrom, type Reach } from "@/lib/product/access";
import { PageHead } from "@/app/ui/page-head";
import { Row, listStyles } from "@/app/ui/list";
import { ExportButton } from "./export-button";

export const metadata: Metadata = { title: "Control · Solve" };

// Control: who you are, who can see what, what's connected, what you can reach, and the way out.
// Every line is read from the kernel; nothing here describes a capability that isn't there.
export default async function ControlPage() {
  const user = await getUser();
  let reach: Reach[] | null = [];
  if (user) {
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
    <PageHead label="Control" title="Control">You decide who you are here, who sees what, and what comes in.</PageHead>

    <div className={listStyles.panel}>
      <Row icon="account" title="Your ID" note="Your name, your card and how Solve looks" href="/account" />
      <Row icon="lock" title="Privacy & sharing" note="Who can see your Space" href="/space" />
      <Row icon="ai" title="Apps & AI" note="What's connected, and how to disconnect it" href="/apps" />
    </div>

    <section className={listStyles.section} aria-labelledby="reach">
      <h2 id="reach">What you can reach</h2>
      <div className={listStyles.panel}>
        {reach === null
          ? <p role="status" className="s-muted" style={{ padding: 16 }}>This couldn&apos;t be read right now. Nothing has changed.</p>
          : reach.length === 0
            ? <p className="s-muted" style={{ padding: 16 }}>Nothing yet.</p>
            : reach.map(r => <Row key={r.what} title={r.what} note={r.can.join(" · ")} />)}
      </div>
      <p className="s-muted s-small">Who else can reach one of your Spaces is shown inside that Space.</p>
    </section>

    <section className={listStyles.section} aria-labelledby="leave">
      <h2 id="leave">Take it with you</h2>
      <div className="s-surface s-stack">
        <p className="s-muted">Everything that&apos;s yours — your Spaces, their history, your ID — in one file you keep. Nothing of anyone else&apos;s is in it.</p>
        <div><ExportButton /></div>
      </div>
    </section>
  </div>;
}
