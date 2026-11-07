"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { useGuestProfile } from "@/lib/guest/profile";
import { createSovVCard, safeContactEmail, safeSovLink } from "@/lib/product/sov-contact";
import { publishSovCard, unpublishSovCard } from "./actions";

type CardDraft = {
  line: string;
  about: string;
  email: string;
  website: string;
  featured: string;
  appearance: "default" | "secondary";
};

const STORAGE_KEY = "solve.sov-card.draft.v1";
const EMPTY: CardDraft = {
  line: "", about: "", email: "", website: "", featured: "", appearance: "default",
};
let cached: CardDraft | undefined;
const listeners = new Set<() => void>();

function readDraft(): CardDraft {
  if (cached) return cached;
  if (typeof window !== "undefined") {
    try {
      const raw: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        const data = raw as Record<string, unknown>;
        const get = (key: string, max: number) =>
          typeof data[key] === "string" ? (data[key] as string).slice(0, max) : "";
        cached = {
          line: get("line", 100),
          about: get("about", 500),
          email: get("email", 254),
          website: get("website", 2048),
          featured: get("featured", 2048),
          appearance: data.appearance === "secondary" ? "secondary" : "default",
        };
        return cached;
      }
    } catch {
      // Keep the preview editable when storage is unavailable.
    }
  }
  return (cached = EMPTY);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = undefined;
      listeners.forEach(callback => callback());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeDraft(next: CardDraft): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    cached = next;
    listeners.forEach(listener => listener());
    return true;
  } catch {
    return false;
  }
}

