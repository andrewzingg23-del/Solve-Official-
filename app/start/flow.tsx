"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ONBOARDING_STEPS, type OnboardingStep } from "@/lib/bot/soul";
import type { BotAvatar } from "@/lib/bot/avatar";
import type { SocialConnection } from "@/lib/social";
import { SigninStep } from "./steps/signin-step";
import { SovidStep } from "./steps/sovid-step";
import { AvatarStep } from "./steps/avatar-step";
import { SoulStep } from "./steps/soul-step";
import { LocationStep } from "./steps/location-step";
import { KnowYouStep } from "./steps/knowyou-step";
import { Ambient, StepPanel, TraceBeam } from "./fx";
import { primaryAction, quietLink } from "@/app/ui";

export interface FlowProps {
  initialStep: OnboardingStep;
  signedIn: boolean;
  email: string | null;
  avatar: BotAvatar;
  soul: string;
  sovLabel: string;
  socials: Record<string, SocialConnection>;
  socialNotice: "connected" | "error" | null;
  metaReady: boolean;
  chatReady: boolean;
  faceGenReady: boolean;
}

const TITLES: Record<OnboardingStep, string> = {
  signin: "First, you're you.",
  sovid: "Claim your SOV ID.",
  avatar: "Meet your bot.",
  soul: "Give it a soul.",
  location: "Place your node.",
  knowyou: "Let it know you.",
};

export function OnboardingFlow(props: FlowProps) {
  const [step, setStep] = useState<OnboardingStep>(props.initialStep);
  const router = useRouter();
  const idx = ONBOARDING_STEPS.indexOf(step);
  const last = idx === ONBOARDING_STEPS.length - 1;

  const go = (s: OnboardingStep) => {
    setStep(s);
    router.replace(`/start?step=${s}`, { scroll: false });
    window.scrollTo(0, 0);
  };
  const next = () => {
    if (!last) go(ONBOARDING_STEPS[idx + 1]);
  };
  const back = () => {
    if (idx > 0) go(ONBOARDING_STEPS[idx - 1]);
  };

  return (
    <main className="relative mx-auto flex min-h-svh w-full max-w-xl flex-1 flex-col px-4 py-8 pb-32">
      <Ambient />
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <p className="eyebrow">
            Step {idx + 1} of {ONBOARDING_STEPS.length}
          </p>
          {!last ? (
            <button type="button" onClick={next} className={quietLink}>
              Skip
            </button>
          ) : null}
        </div>

        <TraceBeam step={idx} total={ONBOARDING_STEPS.length} />

        <StepPanel key={step}>
          <h1 className="text-3xl font-medium tracking-tight">
            {TITLES[step].split(" ").slice(0, -1).join(" ")}{" "}
            <span className="serif-accent">{TITLES[step].split(" ").slice(-1)}</span>
          </h1>

          {step === "signin" && <SigninStep signedIn={props.signedIn} email={props.email} onNext={next} />}
          {step === "sovid" && (
            <SovidStep
              signedIn={props.signedIn}
              sovLabel={props.sovLabel}
              socials={props.socials}
              socialNotice={props.socialNotice}
              metaReady={props.metaReady}
              onNext={next}
            />
          )}
          {step === "avatar" && (
            <AvatarStep signedIn={props.signedIn} avatar={props.avatar} faceGenReady={props.faceGenReady} onNext={next} />
          )}
          {step === "soul" && <SoulStep signedIn={props.signedIn} soul={props.soul} onNext={next} />}
          {step === "location" && <LocationStep signedIn={props.signedIn} onNext={next} />}
          {step === "knowyou" && <KnowYouStep signedIn={props.signedIn} chatReady={props.chatReady} />}
        </StepPanel>

        <div className="mt-2 flex items-center justify-between">
          {idx > 0 ? (
            <button type="button" onClick={back} className={quietLink}>
              ← Back
            </button>
          ) : (
            <span />
          )}
          {!last ? (
            <button type="button" onClick={next} className={primaryAction}>
              Continue
            </button>
          ) : (
            <a href="/avatar" className={primaryAction}>
              Meet your bot
            </a>
          )}
        </div>
      </div>
    </main>
  );
}
