"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimIdentity } from "./actions";
import { field, primaryAction, quietLink } from "@/app/ui";

type Step = "name" | "avatar" | "reveal";

const steps: Step[] = ["name", "avatar", "reveal"];

export function ClaimFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [name, setName] = useState("");
  const [avatarName, setAvatarName] = useState("");
  const [sovId, setSovId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitName = async () => {
    if (!name.trim()) return;
    setBusy(true); setError(null);
    try {
      const { actorId } = await claimIdentity(name);
      setSovId(actorId);
      setStep("avatar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const finish = () => {
    // Avatar naming is captured for the next step (portrait creator).
    // For now, the SOV ID is claimed — the pack picker is next.
    router.push("/packs");
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      {/* progress */}
      <div className="flex gap-2" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${steps.indexOf(step) >= i ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>

      {step === "name" && (
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Step one · Your SOV ID</p>
            <h1 className="text-5xl font-medium tracking-tight md:text-6xl">
              Claim your <span className="serif-accent">name</span>.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-muted">
              This is the name on your SOV ID. Real name, nickname — your call.
            </p>
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            placeholder="Your name" autoFocus aria-label="Your name"
            className={field}
          />
          {error && <p role="alert" className="alert-pin rounded-xl px-4 py-3 text-sm">{error}</p>}
          <button onClick={submitName} disabled={busy || !name.trim()} className={primaryAction}>
            {busy ? "Claiming…" : "Claim your ID"}
          </button>
        </div>
      )}

      {step === "avatar" && (
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Step two · Your assistant</p>
            <h1 className="text-5xl font-medium tracking-tight md:text-6xl">
              Give them a <span className="serif-accent">name</span>.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-muted">
              Your AI gets its own face and its own name. Not a digital you — a colleague.
            </p>
          </div>
          <input
            value={avatarName} onChange={(e) => setAvatarName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && avatarName.trim() && setStep("reveal")}
            placeholder="Assistant's name" autoFocus aria-label="Assistant's name"
            className={field}
          />
          <button onClick={() => setStep("reveal")} disabled={!avatarName.trim()} className={primaryAction}>
            Continue
          </button>
          <button onClick={() => setStep("reveal")} className={`${quietLink} self-center py-3`}>
            Skip for now
          </button>
        </div>
      )}

      {step === "reveal" && sovId && (
        <div className="flex flex-col items-center gap-10 py-6 text-center">
          <div className="flex flex-col gap-5">
            <p className="eyebrow eyebrow-accent">Your SOV ID</p>
            <div className="relative">
              <div className="absolute -inset-12 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
              <p className="relative break-all font-mono text-lg leading-relaxed text-accent md:text-xl">
                {sovId}
              </p>
            </div>
          </div>
          <div className="glass w-full p-6 text-left">
            <p className="text-base font-medium">One ID, four verbs.</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Build. Create. Play. Gather. Your identity works everywhere here.
            </p>
            {avatarName.trim() && (
              <p className="mt-3 text-sm text-muted">
                And <span className="text-foreground">{avatarName.trim()}</span> is ready to help.
              </p>
            )}
          </div>
          <button onClick={finish} className={primaryAction}>
            What do you want to do?
          </button>
        </div>
      )}
    </div>
  );
}
