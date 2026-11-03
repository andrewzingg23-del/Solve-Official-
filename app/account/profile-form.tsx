"use client";
import { useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadGuestProfile, useGuestProfile } from "@/lib/guest/profile";
import { BotCharacter } from "@/app/bot/character";
import { validatePersona, type Persona } from "@/lib/bot/persona";
import { validateIdentityInput } from "@/lib/product/identity";
import { saveProfileAction } from "./profile-actions";

const subscribeReady = () => () => {};
export function ProfileForm({ signedIn, available = true, guestWorkspace = false, userId, name, persona, face, requestId }: { signedIn: boolean; available?: boolean; guestWorkspace?: boolean; userId: string | null; name: string; persona: Persona; face: string; requestId: string }) {
  const guest = useGuestProfile();
  const ready = useSyncExternalStore(subscribeReady, () => true, () => false);
  const [draft, setDraft] = useState<{ name: string; botName: string; face: string; persona?: Persona } | null>(null);
  const local = guest.profile;
  const localBotName = local?.botPersona ? validatePersona(local.botPersona, persona).name : local?.botName;
  const input = draft ?? { name: signedIn ? name : local?.yourName ?? "", botName: signedIn ? persona.name : localBotName || persona.name, face: signedIn ? face : local?.face || face, ...(!signedIn ? { persona: validatePersona(local?.botPersona, { ...persona, name: localBotName || persona.name }) } : {}) };
  const [nonce, setNonce] = useState(requestId);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const router = useRouter();
  const update = (next: Partial<typeof input>) => { setDraft({ ...input, ...next }); setNonce(crypto.randomUUID()); setMessage(null); setError(null); };
  const save = (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setMessage(null);
    const checked = validateIdentityInput(input, !signedIn && local?.botPersona ? validatePersona(local.botPersona, persona) : persona);
    if (!checked.ok) { setError(checked.error); return; }
    if (!signedIn) {
      const patch = { yourName: checked.name, botName: checked.persona.name, face: checked.face, botPersona: checked.persona };
      if (guest.active) guest.save(patch); else guest.activate(patch);
      const stored = loadGuestProfile();
      if (!stored || stored.yourName !== patch.yourName || stored.botName !== patch.botName || stored.face !== patch.face || JSON.stringify(stored.botPersona) !== JSON.stringify(patch.botPersona)) { setError("This browser couldn't save the profile. Your changes are still shown here; sign in or allow browser storage and retry."); return; }
      setMessage("Saved in this browser. Sign in to an existing account for access across devices."); return;
    }
    startTransition(async () => {
      try {
        const result = await saveProfileAction(input, nonce, userId ?? "");
        if (!result.ok) { setError(result.error ?? "Couldn't save yet."); return; }
        setNonce(crypto.randomUUID()); setMessage(guestWorkspace ? "Saved to your guest workspace. Keep this browser’s session to retain access." : "Saved to your permanent account."); router.refresh();
      } catch { setError("The connection was interrupted. Keep this page open and retry your changes."); }
    });
  };
  return <div>
    {signedIn && local ? <section className="solve-local-review"><div><strong>A profile is saved on this device.</strong><p>Review it before bringing it into this account. It will replace the fields shown below only when you save.</p></div><button type="button" className="solve-button solve-button-secondary" disabled={busy || !available} onClick={() => update({ name: local.yourName, botName: localBotName || persona.name, face: local.face, persona: validatePersona(local.botPersona ?? { ...persona, name: local.botName, about: local.soul.slice(0, 600) }, persona) })}>Review local profile</button></section> : null}
    <form onSubmit={save} className="solve-form" aria-label="Your profile">
      <div className="solve-profile-preview"><BotCharacter persona={{ ...(input.persona ?? persona), name: input.botName }} size={80} /><div><strong>{input.name || "Your name"}</strong><p>with {input.botName || "your AI"}</p><span>{signedIn ? guestWorkspace ? "Guest workspace · this browser" : "Permanent account" : "Local profile · this browser"}</span></div></div>
      <label htmlFor="profile-name">Your name</label><input id="profile-name" name="name" value={input.name} onChange={event => update({ name: event.target.value })} required maxLength={60} autoComplete="nickname" placeholder="What should people call you?" disabled={!ready || busy || !available} />
      <label htmlFor="profile-bot-name">Your AI’s name</label><input id="profile-bot-name" name="botName" value={input.botName} onChange={event => update({ botName: event.target.value })} required maxLength={40} disabled={!ready || busy || !available} />
      <p className="solve-muted">Your AI uses the same character in your profile and workspace. <Link href="/bot?section=persona" className="solve-text-link">Customize your AI’s appearance →</Link></p>
      {error ? <p role="alert" className="solve-error">{error}</p> : null}{message ? <p role="status" className="solve-success">{message}</p> : null}
      <div className="solve-profile-save"><button className="solve-button" disabled={!ready || busy || !available}>{busy ? "Saving…" : signedIn ? "Save profile" : "Save on this device"}</button>{!signedIn ? <Link href="/login?next=%2Faccount" className="solve-text-link">Sign in to save across devices →</Link> : <Link href="/bot?section=persona" className="solve-text-link">Customize personality →</Link>}</div>
    </form>
  </div>;
}
