"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  OPTIONAL_INTEGRATIONS,
  OPTIONAL_INTEGRATION_CATEGORIES,
  connectionStateLabel,
} from "@/lib/product/optional-integrations";

const STORAGE_KEY = "sov.optional-app-interests.v1";

function readSelected(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const values: unknown = raw ? JSON.parse(raw) : [];
    const valid = new Set(OPTIONAL_INTEGRATIONS.map(item => item.id));
    return Array.isArray(values) ? values.filter((value): value is string => typeof value === "string" && valid.has(value)) : [];
  } catch { return []; }
}

export function OptionalConnections() {
  const [selected, setSelected] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // A saved preference is only an interest list; it never stores API tokens or implies auth.
    setSelected(readSelected());
    setReady(true);
  }, []);

  function toggle(id: string) {
    const next = selected.includes(id) ? selected.filter(value => value !== id) : [...selected, id];
    setSelected(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* optional preferences may not persist */ }
  }

  return <div className="sov-integration-picker">
    <div className="sov-integration-summary" role="status">
      <strong>{ready ? selected.length : "—"} selected</strong>
      <span>Saved to this device as setup preferences. No account has been connected.</span>
      {selected.length ? <button type="button" onClick={() => {
        setSelected([]);
        try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* best effort */ }
      }} className="solve-text-link">Clear</button> : null}
    </div>

    {OPTIONAL_INTEGRATION_CATEGORIES.map(category => <section key={category} className="sov-integration-section" aria-label={category}>
      <h3>{category}</h3>
      <div className="sov-integration-grid">
        {OPTIONAL_INTEGRATIONS.filter(app => app.category === category).map(app => <div key={app.id} className="sov-integration-card">
          <label className="sov-integration-choice">
            <input type="checkbox" checked={selected.includes(app.id)} onChange={() => toggle(app.id)} aria-label={"Add " + app.name + " to my setup list"} disabled={!ready} />
            <span className="sov-integration-initial" aria-hidden="true">{app.name.slice(0, 1)}</span>
            <span className="sov-integration-info"><strong>{app.name}</strong><span>{app.description}</span></span>
          </label>
          <div className="sov-integration-foot">
            <span>{connectionStateLabel(app)}</span>
            {app.setupHref ? <Link href={app.setupHref} className="solve-text-link">Review setup →</Link> : null}
          </div>
        </div>)}
      </div>
    </section>)}

    <div className="sov-onboarding-note">
      <strong>Connecting is separate from selecting.</strong>
      <p>Claude and compatible ChatGPT custom apps already have a guided MCP connection path. Other services need provider-approved OAuth or API adapters before SOV can read or perform actions. Each connection will require your consent and can be revoked.</p>
      <div className="sov-onboarding-buttons">
        <Link className="solve-button solve-button-secondary" href="/bot?section=connections">Connect an AI assistant</Link>
        <Link className="solve-button solve-button-secondary" href="/control">Review Control</Link>
      </div>
    </div>
  </div>;
}
