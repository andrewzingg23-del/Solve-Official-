import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { Icon } from "@/app/product/icons";

export const metadata = { title: "Control — SOV" };

export default async function ControlPage() {
  const user = await getUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  return <main className="solve-page">
    <header className="solve-page-heading">
      <span className="solve-kicker">Control</span>
      <h1>Your identity. Your permissions.</h1>
      <p>See the services you authorize, decide what your Agent may access, and change your preferences whenever you want.</p>
    </header>
    <div className="solve-two-columns">
      <section className="solve-panel">
        <span className="solve-kicker">SOV ID</span>
        <h2 className="mt-3">{signedIn ? "Signed in" : "Guest or signed out"}</h2>
        <p className="my-3">{signedIn ? "Your account session is active. Review account details and kernel identity status in Account." : "You can explore without connecting accounts. Sign in to recover work across devices and manage protected resources."}</p>
        <Link href={signedIn ? "/account" : "/login?next=%2Fcontrol"} className="solve-button solve-button-secondary">{signedIn ? "Identity & security" : "Sign in"} <Icon name="arrow" width={16}/></Link>
      </section>
      <section className="solve-panel">
        <span className="solve-kicker">Connected apps · optional</span>
        <h2 className="mt-3">Bring your tools.</h2>
        <p className="my-3">Choose apps for later setup, or connect a compatible assistant using the existing SOV MCP authorization flow. Selecting an app does not grant any access.</p>
        <div className="solve-profile-save"><Link href="/onboarding#apps" className="solve-button">Browse apps <Icon name="arrow" width={16}/></Link><Link href="/apps" className="solve-text-link">My app surfaces →</Link><Link href="/bot?section=connections" className="solve-text-link">AI connectors →</Link></div>
      </section>
      <section className="solve-panel">
        <span className="solve-kicker">My Agent</span><h2 className="mt-3">AI & permissions</h2>
        <p className="my-3">Review your AI persona, existing MCP authorizations, and Project-specific access. No connection is implied by its appearance here.</p>
        <Link href="/bot" className="solve-text-link">Manage Agent →</Link>
      </section>
      <section className="solve-panel">
        <span className="solve-kicker">Tasks & budgets</span><h2 className="mt-3">Only verified outcomes.</h2>
        <p className="my-3">Real external operations need supported provider adapters, an authorized context and a bounded execution path. Unconfigured providers and unknown usage must never be shown as active or paid.</p>
        <Link href="/projects" className="solve-text-link">Open Projects →</Link>
      </section>
    </div>
  </main>;
}
