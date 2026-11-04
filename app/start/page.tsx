import type { Metadata } from "next";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { loadBot } from "@/lib/bot/store";
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
  // The existing import action requires a saved bot avatar. Do not present
  // an unusable uploader to a guest or an unfinished account.
  let botReady = false;
  if (user && step === "context") {
    try { botReady = Boolean((await loadBot(await getKernel())).avatar); }
    catch { botReady = false; }
  }
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
      botReady={botReady}
      avatar={avatar}
      soul={soul}
      sovLabel={sovLabel}
      socials={socials}
      socialNotice={social === "connected" ? "connected" : social === "error" ? "error" : null}
      metaReady={Boolean(process.env.META_APP_ID?.trim())}
      chatReady={Boolean(process.env.ANTHROPIC_API_KEY?.trim())}
      faceGenReady={Boolean(
        (process.env.HF_CREDENTIALS || process.env.HF_KEY || process.env.HIGGSFIELD_API_KEY)?.trim(),
      )}
    />
  );
}