export function SovCard({ accountName = "", accountHandle = "", canPublish = false, initialPublicId = null }: {
  accountName?: string;
  accountHandle?: string;
  canPublish?: boolean;
  initialPublicId?: string | null;
}) {
  const { profile } = useGuestProfile();
  const draft = useSyncExternalStore(subscribe, readDraft, () => EMPTY);
  const [flipped, setFlipped] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [edit, setEdit] = useState(false);
  const [notice, setNotice] = useState("");
  const [publishBusy, setPublishBusy] = useState(false);
  const [publicId, setPublicId] = useState(initialPublicId);

  const name = (accountName || profile?.yourName || "").trim();
  const handle = (accountHandle || profile?.sovName || "").trim().replace(/^@/, "");
  const email = safeContactEmail(draft.email);
  const website = safeSovLink(draft.website);
  const featured = safeSovLink(draft.featured);
  const portrait = profile?.generated && profile.face_url?.startsWith("data:image/")
    ? profile.face_url : "";
  const canExport = Boolean(name);

  function change(patch: Partial<CardDraft>) {
    setNotice(writeDraft({ ...draft, ...patch }) ? "Saved on this device." : "Couldn't save on this device. Your change isn't persistent.");
  }

  async function publish() {
    if (publishBusy) return;
    setPublishBusy(true);
    try {
      const result = await publishSovCard({ name, handle, tagline: draft.line, about: draft.about, email: draft.email, website: draft.website, featured: draft.featured, appearance: draft.appearance });
      if (result.ok) { setPublicId(result.publicId); setNotice("Published. Only the details you chose for your public card are visible."); }
      else setNotice(result.error);
    } catch { setNotice("Couldn\u0027t publish right now. Your private draft remains unchanged."); }
    finally { setPublishBusy(false); }
  }

  async function unpublish() {
    if (publishBusy) return;
    setPublishBusy(true);
    try {
      const result = await unpublishSovCard();
      if (result.ok) { setPublicId(null); setNotice("Unpublished. Your public card link no longer shows your identity."); }
      else setNotice(result.error || "Unable to unpublish right now.");
    } catch { setNotice("Unable to unpublish right now."); }
    finally { setPublishBusy(false); }
  }

  function copyPublicLink() {
    if (!publicId) return;
    void navigator.clipboard.writeText(new URL(`/id/${publicId}`, window.location.origin).toString())
      .then(() => setNotice("Public link copied."))
      .catch(() => setNotice("Copy your link from the opened public card."));
  }

  function downloadContact() {
    const content = createSovVCard({ name, email, website });
    if (!content) {
      setNotice("Add your name to make a contact file.");
      return;
    }
    const href = URL.createObjectURL(new Blob([content], { type: "text/vcard;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = href;
    a.download = "sov-contact.vcf";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
    setNotice("Contact file prepared. Share the file through your phone or computer.");
  }

  return <main className={`sov-experience sov-look-${draft.appearance}`}>
    <header className="sov-experience-header">
      <Link href="/" className="sov-identity-mark" aria-label="SOLVE home">sov<span className="sov-identity-period">.</span></Link>
      <nav aria-label="SOV Card">
        <Link href="/space">Home</Link>
        <Link href="/account">Your profile</Link>
      </nav>
    </header>

    <div className="sov-experience-body">
      <section className="sov-card-intro" aria-labelledby="sov-card-heading">
        <span className="sov-overline">SOV ID / YOUR CARD</span>
        <h1 id="sov-card-heading">Yours to make.</h1>
        <p>One identity. A simpler way to share who you are and what you make.</p>
      </section>

      <section className="sov-card-area" aria-label="Your two-sided identity card">
        <button type="button" className="sov-flip-surface" onClick={() => setFlipped(current => !current)}
          aria-label={`Flip card. Currently showing ${flipped ? "back" : "front"}.`}>
          <div className={`sov-flip-inner ${flipped ? "is-flipped" : ""}`}>
            <div className="sov-paper-face sov-paper-front">
              <div className="sov-card-top"><span className="sov-card-brand">sov.</span><span className="sov-card-kind">IDENTITY</span></div>
              <div className="sov-card-name-row">
                <div className="sov-card-person">
                  <strong>{name || "Your name"}</strong>
                  <span>{handle ? `@${handle}` : draft.line || "Your living identity."}</span>
                  {handle && draft.line ? <small>{draft.line}</small> : null}
                </div>
                <div className="sov-card-portrait" aria-hidden="true">
                  {portrait ? <img src={portrait} alt="" /> : <span>{name ? name.charAt(0).toUpperCase() : "S"}</span>}
                </div>
              </div>
              <div className="sov-card-base"><span>YOURS TO MAKE</span><span>01 / 02</span></div>
            </div>
            <div className="sov-paper-face sov-paper-back">
              <div className="sov-card-top"><span className="sov-card-brand">sov.</span><span className="sov-card-kind">CONNECT</span></div>
              <div className="sov-card-back-copy">
                <strong>{name || "Your name"}</strong>
                <span>{email || website || "A better way to stay connected."}</span>
                <small>{featured ? "Featured work available on expand" : "Save · Connect · Explore"}</small>
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

      <section className="sov-card-utility" aria-label="Useful card actions">
        <button type="button" onClick={downloadContact} disabled={!canExport}>
          <span className="sov-action-symbol" aria-hidden="true">↓</span>
          <strong>Save contact</strong>
          <small>Download a real contact file</small>
        </button>
        {email ? <a href={`mailto:${email}`}>
          <span className="sov-action-symbol" aria-hidden="true">↗</span>
          <strong>Connect</strong>
          <small>Write an email</small>
        </a> : <button type="button" disabled title="Add a contact email in your card settings">
          <span className="sov-action-symbol" aria-hidden="true">↗</span>
          <strong>Connect</strong>
          <small>Add an email first</small>
        </button>}
        {featured ? <a href={featured} target="_blank" rel="noopener noreferrer">
          <span className="sov-action-symbol" aria-hidden="true">↗</span>
          <strong>Explore</strong>
          <small>Open selected work</small>
        </a> : <button type="button" onClick={() => setEdit(true)}>
          <span className="sov-action-symbol" aria-hidden="true">+</span>
          <strong>Explore</strong>
          <small>Add a creation or link</small>
        </button>}
      </section>

      {expanded ? <section className="sov-expanded-identity" aria-label="Expanded identity">
        <span className="sov-overline">MORE ABOUT YOU</span>
        <h2>{name || "Your story starts here."}</h2>
        <p>{draft.about || "Your space can grow with what matters to you. Add a short introduction below."}</p>
        {website ? <a href={website} target="_blank" rel="noopener noreferrer">Visit website ↗</a> : null}
        {featured ? <a href={featured} target="_blank" rel="noopener noreferrer">Open featured creation ↗</a> : null}
        <p className="sov-muted-disclosure">This is your private preview—not a published public identity.</p>
      </section> : null}

      <section className="sov-card-editor" aria-labelledby="sov-edit-heading">
        <div className="sov-edit-heading">
          <div><span className="sov-overline">YOUR EXPRESSION</span><h2 id="sov-edit-heading">Make it yours.</h2></div>
          <button type="button" onClick={() => setEdit(value => !value)} aria-expanded={edit}>{edit ? "Close" : "Customize"} <span aria-hidden="true">{edit ? "−" : "+"}</span></button>
        </div>
        {edit ? <div className="sov-editor-inner">
          <p>Your name and handle come from <Link href="/account">your profile</Link>. These choices save only on this device.</p>
          <label>One line about you<input maxLength={100} value={draft.line} onChange={event => change({ line: event.target.value })} placeholder="What matters to you?" /></label>
          <label>More about you<textarea rows={3} maxLength={500} value={draft.about} onChange={event => change({ about: event.target.value })} placeholder="Something worth sharing" /></label>
          <label>Contact email (optional)<input type="email" maxLength={254} value={draft.email} onChange={event => change({ email: event.target.value })} placeholder="you@example.com" /></label>
          <label>Website (HTTPS)<input type="url" maxLength={2048} value={draft.website} onChange={event => change({ website: event.target.value })} placeholder="https://your-site.com" /></label>
          <label>Featured creation or destination (HTTPS)<input type="url" maxLength={2048} value={draft.featured} onChange={event => change({ featured: event.target.value })} placeholder="https://..." /></label>
          <fieldset className="sov-appearance-options"><legend>Appearance</legend>
            <button type="button" aria-pressed={draft.appearance === "default"} onClick={() => change({ appearance: "default" })}>Default · Light</button>
            <button type="button" aria-pressed={draft.appearance === "secondary"} onClick={() => change({ appearance: "secondary" })}>Secondary · Dark</button>
          </fieldset>
          <p className="sov-muted-disclosure">AI-designed custom compositions and public publishing require the next engineering slice. This preview does not create a public URL.</p>
        </div> : null}
      </section>

      <section className="sov-publish" aria-labelledby="sov-publish-title">
        <div><span className="sov-overline">SHARING</span><h2 id="sov-publish-title">Ready when you are.</h2>
          <p>Only your explicitly chosen card details are published. Your private Home, AI context and projects stay separate.</p>
        </div>
        {canPublish ? <div className="sov-publish-actions">
          <button type="button" className="sov-primary-action" disabled={publishBusy || !name} onClick={() => void publish()}>{publishBusy ? "Working…" : publicId ? "Update public card" : "Publish card"}</button>
          {publicId ? <><Link href={`/id/${publicId}`} target="_blank" rel="noopener noreferrer">View public card ↗</Link>
            <button type="button" disabled={publishBusy} onClick={copyPublicLink}>Copy link</button>
            <button type="button" disabled={publishBusy} onClick={() => void unpublish()}>Unpublish</button></> : null}
        </div> : <div className="sov-publish-actions"><Link href="/login?next=%2Fcard" className="sov-primary-action">Sign in to publish</Link><span className="sov-muted-disclosure">You can design and export your card without signing in.</span></div>}
        <p className="sov-muted-disclosure">Published changes take effect only when you select Publish or Update. Publication requires the SOV public-profile database feature to be available.</p>
      </section>
      {notice ? <p className="sov-card-notice" role="status">{notice}</p> : null}
      <p className="sov-card-disclosure">Your editor is an on-device draft. {publicId ? "Your last explicitly published version is public." : "No public card is currently published."} No payment credential issued. No blockchain transaction initiated.</p>
      <footer className="sov-experience-footer">
        <span>sov. / by SOLVE</span>
        <Link href="/space">Your Home ↗</Link>
      </footer>
    </div>
  </main>;
}
