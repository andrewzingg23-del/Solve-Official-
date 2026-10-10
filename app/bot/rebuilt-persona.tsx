"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { DEFAULT_PERSONA, validatePersona, type Persona } from "@/lib/bot/persona";
import { loadGuestProfile, useGuestProfile } from "@/lib/guest/profile";
import { BotCreator } from "./creator";

const subscribeToHydration = () => () => {};

export function RebuiltPersona({ signedIn, initial, version, savedAt, exists, ownerId }: { signedIn: boolean; initial?: Persona; version: number; savedAt: string | null; exists: boolean; ownerId?: string }) {
  const guest = useGuestProfile();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  const [storageError, setStorageError] = useState<string | null>(null);

  if (!signedIn && !hydrated) return <p className="solve-muted" role="status">Loading your local persona…</p>;
  if (!signedIn && !guest.profile) {
    return (
      <section className="solve-panel solve-ai-card solve-ai-local-start">
        <h2>Make an AI that feels like yours</h2>
        <p>Choose its name, character and personality. Start a local draft to keep your choices on this device.</p>
        <div className="solve-ai-actions">
          <button type="button" className="solve-button" onClick={() => {
            guest.activate();
            if (!loadGuestProfile()) setStorageError("This browser could not keep a local draft. Allow browser storage and retry, or sign in to save your persona.");
          }}>Start a local persona</button>
          <Link className="solve-text-link" href="/account">Set up your profile</Link>
        </div>
        {storageError ? <p className="solve-error" role="alert">{storageError}</p> : null}
        <p className="solve-ai-fineprint">Sign in to review and save your persona to an account. Local drafts cannot connect assistants or store account knowledge.</p>
      </section>
    );
  }

  const localBase = { ...DEFAULT_PERSONA, name: guest.profile?.botName || DEFAULT_PERSONA.name };
  const persona = signedIn ? initial ?? DEFAULT_PERSONA : validatePersona(guest.profile?.botPersona, localBase);
  return (
    <div className="solve-ai-stack">
      <div className="solve-ai-persona-status">
        <div>
          <strong>{signedIn ? exists ? "Your saved persona" : "Your first account persona" : "Local persona"}</strong>
          <p>{signedIn
            ? exists ? "Changes are saved to this account when you choose Save changes." : "Change a detail, then save to create your AI and enable connections."
            : "Save your choices on this device. Sign in, then review them in Profile to save to your account."}</p>
        </div>
        <Link href={signedIn ? "/account" : "/login?next=%2Faccount"} className="solve-text-link">{signedIn ? "Open Profile" : "Sign in to save"}</Link>
      </div>
      <div className="solve-ai-creator">
        <BotCreator key={signedIn ? `account:${ownerId}` : "local"} initial={persona} signedIn={signedIn} ownerId={ownerId} version={version} savedAt={savedAt} />
      </div>
    </div>
  );
}
