"use client";

import { useState } from "react";

// Renders a generated website draft inside an isolated, script-free sandbox. The empty `sandbox`
// attribute gives the frame a unique opaque origin with scripts disabled, so untrusted generated
// HTML can render (layout + CSS) but cannot run code, reach the app's origin, or navigate the top
// window. The source is also passed through stripActiveContent upstream as defense-in-depth.
export function DraftPreview({ html, title }: { html: string; title: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className={`overflow-hidden rounded-md border border-line bg-white transition-[height] duration-300 ${expanded ? "h-[70vh]" : "h-72"}`}>
        <iframe
          title={`Preview of ${title}`}
          sandbox=""
          srcDoc={html}
          referrerPolicy="no-referrer"
          className="h-full w-full border-0 bg-white"
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
        <button type="button" onClick={() => setExpanded((e) => !e)} className="uppercase tracking-[0.16em] text-accent">
          {expanded ? "Collapse preview" : "Expand preview"}
        </button>
        <span>Rendered in an isolated sandbox — scripts don&apos;t run here.</span>
      </div>
    </div>
  );
}
