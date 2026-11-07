import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import "./launch.css";

export const metadata: Metadata = {
  title: "SOV — Yours to make",
  description: "One living identity. Share who you are, connect, and make something real. Your AI is optional.",
};

export default async function LaunchPage() {
  const user = await getUser();
  if (user && !user.is_anonymous) redirect("/space");

  return <main className="sov-launch">
    <header className="sov-launch-nav">
      <Link href="/" className="sov-launch-mark" aria-label="SOV home">sov<span>.</span></Link>
      <nav aria-label="Explore SOLVE">
        <Link href="/card">The card</Link>
        <Link href="/space">Your Home</Link>
        <Link href="/login?next=%2Fcard">Sign in</Link>
      </nav>
    </header>

    <section className="sov-launch-hero" aria-labelledby="sov-launch-title">
      <div className="sov-launch-story">
        <span className="sov-launch-kicker">IDENTITY, MADE PERSONAL</span>
        <h1 id="sov-launch-title">Yours<br/>to make.</h1>
        <p>One living identity. A simpler way to meet people, share what matters, and make something happen.</p>
        <div className="sov-launch-hero-actions">
          <Link href="/card" className="sov-launch-primary">Make your card <span aria-hidden="true">↗</span></Link>
          <Link href="/space" className="sov-launch-secondary">Explore your Home <span aria-hidden="true">→</span></Link>
        </div>
        <p className="sov-launch-promise">Start free. No AI required. Nothing published without your choice.</p>
      </div>
      <div className="sov-launch-object" aria-label="Illustration of a horizontal SOV identity card">
        <div className="sov-launch-card">
          <div className="sov-launch-card-head"><strong>sov.</strong><span>IDENTITY</span></div>
          <div className="sov-launch-card-bottom">
            <div><strong>Your name.</strong><span>However you express it.</span></div>
            <div className="sov-launch-card-portrait" aria-hidden="true">S</div>
          </div>
          <div className="sov-launch-card-foot"><span>YOURS TO MAKE</span><span>01 / 02</span></div>
        </div>
        <p>One card. Two sides. Yours to personalize.</p>
      </div>
    </section>

    <section className="sov-launch-value" aria-labelledby="sov-launch-value-title">
      <div className="sov-launch-section-head"><span className="sov-launch-kicker">START WITH WHAT MATTERS</span><h2 id="sov-launch-value-title">Simple enough to use.<br/>Powerful enough to grow.</h2></div>
      <div className="sov-launch-value-grid">
        <article><span>01 / MEET</span><h3>Show who you are.</h3><p>Share a personal identity with a tap or a link. Let the other person save your approved contact details.</p></article>
        <article><span>02 / CONNECT</span><h3>Make the connection.</h3><p>Give someone a direct way to reach you without handing over more information than you choose.</p></article>
        <article><span>03 / MAKE</span><h3>Do something together.</h3><p>Go from an introduction to a project, a creation or a shared place in SOLVE when you're ready.</p></article>
      </div>
    </section>

    <section className="sov-launch-freedom" aria-labelledby="sov-launch-freedom-title">
      <div><span className="sov-launch-kicker">YOUR WAY, ALWAYS</span><h2 id="sov-launch-freedom-title">Make it feel like you.</h2></div>
      <div className="sov-launch-freedom-copy"><p>Start with a beautiful, usable default. Choose a second look. Change the details yourself—or ask Your AI to help when you want it.</p><p>AI is a shortcut, not a requirement. Privacy, contact sharing and payment approvals are never decided by visual customization.</p></div>
    </section>

    <section className="sov-launch-physical" aria-labelledby="sov-launch-physical-title">
      <div><span className="sov-launch-kicker">COMING TO YOUR POCKET</span><h2 id="sov-launch-physical-title">A card you can carry.</h2><p>We are developing an NFC SOV Card that opens your living identity. Target introductory price: $10, plus fulfillment. It's not yet for sale and is not a bank or payment card.</p></div>
      <Link href="/card">Try the digital card <span aria-hidden="true">↗</span></Link>
    </section>

    <footer className="sov-launch-footer">
      <span>sov. / by SOLVE</span>
      <span>Simple to use. Free to express. Yours to control.</span>
      <Link href="/bot">Your AI · optional</Link>
    </footer>
  </main>;
}
