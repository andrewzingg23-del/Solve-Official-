"use client";

import Link from "next/link";
import { useGuestProfile } from "@/lib/guest/profile";
import { faceSrc } from "@/lib/bot/avatar";
import { primaryAction } from "@/app/ui";

// The account page for guests: what the profile holds on this device,
// stated plainly. No kernel record without an account — no fake history.
export function GuestRecord() {
  const { profile, active } = useGuestProfile();

  if (!active || !profile) {
    return (
      <section aria-label="Guest profile" className="glass flex flex-col gap-4 p-6 md:p-8">
        <p className="eyebrow">Profile</p>
        <p className="text-sm leading-6 text-muted">
          No profile on this device yet. Try one — your bot, your name, your soul, kept here.
        </p>
        <Link href="/avatar" className={`${primaryAction} w-fit`}>
          Try a profile
        </Link>
      </section>
    );
  }

  const rows: Array<[string, string]> = [
    ["You", profile.yourName || "—"],
    ["Bot", profile.botName || "—"],
    ["SOV ID", profile.sovName || "—"],
    [
      "Soul",
      profile.soul ? `${profile.soul.slice(0, 80)}${profile.soul.length > 80 ? "…" : ""}` : "—",
    ],
    [
      "Node",
      profile.homeNode
        ? `${profile.homeNode.lat.toFixed(4)}, ${profile.homeNode.lng.toFixed(4)}`
        : "—",
    ],
  ];

  return (
    <section aria-label="Guest profile" className="glass flex flex-col gap-5 p-6 md:p-8">
      <div className="flex items-center gap-4">
        <img
          src={faceSrc(profile.face, profile.face_url)}
          alt="Your bot's face"
          className="h-16 w-16 rounded-full object-cover ring-2 ring-accent"
        />
        <div>
          <p className="eyebrow">Profile — this device</p>
          <p className="mt-1 text-xl font-medium tracking-tight">
            {profile.yourName || profile.botName || "Guest"}
          </p>
        </div>
      </div>
      <dl className="flex flex-col divide-y divide-line-soft">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-faint">{k}</dt>
            <dd className="text-right text-sm text-foreground">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs leading-5 text-faint">
        The on-chain record issues with the identity ledger. Until then, this is the truth on this device.
      </p>
      <Link href="/avatar" className={primaryAction + " w-fit"}>
        Shape your bot
      </Link>
    </section>
  );
}
