"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AVATAR_PRESETS, faceSrc, type BotAvatar } from "@/lib/bot/avatar";
import { saveBotAvatar } from "./actions";
import { eyebrowAccent, primaryAction } from "@/app/ui";

export function AvatarForm({ initial, signedIn }: { initial: BotAvatar; signedIn: boolean }) {
  const [face, setFace] = useState(initial.face);
  const [name, setName] = useState(initial.name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBotAvatar(face, name);
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
          src={faceSrc(face)}
          alt="Your bot's face"
          className="h-44 w-44 rounded-full object-cover ring-2 ring-accent shadow-[0_0_48px_rgb(34_211_238/0.35)]"
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-t from-transparent via-transparent to-accent/10" />
      </div>

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

      <div className="w-full">
        <p className={`${eyebrowAccent} text-center`}>Face</p>
        <div className="mt-4 grid grid-cols-3 gap-3" role="radiogroup" aria-label="Bot faces">
          {AVATAR_PRESETS.map((p) => {
            const selected = face === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={p.label}
                disabled={!signedIn}
                onClick={() => setFace(p.id)}
                className={`group relative aspect-square overflow-hidden rounded-2xl border transition-all disabled:cursor-not-allowed ${
                  selected
                    ? "border-accent shadow-[0_0_24px_rgb(34_211_238/0.35)]"
                    : "border-line opacity-70 hover:opacity-100"
                }`}
              >
                <img src={p.src} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-5 text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                  {p.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

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
    </div>
  );
}
