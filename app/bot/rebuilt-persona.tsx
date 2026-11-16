"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_PERSONA, validatePersona, type Persona } from "@/lib/bot/persona";
import { useGuestProfile } from "@/lib/guest/profile";
import { BotCreator } from "./creator";

const subscribeToHydration = () => () => {};

export function RebuiltPersona({ signedIn, initial, exists, ownerId }: { signedIn: boolean; initial?: Persona; exists: boolean; ownerId?: string }) {
  const guest = useGuestProfile();
  const hydrated = useSyncExternalStore(subscribeToHydration, () => true, () => false);
  if (!signedIn && !hydrated) return <p role="status">Loading your Agent…</p>;
  const base = { ...DEFAULT_PERSONA, name: guest.profile?.botName || DEFAULT_PERSONA.name };
  const persona = signedIn ? initial ?? DEFAULT_PERSONA : validatePersona(guest.profile?.botPersona, base);
  return <BotCreator key={ownerId ?? "device"} initial={persona} ownerId={ownerId}
    exists={signedIn ? exists : Boolean(guest.profile?.botPersona)} />;
}
