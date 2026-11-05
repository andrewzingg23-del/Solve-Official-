import Link from "next/link";
import { getUser } from "@/lib/supabase/server";
import { OptionalConnections } from "./optional-connections";
import "./onboarding.css";

export const metadata = {
  title: "Make SOV yours",
  description: "Start with your Space, then optionally add your favorite services.",
};

export default async function OnboardingPage() {
  const user = await getUser();
  const signedIn = Boolean(user && !user.is_anonymous);
  return <main className="solve-page sov-onboarding">
    <div className="sov-onboarding-hero">
      <div className="solve-kicker">Your Space · Onboarding</div>
      <h1>Make it yours.</h1>
      <p>Start creating now. Add your apps and accounts when you want them.</p>
      <div className="sov-onboarding-progress" aria-label="Setup steps">
        <span>01 · Identity</span><span>02 · Your Agent</span><span>03 · Apps (optional)</span><span>04 · Enter</span>
      </div>
    </div>

    <section className="sov-onboarding-identity" aria-labelledby="sov-identity-heading">
      <div><span className="solve-kicker">01 / Identity</span><h2 id="sov-identity-heading">Your SOV ID</h2>
        <p>{signedIn ? "Your sign-in is active. Personal account setup and ownership remain separate from public social Profiles." : "Explore without signing in. Sign in when you need durable ownership, account recovery or collaboration."}</p>
      </div>
      <div className="sov-onboarding-buttons">
        {signedIn ? <Link className="solve-button solve-button-secondary" href="/account">Account & security</Link> : <Link className="solve-button" href="/login?next=%2Fonboarding">Sign in or create account</Link>}
        <Link className="solve-button solve-button-secondary" href="/account">Personalize identity</Link>
      </div>
    </section>

    <section className="sov-onboarding-identity" aria-labelledby="sov-agent-heading">
      <div><span className="solve-kicker">02 / My Agent</span><h2 id="sov-agent-heading">A consistent companion</h2>
        <p>Your Agent can be personalized independently of the model or apps you choose. It starts without access to third-party accounts.</p></div>
      <div className="sov-onboarding-buttons"><Link className="solve-button solve-button-secondary" href="/bot">Customize Agent</Link></div>
    </section>

    <section className="sov-onboarding-apps" id="apps" aria-labelledby="sov-apps-heading">
      <span className="solve-kicker">03 / Connections · Optional</span>
      <h2 id="sov-apps-heading">Bring the tools you use.</h2>
      <p>Choose what interests you. A selection is never an actual connection; account authorization and Project permissions happen separately.</p>
      <OptionalConnections />
    </section>

    <section className="sov-onboarding-end">
      <div><span className="solve-kicker">04 / Enter Space</span><h2>You're ready.</h2><p>Nothing needs to be connected to start creating.</p></div>
      <div className="sov-onboarding-buttons"><Link href="/" className="solve-button">Enter my Space →</Link><Link href="/projects" className="solve-button solve-button-secondary">My Projects</Link></div>
    </section>
  </main>;
}
