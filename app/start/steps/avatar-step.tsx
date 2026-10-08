"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { BotAvatar } from "@/lib/bot/avatar";
import { faceSrc } from "@/lib/bot/avatar";
import { useGuestProfile } from "@/lib/guest/profile";
import { saveBotAvatar, saveFacePhoto } from "@/app/avatar/actions";
import { Reveal } from "../fx";
import { label, primaryAction, secondaryAction, glassCard } from "@/app/ui";

// Step 3: link AI accounts, then shape the face — scan it or describe it.
// Two paths only. No preset picks.
const AI_PROVIDERS = ["Claude", "Muse", "OpenAI", "Manus", "Gemini"];

type Mode = "idle" | "scan" | "scan-preview" | "prompt" | "generating" | "gen-preview";

export function AvatarStep({
  signedIn,
  avatar,
  faceGenReady,
  onNext,
}: {
  signedIn: boolean;
  avatar: BotAvatar;
  faceGenReady: boolean;
  onNext: () => void;
}) {
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, startTransition] = useTransition();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guest = useGuestProfile();
  const active = signedIn || guest.active;
  // Guests keep their bot name on this device — the input shows it until edited.
  const name = nameDraft ?? (!signedIn ? guest.profile?.botName : undefined) ?? avatar.name;

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  useEffect(() => stopStream, []);

  const currentFace = preview ?? faceSrc(avatar.face, avatar.face_url);
  const scanning = mode === "scan" || mode === "generating";

  const startScan = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setMode("scan");
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setError("Couldn't reach the camera. Check permission and try again.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    const w = 320;
    const h = Math.round((video.videoHeight / video.videoWidth) * w) || 320;
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(video, 0, 0, w, h);
    stopStream();
    setPreview(canvas.toDataURL("image/jpeg", 0.82));
    setMode("scan-preview");
  };

  const generate = async () => {
    setGenError(null);
    if (!prompt.trim()) {
      setGenError("Describe the face first.");
      return;
    }
    setMode("generating");
    try {
      const res = await fetch("/api/avatar/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const body = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !body.jobId) {
        setGenError(body.error ?? "Couldn't start. Try again.");
        setMode("prompt");
        return;
      }
      setJobId(body.jobId);
    } catch {
      setGenError("Couldn't start. Try again.");
      setMode("prompt");
    }
  };

  // Poll the generation while it's running.
  useEffect(() => {
    if (mode !== "generating" || !jobId) return;
    let alive = true;
    const deadline = Date.now() + 180_000;
    const tick = async () => {
      if (!alive) return;
      try {
        const res = await fetch(`/api/avatar/generate?jobId=${encodeURIComponent(jobId)}`);
        const body = (await res.json()) as { status?: string; url?: string; error?: string };
        if (!alive) return;
        if (body.status === "completed" && body.url) {
          setPreview(body.url);
          setMode("gen-preview");
        } else if (body.status === "failed") {
          setGenError(body.error ?? "The generation failed. Try again.");
          setMode("prompt");
        } else if (Date.now() > deadline) {
          setGenError("It's taking too long — try again.");
          setMode("prompt");
        } else {
          setTimeout(tick, 3000);
        }
      } catch {
        if (alive) setTimeout(tick, 3000);
      }
    };
    tick();
    return () => {
      alive = false;
    };
  }, [mode, jobId]);

  const confirmFace = () => {
    if (!preview) return;
    setError(null);
    const botName = name || guest.profile?.botName || "My bot";
    if (!signedIn) {
      // Guest: the face lives on this device with the profile.
      guest.save({
        face: "blank",
        face_url: preview,
        generated: mode === "gen-preview",
        botName,
      });
      setSaved(true);
      setMode("idle");
      return;
    }
    startTransition(async () => {
      const generated = mode === "gen-preview";
      const result = generated
        ? await saveBotAvatar("blank", botName, preview, true)
        : await saveFacePhoto(preview, botName);
      if (result.ok) {
        setSaved(true);
        setMode("idle");
      } else {
        setError(result.error ?? "Couldn't save. Try again.");
      }
    });
  };

  const cancelFace = () => {
    stopStream();
    setPreview(null);
    setJobId(null);
    setMode("idle");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Reveal delay={40}>
          <div>
            <p className="eyebrow">Link your AI accounts</p>
            <p className="mt-2 text-sm leading-6 text-muted">Bring the brains you already use.</p>
          </div>
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {AI_PROVIDERS.map((p, i) => (
            <Reveal key={p} delay={100 + i * 60}>
              <div className={`${glassCard} fx-card flex min-h-24 flex-col justify-between gap-2`}>
                <p className="text-sm font-semibold tracking-wide">{p}</p>
                <p className="text-xs leading-5 text-faint">Not linked yet — needs your {p} login.</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal delay={200}>
        <div className="flex flex-col items-center gap-5">
          <div>
            <p className="eyebrow text-center">Your face</p>
            <p className="mt-2 text-center text-sm leading-6 text-muted">
              Start from the mannequin. Scan your face, or describe the one you want.
            </p>
          </div>

          <div className="relative">
            <div className={`fx-scanwrap rounded-full ${scanning ? "" : "fx-face-glow"}`}>
              <img
                src={currentFace}
                alt="Your bot's face"
                className="h-44 w-44 rounded-full object-cover ring-2 ring-accent"
              />
              {scanning ? <span aria-hidden className="fx-scanline" /> : null}
            </div>
            {mode === "gen-preview" ? (
              <p className="mt-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-faint">
                AI-generated
              </p>
            ) : null}
          </div>

          {mode === "idle" && (
            <div className="flex w-full max-w-sm flex-col gap-3">
              <button type="button" onClick={startScan} disabled={!active} className={`${secondaryAction} w-full disabled:opacity-60`}>
                Scan my face
              </button>
              <button type="button" onClick={() => setMode("prompt")} disabled={!active} className={`${secondaryAction} w-full disabled:opacity-60`}>
                Describe it instead
              </button>
              {!active ? <p className="text-center text-xs text-faint">Try a profile first — step 1.</p> : null}
            </div>
          )}

          {mode === "scan" && (
            <div className="flex w-full flex-col items-center gap-4">
              <video ref={videoRef} autoPlay playsInline muted className="h-64 w-64 rounded-full object-cover ring-2 ring-accent" />
              <div className="flex w-full max-w-sm gap-3">
                <button type="button" onClick={capture} className={`${primaryAction} flex-1`}>
                  Capture
                </button>
                <button type="button" onClick={cancelFace} className={secondaryAction}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {(mode === "scan-preview" || mode === "gen-preview") && (
            <div className="flex w-full max-w-sm flex-col gap-3">
              <p className="text-center text-sm text-muted">This is the one?</p>
              <div className="w-full">
                <label htmlFor="av-name" className={label}>
                  Bot name
                </label>
                <input
                  id="av-name"
                  type="text"
                  value={name}
                  onChange={(e) => setNameDraft(e.target.value)}
                  placeholder="Name your bot"
                  maxLength={40}
                  className="fx-field mt-2 h-12 w-full rounded-full border border-line bg-surface px-5 text-center text-lg font-medium outline-none transition-colors placeholder:text-faint focus:border-accent"
                />
              </div>
              <button type="button" onClick={confirmFace} disabled={busy} className={`${primaryAction} w-full disabled:opacity-60`}>
                {busy ? "Saving…" : "Yes — this is my bot"}
              </button>
              <button type="button" onClick={cancelFace} className={quietLinkFallback}>
                Start over
              </button>
            </div>
          )}

          {mode === "prompt" && (
            <div className="flex w-full max-w-sm flex-col gap-3">
              {!faceGenReady ? (
                <p className="glass fx-card p-5 text-center text-sm leading-6 text-muted">
                  Face generation isn&apos;t set up yet — the image model needs its key. Face scan works now.
                </p>
              ) : (
                <>
                  <label htmlFor="av-prompt" className={label}>
                    Describe the face
                  </label>
                  <textarea
                    id="av-prompt"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
                    rows={3}
                    maxLength={300}
                    placeholder="Calm woman in her 30s, sharp eyes, dark hair…"
                    className="fx-field w-full rounded-2xl border border-line bg-surface p-4 text-sm leading-6 outline-none transition-colors placeholder:text-faint focus:border-accent"
                  />
                  {genError ? (
                    <p role="alert" className="text-sm text-negative">
                      {genError}
                    </p>
                  ) : null}
                  <button type="button" onClick={generate} className={`${primaryAction} w-full`}>
                    Generate my face
                  </button>
                </>
              )}
              <button type="button" onClick={cancelFace} className={quietLinkFallback}>
                Back
              </button>
            </div>
          )}

          {mode === "generating" && (
            <div className="glass fx-card flex w-full max-w-sm flex-col items-center gap-3 p-6">
              <div aria-hidden className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
              <p className="text-sm text-muted">Shaping your face…</p>
            </div>
          )}

          {error ? (
            <p role="alert" className="text-sm text-negative">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p role="status" className="text-sm text-positive">
              Saved. This is your bot now.
            </p>
          ) : null}
        </div>
      </Reveal>

      <Reveal delay={320}>
        <button type="button" onClick={onNext} className={primaryAction}>
          Continue
        </button>
      </Reveal>
    </div>
  );
}

const quietLinkFallback = "text-xs uppercase tracking-[0.2em] text-muted transition-colors hover:text-accent";
