"use client";

import { usePathname } from "next/navigation";
import { useGuestProfile } from "@/lib/guest/profile";
import { faceSrc } from "@/lib/bot/avatar";
import { BotCompanion } from "./bot-companion";

// The companion for guests: once a profile is active on this device, the bot
// floats with its face. Signed-in users keep the server-mounted companion.
export function GuestCompanion() {
  const { profile } = useGuestProfile();
  const pathname = usePathname();
  if (!profile || pathname === "/" || pathname.startsWith("/studio") || pathname.startsWith("/sov-id") || pathname.endsWith("/studio")) return null;
  return (
    <BotCompanion
      portraitUrl={faceSrc(profile.face, profile.face_url)}
      hasUnread={false}
    />
  );
}
