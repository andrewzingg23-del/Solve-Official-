"use client";

import { SoulForm } from "@/app/avatar/soul-form";
import { Reveal } from "../fx";

// Step 4: soul.md — the bot's personality in the user's plain words.
export function SoulStep({
  signedIn,
  soul,
  onNext,
}: {
  signedIn: boolean;
  soul: string;
  onNext: () => void;
}) {
  void onNext;
  return (
    <Reveal className="flex flex-col gap-6">
      <SoulForm initial={soul} signedIn={signedIn} />
    </Reveal>
  );
}
