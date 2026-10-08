"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { faceSrc, type BotAvatar } from "@/lib/bot/avatar";
import { useGuestProfile } from "@/lib/guest/profile";
import { saveBotAvatar } from "./actions";
import { primaryAction } from "@/app/ui";
import { SoulForm } from "./soul-form";
import { AvatarPresence } from "./avatar-presence";

// Management home for the bot: face, name, soul.
// Guests tap "Try a profile" — the profile activates on this device and every
// control below works, saved locally. Signed-in users keep server saves.
export function AvatarForm({
  initial,
  soul,
  signedIn,
}: {
  initial: BotAvatar;
  soul: string;
  signedIn: boolean;
}) {
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const guest = useGuestProfile();
  const active = signedIn || guest.active;
  // Guests keep their bot name on this device — the input shows it until edited.
  const name = nameDraft ?? (!signedIn ? guest.profile?.botName : undefined) ?? initial.name;
  const face = guest.profile?.face ?? initial.face;
  const face_url = guest.profile?.face_url ?? initial.face_url;

  const save = () => {
    setError(null);
    setSaved(false);
    const clean = name.trim().slice(0, 40);
    if (!signedIn) {
      guest.save({ botName: clean, face, face_url, generated: guest.profile?.generated });
      setSaved(true);
      return;
    }
    startTransition(async () => {
      const result = await saveBotAvatar(face, clean, face_url, initial.generated);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "Couldn't save. Try again.");
      }
    });
  };

  const tryProfile = () => {
    setError(null);
    guest.activate({ botName: name.trim().slice(0, 40) });
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <style>{`
        @keyframes av-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .av-reveal {
          opacity: 0;
          animation: av-rise 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes av-pop {
          0% { opacity: 0; transform: scale(0.92); }
          100% { opacity: 1; transform: scale(1); }
        }
        .av-pop {
          opacity: 0;
          animation: av-pop 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .av-reveal, .av-pop { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="av-pop">
        <AvatarPresence src={faceSrc(face, face_url)} alt="Your bot's face" />
      </div>
      {initial.generated ? (
        <p className="av-reveal -mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-faint" style={{ animationDelay: "120ms" }}>
          AI-generated face
        </p>
      ) : null}

      <div className="av-reveal w-full max-w-sm" style={{ animationDelay: "200ms" }}>
        <label htmlFor="bot-name" className="eyebrow block">
          Name
        </label>
        <input
          id="bot-name"
          type="text"
          value={name}
          onChange={(e) => setNameDraft(e.target.value)}
          placeholder="Name your bot"
          maxLength={40}
          disabled={!active}
          className="mt-3 h-12 w-full rounded-full border border-line bg-surface px-5 text-center text-lg font-medium outline-none transition-all duration-300 placeholder:text-faint focus:border-accent focus:shadow-[0_0_24px_rgb(34_211_238/0.25)] disabled:opacity-60"
        />
      </div>

      {active ? (
        <Link
          href="/start?step=avatar"
          className="av-reveal text-xs font-semibold uppercase tracking-[0.2em] text-accent transition-all duration-300 hover:text-foreground hover:[text-shadow:0_0_16px_rgb(34_211_238/0.6)]"
          style={{ animationDelay: "280ms" }}
        >
          Reshape face — scan or generate
        </Link>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="av-pop text-sm text-positive">
          Saved. This is your bot now.
        </p>
      ) : null}

      {active ? (
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className={`${primaryAction} av-reveal w-full max-w-sm disabled:opacity-60`}
          style={{ animationDelay: "340ms" }}
        >
          {pending ? "Saving…" : signedIn ? "Save my bot" : "Save my bot — on this device"}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={tryProfile}
            className={`${primaryAction} av-reveal w-full max-w-sm`}
            style={{ animationDelay: "340ms" }}
          >
            Try a profile
          </button>
          <p className="av-reveal -mt-4 text-center text-xs leading-5 text-faint" style={{ animationDelay: "380ms" }}>
            No account, no email. Your bot lives on this device.
          </p>
        </>
      )}

      <div className="av-reveal w-full border-t border-line pt-8" style={{ animationDelay: "420ms" }}>
        {active ? (
          <SoulForm initial={soul} signedIn={signedIn} />
        ) : (
          <p className="text-center text-xs leading-5 text-faint">
            Your bot&apos;s soul — unlocks with your profile.
          </p>
        )}
      </div>
    </div>
  );
}
