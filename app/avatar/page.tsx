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
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-10 pb-24">
      <div className="text-center">
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
