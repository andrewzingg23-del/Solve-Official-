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
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">What should we call you?</h1>
            <p className="mt-2 text-sm text-muted">This is the name on your SOV ID. Real name, nickname — your call.</p>
          </div>
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
            placeholder="Your name" autoFocus aria-label="Your name"
            className="rounded-md border border-line bg-background px-4 py-3 text-base"
          />
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <button onClick={submitName} disabled={busy || !name.trim()}
            className="rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-40">
            {busy ? "Claiming…" : "Claim your ID"}
          </button>
        </div>
      )}

      {step === "avatar" && (
        <div className="flex flex-col gap-4">
          <div>
            <h1 className="text-2xl font-medium tracking-tight">Meet your assistant.</h1>
            <p className="mt-2 text-sm text-muted">
              Your AI gets its own face and its own name. Not a digital you — a colleague.
              What should we call them?
            </p>
          </div>
          <input
            value={avatarName} onChange={(e) => setAvatarName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setStep("reveal")}
            placeholder="Assistant's name" autoFocus aria-label="Assistant's name"
            className="rounded-md border border-line bg-background px-4 py-3 text-base"
          />
          <button onClick={() => setStep("reveal")} disabled={!avatarName.trim()}
            className="rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background disabled:opacity-40">
            Continue
          </button>
          <button onClick={() => setStep("reveal")} className="text-xs text-muted underline underline-offset-4">
            Skip for now
          </button>
        </div>
      )}

      {step === "reveal" && sovId && (
        <div className="flex flex-col gap-5 text-center">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted">Your SOV ID</p>
            <p className="mt-3 font-mono text-sm break-all text-accent">{sovId}</p>
          </div>
          <div className="rounded-md border border-line bg-surface/60 p-5 text-left">
            <p className="text-sm font-medium">One ID, four verbs.</p>
            <p className="mt-2 text-sm text-muted">Build. Create. Play. Gather. Your identity works everywhere here.</p>
            {avatarName.trim() && (
              <p className="mt-3 text-sm text-muted">And <span className="text-foreground">{avatarName.trim()}</span> is ready to help.</p>
            )}
          </div>
          <button onClick={finish}
            className="rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-background">
            What do you want to do?
          </button>
        </div>
      )}
    </div>
  );
}
