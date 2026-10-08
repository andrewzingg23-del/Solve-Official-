"use client";

import { useState, useTransition } from "react";
import type { SocialConnection } from "@/lib/social";
import { useGuestProfile } from "@/lib/guest/profile";
import { claimSovId } from "../actions";
import { Reveal } from "../fx";
import { label, primaryAction, glassCard } from "@/app/ui";

// Step 2: claim the SOV ID, then import socials.
// Social reality: Meta OAuth is scaffolded (needs META_APP_ID/SECRET);
// X + LinkedIn need their app credentials. Nothing fakes a stat.
const PROVIDERS = [
  { id: "instagram", label: "Instagram", via: "meta" },
  { id: "facebook", label: "Facebook", via: "meta" },
  { id: "x", label: "X", via: null as string | null, needs: "the X app credentials" },
  { id: "linkedin", label: "LinkedIn", via: null as string | null, needs: "the LinkedIn app credentials" },
];

export function SovidStep({
  signedIn,
  sovLabel,
  socials,
  socialNotice,
  metaReady,
  onNext,
}: {
  signedIn: boolean;
  sovLabel: string;
  socials: Record<string, SocialConnection>;
  socialNotice: "connected" | "error" | null;
  metaReady: boolean;
  onNext: () => void;
}) {
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [claimedDraft, setClaimedDraft] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const guest = useGuestProfile();
  const active = signedIn || guest.active;
  // Guests keep their SOV name on this device — shown until edited.
  const claimed = claimedDraft ?? (!signedIn ? guest.profile?.sovName || null : null) ?? (sovLabel || null);
  const name = nameDraft ?? claimed ?? "";

  const claim = () => {
    setError(null);
    const clean = name.trim().slice(0, 60);
    if (!clean) {
      setError("Give your SOV ID a name.");
      return;
    }
    if (!signedIn) {
      // Guest: the name is held on this device. The on-chain identity issues
      // when the ledger is live — never a fake ID.
      guest.save({ sovName: clean, yourName: guest.profile?.yourName || clean });
      setClaimedDraft(clean);
      setPending(true);
      return;
    }
    setPending(false);
    startTransition(async () => {
      const result = await claimSovId(name);
      if (result.ok) {
        setClaimedDraft(name.trim());
        setPending(result.pending === true);
      } else {
        setError(result.error ?? "Couldn't claim. Try again.");
      }
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <Reveal delay={40}>
        <div className="glass fx-card flex flex-col gap-4 p-6">
          <label htmlFor="sov-name" className={label}>
            Your SOV ID name
          </label>
          {claimed ? (
            <div className="fx-stamp flex flex-col gap-2 rounded-2xl border border-accent/40 bg-accent-dim/40 p-5">
              <p className="text-2xl font-medium tracking-tight">
                {claimed} <span className="serif-accent">· claimed</span>
              </p>
              {pending || (!signedIn && claimed && !claimedDraft) ? (
                <p className="text-xs leading-5 text-muted">
                  {signedIn
                    ? "The identity ledger isn't provisioned yet — your name is held and will issue when it is."
                    : "Held on this device — your SOV ID issues when the identity ledger is live."}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <input
                id="sov-name"
                type="text"
                value={name}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="What should the world call you?"
                maxLength={60}
                disabled={!active}
                className="fx-field h-12 rounded-full border border-line bg-background px-5 text-center text-lg font-medium outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60"
              />
              {active ? (
                <button type="button" onClick={claim} disabled={busy || !name.trim()} className={`${primaryAction} disabled:opacity-60`}>
                  {busy ? "Claiming…" : "Claim my SOV ID"}
                </button>
              ) : (
                <p className="text-sm text-muted">Try a profile first — step 1.</p>
              )}
              {error ? (
                <p role="alert" className="text-sm text-negative">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
      </Reveal>

      <div className="flex flex-col gap-4">
        <Reveal delay={140}>
          <div>
            <p className="eyebrow">Import your socials</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Bring your proof with you — followers and stats sync when connected.
            </p>
          </div>
        </Reveal>
        {socialNotice === "connected" ? (
          <p role="status" className="text-sm text-positive">
            Connected. Your proof comes with you now.
          </p>
        ) : null}
        {socialNotice === "error" ? (
          <p role="alert" className="text-sm text-negative">
            That connection didn&apos;t go through. Try again.
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          {PROVIDERS.map((p, i) => {
            const conn = socials[p.id];
            const metaPending = p.via === "meta" && !metaReady;
            return (
              <Reveal key={p.id} delay={200 + i * 70}>
                <div className={`${glassCard} fx-card flex min-h-32 flex-col justify-between gap-3`}>
                  <p className="text-sm font-semibold tracking-wide">{p.label}</p>
                  {conn?.connected ? (
                    <p className="text-xs text-positive">
                      Connected{conn.name ? ` · ${conn.name}` : ""}
                      {typeof conn.followers === "number" ? ` · ${conn.followers.toLocaleString()} followers` : ""}
                    </p>
                  ) : metaPending ? (
                    <p className="text-xs leading-5 text-faint">Not connected yet — needs the Meta app credentials.</p>
                  ) : p.needs ? (
                    <p className="text-xs leading-5 text-faint">Not connected yet — needs {p.needs}.</p>
                  ) : !active ? (
                    <p className="text-xs leading-5 text-faint">Try a profile first — step 1.</p>
                  ) : (
                    <a href="/api/auth/meta/start" className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">
                      Connect
                    </a>
                  )}
                </div>
              </Reveal>
            );
          })}
        </div>
        <Reveal delay={480}>
          <button type="button" onClick={onNext} className={primaryAction}>
            Continue
          </button>
        </Reveal>
      </div>
    </div>
  );
}
