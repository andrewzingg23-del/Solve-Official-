import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { loginRequired } from "@/lib/auth/gate";
import { getBotAvatar } from "@/lib/bot/avatar";
import { getBotSoul } from "@/lib/bot/soul";
import { redirect } from "next/navigation";
import { AvatarForm } from "./avatar-form";

export const metadata: Metadata = { title: "Avatar — solve" };

export default async function AvatarPage() {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=/avatar");
  const avatar = getBotAvatar(user);
  const soul = getBotSoul(user);

  return (
    <main className="relative mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 overflow-hidden px-4 py-10 pb-24">
      {/* ambient depth — the room the bot lives in */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-72">
        <div className="absolute left-1/2 top-6 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-accent/[0.07] blur-3xl" />
      </div>

      <style>{`
        @keyframes av-head-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .av-head {
          opacity: 0;
          animation: av-head-rise 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .av-head { animation: none; opacity: 1; }
        }
      `}</style>

      <div className="av-head relative text-center">
        <p className="eyebrow">Avatar</p>
        <h1 className="mt-3 text-3xl font-medium tracking-tight">
          This is <span className="serif-accent">your</span> bot.
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {user
            ? avatar.face === "blank"
              ? "A blank slate. Pick a face, give it a name — it keeps them everywhere you go."
              : "Pick a face, give it a name. It keeps them everywhere you go."
            : "Every bot starts blank. Sign in and shape yours."}
        </p>
      </div>
      <AvatarForm initial={avatar} soul={soul} signedIn={Boolean(user)} />
    </main>
  );
}
