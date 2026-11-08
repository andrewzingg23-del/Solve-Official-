"use client";

import { useState } from "react";
import Link from "next/link";
import { createSovVCard } from "@/lib/product/sov-contact";
import { SolveBrand } from "@/app/product/solve-brand";

export type PublicSovIdentity = {
  publicId: string;
  name: string;
  handle: string;
  line: string;
  about: string;
  email: string;
  website: string;
  featured: string;
  appearance: "default" | "secondary";
};

export function PublicSovCard({ identity }: { identity: PublicSovIdentity }) {
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);

  function saveContact() {
    const content = createSovVCard({
      name: identity.name,
      email: identity.email,
      website: identity.website || (typeof window !== "undefined" ? window.location.href : undefined),
    });
    if (!content) return;
    const href = URL.createObjectURL(new Blob([content], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = "sov-contact.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  return <main className={`sov-experience sov-public-identity sov-look-${identity.appearance}`}>
    <header className="sov-experience-header">
      <SolveBrand href="/" compact />
      <span className="sov-public-label">A person's public SOV ID</span>
    </header>
    <div className="sov-experience-body">
      <section className="sov-card-intro" aria-labelledby="sov-public-name">
        <span className="sov-overline">SOV / ID</span>
        <h1 id="sov-public-name">{identity.name}</h1>
        <p>{identity.line || "A living identity."}</p>
      </section>

      <section className="sov-card-area" aria-label="Two-sided identity card">
        <button type="button" className="sov-flip-surface" onClick={() => setFlipped(value => !value)}
          aria-label={`Flip card. Currently showing ${flipped ? "back" : "front"}.`}>
          <div className={`sov-flip-inner ${flipped ? "is-flipped" : ""}`}>
            <div className="sov-paper-face sov-paper-front">
              <div className="sov-card-top"><span className="sov-card-brand">sov.</span><span className="sov-card-kind">IDENTITY</span></div>
              <div className="sov-card-name-row">
                <div className="sov-card-person"><strong>{identity.name}</strong><span>{identity.handle ? `@${identity.handle}` : identity.line || "Your way."}</span></div>
                <div className="sov-card-portrait" aria-hidden="true"><span>{identity.name.charAt(0).toUpperCase()}</span></div>
              </div>
              <div className="sov-card-base"><span>YOURS TO MAKE</span><span>01 / 02</span></div>
            </div>
            <div className="sov-paper-face sov-paper-back">
              <div className="sov-card-top"><span className="sov-card-brand">sov.</span><span className="sov-card-kind">CONNECT</span></div>
              <div className="sov-card-back-copy">
                <strong>{identity.name}</strong>
                <span>{identity.line || "A simpler way to stay in touch."}</span>
                <small>Save · Connect · Explore</small>
              </div>
              <div className="sov-card-base"><span>ONE IDENTITY. YOUR WAY.</span><span>02 / 02</span></div>
            </div>
          </div>
        </button>
        <div className="sov-card-controls">
          <button type="button" onClick={() => setFlipped(value => !value)}>↻ <span>Flip card</span></button>
          <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
            {expanded ? "Close details" : "Expand"} <span aria-hidden="true">{expanded ? "−" : "+"}</span>
          </button>
        </div>
      </section>

      <section className="sov-card-utility" aria-label="Connect with this person">
        <button type="button" onClick={saveContact}>
          <span className="sov-action-symbol" aria-hidden="true">↓</span>
          <strong>Save contact</strong><small>Save to your device</small>
        </button>
        {identity.email ? <a href={`mailto:${identity.email}`}>
          <span className="sov-action-symbol" aria-hidden="true">↗</span>
          <strong>Connect</strong><small>Send an email</small>
        </a> : <button type="button" disabled><span className="sov-action-symbol" aria-hidden="true">↗</span><strong>Connect</strong><small>Not provided</small></button>}
        {identity.featured ? <a href={identity.featured} target="_blank" rel="noopener noreferrer">
          <span className="sov-action-symbol" aria-hidden="true">↗</span><strong>Explore</strong><small>Featured work</small>
        </a> : identity.website ? <a href={identity.website} target="_blank" rel="noopener noreferrer">
          <span className="sov-action-symbol" aria-hidden="true">↗</span><strong>Explore</strong><small>Website</small>
        </a> : <button type="button" disabled><span className="sov-action-symbol" aria-hidden="true">↗</span><strong>Explore</strong><small>No public link</small></button>}
      </section>

      {expanded ? <section className="sov-expanded-identity">
        <span className="sov-overline">ABOUT</span>
        <h2>{identity.name}</h2>
        <p>{identity.about || identity.line || "This person hasn't added a longer introduction."}</p>
        {identity.website ? <a href={identity.website} target="_blank" rel="noopener noreferrer">Visit website ↗</a> : null}
        {identity.featured ? <a href={identity.featured} target="_blank" rel="noopener noreferrer">Open featured work ↗</a> : null}
      </section> : null}

      <section className="sov-public-invitation" aria-labelledby="sov-public-invitation-heading">
        <span className="sov-overline">MAKE IT YOURS</span>
        <h2 id="sov-public-invitation-heading">Everyone has a story.</h2>
        <p>Create your own digital SOV ID. You can start without AI or a physical card.</p>
        <Link href={`/card?via=${encodeURIComponent(identity.publicId)}`} className="sov-primary-action">Create your card ↗</Link>
      </section>
      <footer className="sov-experience-footer"><span>sov. / by SOLVE</span><span>Public details chosen by the owner</span></footer>
    </div>
  </main>;
}
