"use client";

import { useState } from "react";
import { useGuestProfile } from "@/lib/guest/profile";
import { Reveal } from "../fx";
import { label, primaryAction } from "@/app/ui";

// Step 1: the guest profile. No email, no password — name yourself and your
// bot, and you're in. Everything from here saves to this device.
export function ProfileStep({
  signedIn,
  onNext,
}: {
  signedIn: boolean;
  onNext: () => void;
}) {
  const guest = useGuestProfile();
  const [yourName, setYourName] = useState("");
  const [botName, setBotName] = useState("");

  if (signedIn) {
    return (
      <Reveal className="glass fx-card flex flex-col gap-4 p-6">
        <p className="text-sm leading-6">
          You&apos;re in. Everything from here is saved to you.
        </p>
        <button type="button" onClick={onNext} className={primaryAction}>
          Continue
        </button>
      </Reveal>
    );
  }

  if (guest.active) {
    const who = guest.profile?.yourName || guest.profile?.botName || "friend";
    return (
      <Reveal className="glass fx-card flex flex-col gap-4 p-6">
        <p className="text-sm leading-6">
          You&apos;re in as <span className="font-semibold text-foreground">{who}</span>. This profile lives on this device.
        </p>
        <button type="button" onClick={onNext} className={primaryAction}>
          Continue
        </button>
      </Reveal>
    );
  }

  const start = () => {
    guest.activate({
      yourName: yourName.trim().slice(0, 60),
      botName: botName.trim().slice(0, 40),
    });
    onNext();
  };

  return (
    <div className="flex flex-col gap-5">
      <Reveal delay={40}>
        <p className="text-sm leading-6 text-muted">
          No account, no email, nothing to remember. Name yourself and your bot — this profile lives on this device.
        </p>
      </Reveal>
      <Reveal delay={140}>
        <div className="glass fx-card flex flex-col gap-4 p-6">
          <div>
            <label htmlFor="ob-your-name" className={label}>
              What should we call you?
            </label>
            <input
              id="ob-your-name"
              type="text"
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              placeholder="Your name"
              maxLength={60}
              autoComplete="name"
              className="fx-field mt-2 h-12 w-full rounded-full border border-line bg-background px-5 text-center text-lg font-medium outline-none transition-colors placeholder:text-faint focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="ob-bot-name" className={label}>
              Your bot&apos;s name
            </label>
            <input
              id="ob-bot-name"
              type="text"
              value={botName}
              onChange={(e) => setBotName(e.target.value)}
              placeholder="Name your bot"
              maxLength={40}
              className="fx-field mt-2 h-12 w-full rounded-full border border-line bg-background px-5 text-center text-lg font-medium outline-none transition-colors placeholder:text-faint focus:border-accent"
            />
          </div>
          <button type="button" onClick={start} className={primaryAction}>
            Try a profile — continue
          </button>
        </div>
      </Reveal>
      <Reveal delay={240}>
        <p className="text-xs leading-5 text-faint">
          Names can stay blank — you can set them later on the avatar page.
        </p>
      </Reveal>
    </div>
  );
}
