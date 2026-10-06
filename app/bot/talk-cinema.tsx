"use client";

// The conversation's cinematic skin around TalkPanel. TalkPanel itself is untouched (its honest
// states — the 503 "not configured" line, the cost meter, way-plan and approval cards, the human
// hatch — render exactly as shipped); this wrapper only re-skins: the panel chrome falls away so
// the conversation flows beneath the hero, bubbles go glass, and the ask bar becomes a glowing
// pill. Targets stay 52px tall for thumbs.
import type { ReactNode } from "react";

const CINEMA_CSS = `
/* Fall away: the conversation flows on the surface, not in a box. */
.talk-cinema>section{background:transparent;border:0;border-radius:0;padding:0;gap:1rem;-webkit-backdrop-filter:none;backdrop-filter:none}
/* The panel's own heading is redundant with the hero above; the section keeps its aria-label. */
.talk-cinema>section>h2{display:none}
/* Conversation: taller, breathes. */
.talk-cinema>section>div:first-of-type{max-height:min(26rem,62vh)}
/* Bubbles, glass. */
.talk-cinema>section>div:first-of-type .self-start{border-radius:1rem;background:rgb(10 18 32/.62);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.talk-cinema>section>div:first-of-type .self-end{border-radius:1rem}
/* The ask bar: a glowing pill. */
.talk-cinema>section>form{gap:.75rem}
.talk-cinema>section>form input{height:3.25rem;border-radius:9999px;padding-left:1.25rem;padding-right:1.25rem;border-color:rgb(34 211 238/.35);background:rgb(6 11 20/.88);box-shadow:0 0 0 1px rgb(34 211 238/.12),0 0 32px rgb(34 211 238/.16),inset 0 1px 0 rgb(242 247 251/.06);transition:box-shadow .3s ease-calm,border-color .3s ease-calm}
.talk-cinema>section>form input:focus{border-color:rgb(34 211 238/.7);box-shadow:0 0 0 1px rgb(34 211 238/.3),0 0 44px rgb(34 211 238/.28),inset 0 1px 0 rgb(242 247 251/.06)}
.talk-cinema>section>form button{height:3.25rem;min-width:3.25rem;border-radius:9999px;background:#22d3ee;border:1px solid #22d3ee;color:#06232a;font-weight:700;padding-left:1.5rem;padding-right:1.5rem;font-size:10px;text-transform:uppercase;letter-spacing:.2em;box-shadow:0 0 24px rgb(34 211 238/.35);transition:filter .3s ease-calm,box-shadow .3s ease-calm,opacity .3s ease-calm}
.talk-cinema>section>form button:hover:not(:disabled){filter:brightness(1.08);color:#06232a;box-shadow:0 0 32px rgb(34 211 238/.5)}
.talk-cinema>section>form button:active:not(:disabled){transform:scale(.97)}
.talk-cinema>section>form button:disabled{opacity:.4;background:#22d3ee;border-color:#22d3ee}
`;

export function TalkCinema({ children }: { children: ReactNode }) {
  return (
    <div className="talk-cinema">
      <style>{CINEMA_CSS}</style>
      {children}
    </div>
  );
}
