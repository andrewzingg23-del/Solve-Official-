"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimIdentity } from "./actions";

type Step = "name" | "avatar" | "reveal";

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      {/* progress */}
      <div className="flex gap-2" aria-hidden="true">
        {(["name", "avatar", "reveal"] as Step[]).map((s) => (
          <span key={s} className={`h-1 flex-1 rounded-full ${step === s || (step === "reveal" && s !== "reveal") || (step === "avatar" && s === "name") ? "bg-accent" : "bg-line"}`} />
        ))}
      </div>

      {step === "name" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Step one</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">What should we call you?</h1>
            <p className="mt-2 text-sm leading-6 text-muted">This is the name on your SOV ID. Real name, nickname — your call.</p>
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            placeholder="Your name" autoFocus aria-label="Your name"
            className="rounded-lg border border-line bg-surface-raise px-4 py-3.5 text-base placeholder:text-faint"
          />
          {error && <p role="alert" className="text-sm text-negative">{error}</p>}
          <button onClick={submitName} disabled={busy || !name.trim()}
            className="rounded-full bg-accent px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-40">
            {busy ? "Claiming…" : "Claim your ID"}
          </button>
        </div>
      )}

      {step === "avatar" && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow">Step two</p>
            <h1 className="mt-3 text-3xl font-medium tracking-tight">Meet your assistant.</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Your AI gets its own face and its own name. Not a digital you — a colleague.
              What should we call them?
            </p>
          </div>
          <input
            value={avatarName} onChange={(e) => setAvatarName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setStep("reveal")}
            placeholder="Assistant's name" autoFocus aria-label="Assistant's name"
            className="rounded-lg border border-line bg-surface-raise px-4 py-3.5 text-base placeholder:text-faint"
          />
          <button onClick={() => setStep("reveal")} disabled={!avatarName.trim()}
            className="rounded-full bg-accent px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-40">
            Continue
          </button>
          <button onClick={() => setStep("reveal")} className="text-xs text-faint underline underline-offset-4 hover:text-muted">
            Skip for now
          </button>
        </div>
      )}

      {step === "reveal" && sovId && (
        <div className="flex flex-col gap-6 text-center">
          <div className="relative">
            <div className="absolute -inset-8 rounded-full bg-accent/10 blur-3xl" aria-hidden="true" />
            <p className="eyebrow eyebrow-accent relative">Your SOV ID</p>
            <p className="relative mt-4 font-mono text-sm break-all leading-relaxed text-foreground">{sovId}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface/60 p-6 text-left">
            <p className="text-base font-medium">One ID, four verbs.</p>
            <p className="mt-2 text-sm leading-6 text-muted">Build. Create. Play. Gather. Your identity works everywhere here.</p>
            {avatarName.trim() && (
              <p className="mt-3 text-sm text-muted">And <span className="text-foreground">{avatarName.trim()}</span> is ready to help.</p>
            )}
          </div>
          <button onClick={finish}
            className="rounded-full bg-accent px-6 py-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-background">
            What do you want to do?
          </button>
        </div>
      )}
    </div>
  );
}
