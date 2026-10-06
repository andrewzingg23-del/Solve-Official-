"use client";

import { useState, useTransition } from "react";
import { SOUL_VIBES, MAX_SOUL_LENGTH } from "@/lib/bot/soul";
import { saveBotSoul } from "./actions";
import { primaryAction } from "@/app/ui";

// The bot's soul.md: personality in the user's own plain words.
// Saved per user; shapes the bot's voice once chat is live.
export function SoulForm({ initial, signedIn }: { initial: string; signedIn: boolean }) {
  const [soul, setSoul] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const addVibe = (vibe: string) => {
    const tag = `[vibe: ${vibe}]`;
    if (soul.includes(tag)) return;
    setSoul((s) => (s ? `${s}\n${tag}` : tag).slice(0, MAX_SOUL_LENGTH));
  };

  const save = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await saveBotSoul(soul);
      if (result.ok) setSaved(true);
      else setError(result.error ?? "Couldn't save. Try again.");
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow">soul.md</p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Write who your bot is, in your own words. This is what shapes its voice.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" aria-label="Vibe presets">
        {SOUL_VIBES.map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => addVibe(v)}
            disabled={!signedIn}
            className="rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted transition-colors hover:border-accent hover:text-foreground disabled:opacity-60"
          >
            {v}
          </button>
        ))}
      </div>

      <textarea
        aria-label="Your bot's personality"
        value={soul}
        onChange={(e) => setSoul(e.target.value.slice(0, MAX_SOUL_LENGTH))}
        rows={8}
        maxLength={MAX_SOUL_LENGTH}
        disabled={!signedIn}
        placeholder={"Talk to me like a friend who tells the truth.\nCall me chief.\nNever sugarcoat the money stuff."}
        className="w-full rounded-2xl border border-line bg-surface p-5 font-mono text-sm leading-7 outline-none transition-colors placeholder:text-faint focus:border-accent disabled:opacity-60"
      />
      <p className="text-xs text-faint tabular-nums">
        {soul.length} / {MAX_SOUL_LENGTH}
      </p>

      {error ? (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-positive">
          Saved. Your bot will talk like this.
        </p>
      ) : null}

      {signedIn ? (
        <button type="button" onClick={save} disabled={pending} className={`${primaryAction} w-full disabled:opacity-60`}>
          {pending ? "Saving…" : "Save soul"}
        </button>
      ) : (
        <a href="/login?next=/avatar" className={`${primaryAction} w-full text-center`}>
          Sign in to shape your bot
        </a>
      )}
    </div>
  );
}
