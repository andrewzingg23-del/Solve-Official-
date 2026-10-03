"use client";

// First run: who should represent you in SOV? Three paths, each a real avatar in the kernel —
// one identity backed by an agent with observe-level authority. Under a minute; fidelity improves
// later.
import { useState } from "react";
import type { AvatarRelationship, AvatarType, RepresentationKind } from "@/lib/kernel/client";
import { label, primaryAction, quietLink, secondaryAction } from "@/app/ui";
import { AvatarArt, seedFromDescription, type Seed } from "./avatar-art";

type Create = (input: { type: AvatarType; name: string; relationship: AvatarRelationship; seed: Seed; representation: RepresentationKind }) => Promise<void>;

const RELATIONSHIPS: { id: AvatarRelationship; title: string; detail: string }[] = [
  { id: "represent", title: "Represent me", detail: "Acts on my behalf where explicitly delegated." },
  { id: "assist", title: "Assist me", detail: "Works beside me but does not speak for me." },
  { id: "guide", title: "Guide me", detail: "Helps me understand and navigate." },
  { id: "create_with", title: "Create with me", detail: "Collaborates on Worlds, projects and ideas." },
];

const FAMILIES: { id: RepresentationKind; title: string }[] = [
  { id: "stylized_3d", title: "Stylized" },
  { id: "pixel", title: "Pixel" },
  { id: "abstract", title: "Abstract" },
];

export function Onboarding({ onCreate }: { onCreate: Create }) {
  const [path, setPath] = useState<"choose" | "me" | "ai" | "ai-name">("choose");
  const [description, setDescription] = useState("");
  const [choice, setChoice] = useState(0);
  const [name, setName] = useState("Nova");
  const [relationship, setRelationship] = useState<AvatarRelationship>("assist");
  const [family, setFamily] = useState<RepresentationKind>("stylized_3d");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const directions = [0, 1, 2].map((v) => seedFromDescription(description || "intelligent calm warm minimal", v));

  const create: Create = async (input) => {
    setBusy(true);
    setError(null);
    try {
      await onCreate(input);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-background/55 px-4 backdrop-blur-[2px]">
      <section aria-labelledby="onboarding-title" className="w-full max-w-lg rounded-md border border-line bg-surface/95 p-6 shadow-2xl">
        <p className="text-xs font-semibold tracking-[0.3em] text-accent">SOV</p>
        {path === "choose" && (
          <div className="mt-3 flex flex-col gap-5">
            <h1 id="onboarding-title" className="text-2xl font-semibold tracking-tight">
              Who should represent you in SOV?
            </h1>
            <div className="flex flex-col gap-3">
              {[
                { id: "me", title: "Be me", detail: "A digital representation that looks like you." },
                { id: "ai", title: "Create my AI", detail: "A distinct AI assistant, representative or companion." },
                { id: "abstract", title: "Keep it abstract", detail: "A minimal SOV presence without a humanoid form." },
              ].map((o) => (
                <button
                  key={o.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    o.id === "abstract"
                      ? create({ type: "abstract", name: "Presence", relationship: "assist", seed: { motif: "point" }, representation: "abstract" })
                      : setPath(o.id as "me" | "ai")
                  }
                  className="flex flex-col items-start gap-1 rounded-md border border-line p-4 text-left transition-colors duration-300 ease-calm hover:border-accent focus-visible:border-accent"
                >
                  <span className="text-xs font-semibold uppercase tracking-[0.22em]">{o.title}</span>
                  <span className="text-sm text-muted">{o.detail}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {path === "me" && (
          <div className="mt-3 flex flex-col gap-5">
            <h1 id="onboarding-title" className="text-2xl font-semibold tracking-tight">
              Be me
            </h1>
            <p className="text-sm text-muted">Face and voice capture come later. Nothing is captured now; choose how you appear.</p>
            <div className="flex gap-3">
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={family === f.id}
                  onClick={() => setFamily(f.id)}
                  className={`flex flex-col items-center gap-2 rounded-md border p-3 ${family === f.id ? "border-accent" : "border-line"}`}
                >
                  <AvatarArt kind={f.id} seed={{ hair: "dark", tone: "medium", style: "minimal" }} size={56} />
                  <span className="text-xs uppercase tracking-[0.2em]">{f.title}</span>
                </button>
              ))}
            </div>
            <label className={label} htmlFor="me-name">
              Name
            </label>
            <input id="me-name" value={name === "Nova" ? "Digital You" : name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-md border border-line bg-background px-3 outline-none focus:border-accent" />
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={busy}
                className={primaryAction}
                onClick={() => create({ type: "digital_self", name: name === "Nova" ? "Digital You" : name, relationship: "represent", seed: { hair: "dark", tone: "medium", style: "minimal" }, representation: family })}
              >
                Approve
              </button>
              <button type="button" className={quietLink} onClick={() => setPath("choose")}>
                Back
              </button>
            </div>
          </div>
        )}

        {path === "ai" && (
          <div className="mt-3 flex flex-col gap-5">
            <h1 id="onboarding-title" className="text-2xl font-semibold tracking-tight">
              Describe who you want beside you
            </h1>
            <textarea
              aria-label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Intelligent, calm, warm, dark hair, minimalist futuristic clothing"
              className="rounded-md border border-line bg-background p-3 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-3" role="radiogroup" aria-label="Directions">
              {directions.map((seed, i) => (
                <button key={i} type="button" role="radio" aria-checked={choice === i} onClick={() => setChoice(i)} className={`rounded-md border p-2 ${choice === i ? "border-accent" : "border-line"}`}>
                  <AvatarArt kind="stylized_3d" seed={seed} size={72} />
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">Directions come from your words by a local rule-based generator; no image model is connected.</p>
            <div className="flex items-center gap-4">
              <button type="button" className={primaryAction} onClick={() => setPath("ai-name")}>
                Choose
              </button>
              <button type="button" className={quietLink} onClick={() => setPath("choose")}>
                Back
              </button>
            </div>
          </div>
        )}

        {path === "ai-name" && (
          <div className="mt-3 flex flex-col gap-5">
            <div className="flex items-center gap-4">
              <AvatarArt kind="stylized_3d" seed={directions[choice]} size={64} />
              <div className="flex flex-1 flex-col gap-2">
                <label className={label} htmlFor="ai-name">
                  Name
                </label>
                <input id="ai-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-md border border-line bg-background px-3 outline-none focus:border-accent" />
              </div>
            </div>
            <h1 id="onboarding-title" className="text-lg font-semibold tracking-tight">
              How should {name || "your AI"} work with you?
            </h1>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Relationship">
              {RELATIONSHIPS.map((r) => (
                <button key={r.id} type="button" role="radio" aria-checked={relationship === r.id} onClick={() => setRelationship(r.id)} className={`rounded-md border p-3 text-left ${relationship === r.id ? "border-accent" : "border-line"}`}>
                  <span className="block text-xs font-semibold uppercase tracking-[0.2em]">{r.title}</span>
                  <span className="block text-xs text-muted">{r.detail}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted">It starts able to observe only. Anything consequential needs your explicit delegation.</p>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={busy || !name.trim()}
                className={primaryAction}
                onClick={() => create({ type: "ai_companion", name: name.trim(), relationship, seed: { ...directions[choice], description }, representation: "stylized_3d" })}
              >
                Enter Earth
              </button>
              <button type="button" className={secondaryAction} onClick={() => setPath("ai")}>
                Back
              </button>
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="mt-4 text-sm text-negative">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
