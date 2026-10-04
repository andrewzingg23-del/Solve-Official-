"use client";

// The agent screen's creator: a HUD stage and seven tabs of customization for a person's master
// bot. Everything previews live; saving writes one versioned kernel record. States here are
// previews only: on the live bot, states come from real activity.
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { label, primaryAction, secondaryAction } from "@/app/ui";
import {
  ACCESSORIES,
  AURAS,
  BODIES,
  BROWS,
  DEFAULT_PERSONA,
  EYES,
  IDLES,
  LIMITS,
  MARKS,
  MATERIALS,
  MOUTHS,
  PALETTES,
  RELATIONSHIPS,
  SWATCHES,
  TOPS,
  randomPersona,
  temperament,
  validatePersona,
  type Persona,
  type Trait,
} from "@/lib/bot/persona";
import { EMPTY_MACHINE, type MachineData } from "@/lib/bot/machine";
import { saveBotAction } from "./actions";
import { BotCharacter, STATE_LABELS, type BotState } from "./character";
import { AgentStage } from "./stage";

const MOODS: BotState[] = ["idle", "listening", "thinking", "waiting", "working", "needs_input", "completed", "happy", "sleeping", "unavailable"];

const TABS = [
  ["form", "Form"],
  ["face", "Face"],
  ["finish", "Finish"],
  ["color", "Color"],
  ["gear", "Gear"],
  ["motion", "Motion"],
  ["personality", "Personality"],
] as const;
type Tab = (typeof TABS)[number][0];

const FINISH: Record<string, string> = {
  matte: "Solid color, soft light.",
  glass: "See-through, with a rim of light.",
  hologram: "Projected light and scanlines.",
  chrome: "Polished metal.",
};

const IDLE_HINT: Record<string, string> = {
  bob: "A gentle bounce.",
  float: "Rises and settles slowly.",
  drift: "Wanders a little side to side.",
  still: "Holds still; only blinks.",
};

const NAMES: Record<string, string> = {
  bot: "Bot", humanoid: "Humanoid", creature: "Creature", orb: "Orb", pixel: "Pixel",
  round: "Round", visor: "Visor", sleepy: "Sleepy", spark: "Spark",
  smile: "Smile", line: "Calm", open: "Chatty", none: "None",
  antenna: "Antenna", halo: "Halo", ears: "Ears", crest: "Crest",
  scarf: "Scarf", headset: "Headset", cape: "Cape", badge: "Badge",
  orbit: "Orbit", pulse: "Pulse", sparkle: "Sparkle",
  matte: "Matte", glass: "Glass", hologram: "Hologram", chrome: "Chrome",
  soft: "Soft", sharp: "Sharp", raised: "Raised",
  blush: "Blush", stripes: "Stripes", circuit: "Circuit",
  bob: "Bob", float: "Float", drift: "Drift", still: "Still",
};

const RELATION: Record<string, { name: string; hint: string }> = {
  assist: { name: "Assist me", hint: "Helps with what you ask." },
  represent: { name: "Represent me", hint: "Speaks for you where you allow it." },
  guide: { name: "Guide me", hint: "Points out the way forward." },
  create_with: { name: "Create with me", hint: "Makes things alongside you." },
};

const TRAIT_ENDS: Record<Trait, [string, string]> = {
  warmth: ["Cool", "Warm"],
  playfulness: ["Serious", "Playful"],
  boldness: ["Careful", "Bold"],
  formality: ["Casual", "Formal"],
};

const ERRORS: Record<string, string> = {
  "signed-out": "Sign in to keep your bot.",
  identity: "Finish setting up your SOV ID first (open You).",
  forbidden: "The kernel refused this save.",
  unavailable: "Couldn't save just now. Nothing was changed; try again.",
};

