"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { faceSrc, type BotAvatar } from "@/lib/bot/avatar";
import { saveBotAvatar } from "./actions";
import { primaryAction } from "@/app/ui";
import { SoulForm } from "./soul-form";

// Management home for the user's bot: face, name, soul.
// Face shaping (scan / generate) lives in the onboarding flow at /start.
export function AvatarForm({
  initial,
  soul,
  signedIn,
}: {
  initial: BotAvatar;
  soul: string;
  signedIn: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const face = initial.face;
  const face_url = initial.face_url;

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBotAvatar(face, name, face_url, initial.generated);
      if (result.ok) {
        setSaved(true);
        router.refresh();
      } else {
        setError(result.error ?? "Couldn't save. Try again.");
      }
    });
  };

  return (
    <div className="flex flex-col items-center gap-8">
      <div className="relative">
        <img
          src={faceSrc(face, face_url)}
          alt="Your bot's face"
          className="h-44 w-44 rounded-full object-cover ring-2 ring-accent shadow-[0_0_48px_rgb(34_211_238/0.35)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-accent/10" />
      </div>
      {initial.generated ? (
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">AI-generated face</p>
      ) : null}

      <div className="w-full max-w-sm">
        <label htmlFor="bot-name" className="eyebrow block">
          Name
        </label>
        <input
          id="bot-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name your bot"
          maxLength={40}
          disabled={!signedIn}
          className="mt-3 h-12 w-full rounded-full border border-line bg-surface px-5 text-center text-lg font-medium outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60"
        />
      </div>

      {signedIn ? (
        <Link href="/start?step=avatar" className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Reshape face — scan or generate
        </Link>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-positive">
          Saved. This is your bot now.
        </p>
      ) : null}

      {signedIn ? (
        <button type="button" onClick={save} disabled={pending} className={`${primaryAction} w-full max-w-sm disabled:opacity-60`}>
          {pending ? "Saving…" : "Save my bot"}
        </button>
      ) : (
        <a href="/login?next=/avatar" className={`${primaryAction} w-full max-w-sm text-center`}>
          Sign in to make this bot yours
        </a>
      )}

      <div className="w-full border-t border-line pt-8">
        <SoulForm initial={soul} signedIn={signedIn} />
      </div>
    </div>
  );
}
