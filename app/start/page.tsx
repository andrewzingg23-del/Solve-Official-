import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { connectionStatus } from "@/lib/ai/provider";
import { isValidStep } from "@/lib/bot/soul";
import { getBotAvatar } from "@/lib/bot/avatar";
import { getBotSoul } from "@/lib/bot/soul";
import { getSocialConnections } from "@/lib/social";
import { OnboardingFlow } from "./flow";

export const metadata: Metadata = { title: "Start — solve" };

// The guided beginning: one step per screen. Guests are first-class —
// the profile is the way in, everything saves to this device.
export default async function StartPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawStep = Array.isArray(params.step) ? params.step[0] : params.step;
  const step = rawStep && isValidStep(rawStep) ? rawStep : "profile";
  const social = Array.isArray(params.social) ? params.social[0] : params.social;

  const user = await getUser();
  const chatReady = user ? await connectionStatus(await getKernel()).then((status) => status.active).catch(() => false) : false;
  const avatar = getBotAvatar(user);
  const soul = getBotSoul(user);
  const socials = getSocialConnections(user);
  const sovLabel =
    (typeof user?.user_metadata?.sov_label === "string" && user.user_metadata.sov_label) ||
    (typeof user?.user_metadata?.sov_pending_label === "string" && user.user_metadata.sov_pending_label) ||
    "";

  return (
    <OnboardingFlow
      initialStep={step}
      signedIn={Boolean(user)}
      avatar={avatar}
      soul={soul}
      sovLabel={sovLabel}
      socials={socials}
      socialNotice={social === "connected" ? "connected" : social === "error" ? "error" : null}
      metaReady={Boolean(process.env.META_APP_ID?.trim())}
      chatReady={chatReady}
      faceGenReady={Boolean(
        (process.env.HF_CREDENTIALS || process.env.HF_KEY || process.env.HIGGSFIELD_API_KEY)?.trim(),
      )}
    />
  );
}