export function BotCreator({ initial, signedIn, version, savedAt, machine = EMPTY_MACHINE }: { initial: Persona; signedIn: boolean; version: number; savedAt: string | null; machine?: MachineData }) {
  const [persona, setPersona] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saveInfo, setSaveInfo] = useState({ version, savedAt });
  const [mood, setMood] = useState<BotState>("idle");
  const [tab, setTab] = useState<Tab>("form");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [valuesText, setValuesText] = useState(initial.values.join(", "));
  const [pending, startTransition] = useTransition();
  const dirty = useMemo(() => JSON.stringify(persona) !== JSON.stringify(saved), [persona, saved]);

  const update = (patch: Partial<Persona>) => setPersona((p) => validatePersona({ ...p, ...patch }, p));
  const setTrait = (t: Trait, v: number) => setPersona((p) => ({ ...p, traits: { ...p.traits, [t]: v } }));
  const setColor = (key: keyof Persona["palette"], v: string) => setPersona((p) => ({ ...p, palette: { ...p.palette, [key]: v } }));

  function roll() {
    const look = randomPersona(persona.name);
    // The dice change the look; who the bot is stays.
    setPersona((p) => ({
      ...p,
      body: look.body, palette: look.palette, eyes: look.eyes, mouth: look.mouth, top: look.top, accessory: look.accessory, aura: look.aura,
      material: look.material, brows: look.brows, marks: look.marks, motion: look.motion,
    }));
    setMood("happy");
  }

  function save() {
    setMessage(null);
    const requestId = crypto.randomUUID();
    startTransition(async () => {
      const result = await saveBotAction(requestId, persona);
      if (result.ok) {
        setSaved(persona);
        setSaveInfo({ version: result.version, savedAt: result.savedAt });
        setMessage({ tone: "ok", text: `${persona.name} saved.` });
        setMood("happy");
      } else {
        setMessage({ tone: "error", text: ERRORS[result.error] });
      }
    });
  }

  return (
    <section className="grid flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.9fr)] lg:items-start">
      {/* Stage */}
      <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-6">
        <div className="flex flex-col gap-2">
          <p className={label}>Your agent</p>
          <h1 className="text-3xl font-medium leading-tight tracking-tight md:text-4xl">Make it yours.</h1>
          <p className="max-w-lg text-sm leading-6 text-muted">
            One character, whichever AI you use. Claude, ChatGPT or Meta AI speak through it, so it looks, sounds and remembers the same everywhere.
          </p>
        </div>
        <AgentStage persona={persona} state={mood} size={240} machine={machine} note="State preview. On your live agent, states follow what it is really doing." />
        <div className="flex flex-col items-center gap-1 text-center">
          <p className="text-xl font-medium">{persona.name}</p>
          <p className="text-xs text-muted">{RELATION[persona.relationship].name} · {temperament(persona)}</p>
          {persona.voice ? <p className="mt-2 max-w-sm text-sm italic leading-6 text-foreground/85">&ldquo;{persona.voice}&rdquo;</p> : null}
        </div>
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Preview a state">
          {MOODS.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMood(m)}
              aria-pressed={mood === m}
              className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.14em] transition-colors duration-300 ease-calm ${mood === m ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"}`}
            >
              {STATE_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap gap-2 border-b border-line pb-4" role="tablist" aria-label="Customize">
          {TABS.map(([t, name]) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`rounded-full border px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ease-calm ${tab === t ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-foreground"}`}
            >
              {name}
            </button>
          ))}
        </div>

        {tab === "form" ? (
          <div className="flex flex-col gap-6">
            <Field name="Body">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {BODIES.map((b) => (
                  <Tile key={b} active={persona.body === b} onClick={() => update({ body: b })} label={NAMES[b]}>
                    <BotCharacter persona={{ ...persona, body: b, aura: "none" }} size={56} />
                  </Tile>
                ))}
              </div>
            </Field>
            {persona.body === "pixel" ? <p className="text-xs leading-5 text-muted">Pixel bodies keep their own sprite: finish, eyes, brows, marks, top and accessory apply to the other bodies.</p> : null}
          </div>
        ) : tab === "face" ? (
          <div className="flex flex-col gap-6">
            <Choice name="Eyes" options={EYES} value={persona.eyes} onPick={(eyes) => update({ eyes })} disabled={persona.body === "pixel"} />
            <Choice name="Brows" options={BROWS} value={persona.brows} onPick={(brows) => update({ brows })} disabled={persona.body === "pixel"} />
            <Choice name="Mouth" options={MOUTHS} value={persona.mouth} onPick={(mouth) => update({ mouth })} />
            <Choice name="Marks" options={MARKS} value={persona.marks} onPick={(marks) => update({ marks })} disabled={persona.body === "pixel"} />
          </div>
        ) : tab === "finish" ? (
          <Field name="Finish" hint={persona.body === "pixel" ? "Applies to non-pixel bodies" : FINISH[persona.material]}>
            <div className={`grid grid-cols-2 gap-2 ${persona.body === "pixel" ? "opacity-40" : ""}`}>
              {MATERIALS.map((m) => (
                <Tile key={m} active={persona.material === m} disabled={persona.body === "pixel"} onClick={() => update({ material: m })} label={NAMES[m]} hint={FINISH[m]}>
                  <BotCharacter persona={{ ...persona, material: m, aura: "none" }} size={72} />
                </Tile>
              ))}
            </div>
          </Field>
        ) : tab === "color" ? (
          <div className="flex flex-col gap-6">
            <Field name="Color sets">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PALETTES.map((set) => {
                  const active = persona.palette.primary === set.primary && persona.palette.secondary === set.secondary && persona.palette.glow === set.glow;
                  return (
                    <button
                      key={set.name}
                      type="button"
                      onClick={() => update({ palette: { primary: set.primary, secondary: set.secondary, glow: set.glow } })}
                      aria-pressed={active}
                      className={`flex items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition-colors duration-300 ease-calm ${active ? "border-accent bg-accent/10 text-accent" : "border-line hover:border-foreground/40"}`}
                    >
                      <span aria-hidden className="flex -space-x-1">
                        {[set.primary, set.secondary, set.glow].map((c, i) => (
                          <span key={i} className="h-4 w-4 rounded-full border border-background" style={{ background: c }} />
                        ))}
                      </span>
                      {set.name}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Swatches name="Main color" value={persona.palette.primary} onPick={(v) => setColor("primary", v)} />
            <Swatches name="Second color" value={persona.palette.secondary} onPick={(v) => setColor("secondary", v)} />
            <Swatches name="Glow" value={persona.palette.glow} onPick={(v) => setColor("glow", v)} />
          </div>
        ) : tab === "gear" ? (
          <div className="flex flex-col gap-6">
            <Choice name="Top" options={TOPS} value={persona.top} onPick={(top) => update({ top })} disabled={persona.body === "pixel"} />
            <Choice name="Accessory" options={ACCESSORIES} value={persona.accessory} onPick={(accessory) => update({ accessory })} disabled={persona.body === "pixel"} />
            <Choice name="Aura" options={AURAS} value={persona.aura} onPick={(aura) => update({ aura })} />
          </div>
        ) : tab === "motion" ? (
          <div className="flex flex-col gap-6">
            <Field name="When nothing is happening">
              <div className="grid grid-cols-2 gap-2">
                {IDLES.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => update({ motion: { ...persona.motion, idle: i } })}
                    aria-pressed={persona.motion.idle === i}
                    className={`flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors duration-300 ease-calm ${persona.motion.idle === i ? "border-accent bg-accent/10" : "border-line hover:border-foreground/40"}`}
                  >
                    <span className="text-sm">{NAMES[i]}</span>
                    <span className="text-[11px] leading-4 text-muted">{IDLE_HINT[i]}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field name="Energy" hint={`${persona.motion.energy}`}>
              <label className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 text-xs text-muted">
                <span>Calm</span>
                <input type="range" min={0} max={100} value={persona.motion.energy} onChange={(e) => update({ motion: { ...persona.motion, energy: Number(e.target.value) } })} className="accent-[var(--accent)]" aria-label="Calm to brisk" />
                <span className="text-right">Brisk</span>
              </label>
            </Field>
            <p className="text-xs leading-5 text-muted">Motion stops for anyone whose device asks for reduced motion.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Field name="Name">
              <input
                value={persona.name}
                maxLength={LIMITS.name}
                onChange={(e) => setPersona((p) => ({ ...p, name: e.target.value }))}
                onBlur={() => { if (!persona.name.trim()) update({ name: saved.name || DEFAULT_PERSONA.name }); else update({}); }}
                className="h-11 w-full rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field name="Relationship">
              <div className="grid grid-cols-2 gap-2">
                {RELATIONSHIPS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => update({ relationship: r })}
                    aria-pressed={persona.relationship === r}
                    className={`flex flex-col items-start gap-0.5 rounded-md border p-3 text-left transition-colors duration-300 ease-calm ${persona.relationship === r ? "border-accent bg-accent/10" : "border-line hover:border-foreground/40"}`}
                  >
                    <span className="text-sm">{RELATION[r].name}</span>
                    <span className="text-[11px] leading-4 text-muted">{RELATION[r].hint}</span>
                  </button>
                ))}
              </div>
            </Field>
            <Field name="Temperament" hint={temperament(persona)}>
              <div className="flex flex-col gap-3">
                {(Object.keys(TRAIT_ENDS) as Trait[]).map((t) => (
                  <label key={t} className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-3 text-xs text-muted">
                    <span>{TRAIT_ENDS[t][0]}</span>
                    <input type="range" min={0} max={100} value={persona.traits[t]} onChange={(e) => setTrait(t, Number(e.target.value))} className="accent-[var(--accent)]" aria-label={`${TRAIT_ENDS[t][0]} to ${TRAIT_ENDS[t][1]}`} />
                    <span className="text-right">{TRAIT_ENDS[t][1]}</span>
                  </label>
                ))}
              </div>
            </Field>
            <Field name="A line in its voice" hint={`${persona.voice.length}/${LIMITS.voice}`}>
              <input
                value={persona.voice}
                maxLength={LIMITS.voice}
                onChange={(e) => setPersona((p) => ({ ...p, voice: e.target.value }))}
                placeholder="On it. Tell me what matters."
                className="h-11 w-full rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field name="Who it is" hint={`${persona.about.length}/${LIMITS.about}`}>
              <textarea
                value={persona.about}
                maxLength={LIMITS.about}
                rows={4}
                onChange={(e) => setPersona((p) => ({ ...p, about: e.target.value }))}
                className="w-full rounded-md border border-line bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-accent"
              />
            </Field>
            <Field name="Values" hint={`Up to ${LIMITS.values}, separated by commas`}>
              <input
                value={valuesText}
                onChange={(e) => setValuesText(e.target.value)}
                onBlur={() => { const values = validatePersona({ values: valuesText.split(",") }).values; update({ values }); setValuesText(values.join(", ")); }}
                className="h-11 w-full rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent"
              />
            </Field>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
          <button type="button" onClick={roll} className={secondaryAction} aria-label="Roll a random look">Roll the dice</button>
          <button type="button" onClick={() => { setPersona(saved); setValuesText(saved.values.join(", ")); setMood("idle"); }} disabled={!dirty} className={`${secondaryAction} disabled:opacity-40`}>Undo changes</button>
          {signedIn ? (
            <button type="button" onClick={save} disabled={pending || !dirty} className={`${primaryAction} disabled:opacity-40`}>
              {pending ? "Saving" : saveInfo.version ? "Save changes" : "Bring it to life"}
            </button>
          ) : (
            <Link href="/login?next=%2Fbot" className={primaryAction}>Sign in to keep it</Link>
          )}
        </div>
        <p role="status" className={`min-h-5 text-sm ${message?.tone === "error" ? "text-negative" : "text-positive"}`}>
          {message?.text ??
            (signedIn
              ? saveInfo.version
                ? `Version ${saveInfo.version}${saveInfo.savedAt ? `, saved ${new Date(saveInfo.savedAt).toLocaleString()}` : ""}. Every save is kept in its history.`
                : ""
              : "")}
        </p>
        {!signedIn ? <p className="text-xs leading-5 text-muted">You are trying the creator. Nothing is saved until you sign in.</p> : null}
      </div>
    </section>
  );
}

