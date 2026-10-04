"use client";

import { useState } from "react";

export function CopyField({ value, name }: { value: string; name: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input readOnly value={value} aria-label={name} onFocus={(e) => e.currentTarget.select()} className="h-11 min-w-0 flex-1 rounded-md border border-line bg-background px-3 font-mono text-xs outline-none focus:border-accent" />
      <button
        type="button"
        onClick={() => navigator.clipboard?.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); })}
        className="rounded-md border border-line px-4 text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 ease-calm hover:border-accent hover:text-accent"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