function Tile({ active, onClick, label: name, hint, disabled = false, children }: { active: boolean; onClick: () => void; label: string; hint?: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors duration-300 ease-calm ${active ? "border-accent bg-accent/10" : "border-line hover:border-foreground/40"}`}
    >
      {children}
      <span className="text-[11px] uppercase tracking-[0.14em]">{name}</span>
      {hint ? <span className="text-[11px] leading-4 text-muted">{hint}</span> : null}
    </button>
  );
}

function Field({ name, hint, children }: { name: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className={label}>{name}</p>
        {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Choice<T extends string>({ name, options, value, onPick, disabled = false }: { name: string; options: readonly T[]; value: T; onPick: (v: T) => void; disabled?: boolean }) {
  return (
    <Field name={name}>
      <div className={`flex flex-wrap gap-2 ${disabled ? "opacity-40" : ""}`}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={disabled}
            onClick={() => onPick(o)}
            aria-pressed={value === o}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors duration-300 ease-calm ${value === o ? "border-accent bg-accent/10 text-accent" : "border-line text-muted hover:text-foreground"}`}
          >
            {NAMES[o] ?? o}
          </button>
        ))}
      </div>
    </Field>
  );
}

function Swatches({ name, value, onPick }: { name: string; value: string; onPick: (v: string) => void }) {
  return (
    <Field name={name}>
      <div className="flex flex-wrap gap-2">
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onPick(c)}
            aria-label={`${name} ${c}`}
            aria-pressed={value === c}
            className={`h-8 w-8 rounded-full border-2 transition-transform duration-300 ease-calm hover:scale-110 ${value === c ? "border-foreground" : "border-transparent"}`}
            style={{ background: c }}
          />
        ))}
      </div>
    </Field>
  );
}
